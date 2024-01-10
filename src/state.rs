use base64::{engine::general_purpose, Engine as _};
use bytesize::ByteSize;
use crossbeam_channel::Sender;
use glob::{glob, PatternError};
use imageoptimize::ImageProcessingError;
use once_cell::sync::OnceCell;
use parking_lot::{Mutex, MutexGuard};
use rfdx::FileDialog;
use slint::{ModelRc, SharedString, VecModel};
use snafu::{ResultExt, Snafu};
use std::fs;
use std::io::Read;
use std::sync::atomic::{AtomicI64, AtomicI8, AtomicU64, Ordering};
use std::sync::Arc;
use std::{path::PathBuf, rc::Rc};
use tracing::error;

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Glob: {source}"))]
    Pattern { source: PatternError },
    #[snafu(display("Io: {source}"))]
    Io { source: std::io::Error },
    #[snafu(display("Lock fail: {message}"))]
    Lock { message: String },
    #[snafu(display("State is not initialized"))]
    Init {},
    #[snafu(display("Image: {source}"))]
    ImageProcessing { source: ImageProcessingError },
}
type Result<T, E = Error> = std::result::Result<T, E>;

impl From<ImageProcessingError> for Error {
    fn from(value: ImageProcessingError) -> Self {
        Error::ImageProcessing { source: value }
    }
}

fn new_model_shared_string_slice(data: &[String]) -> ModelRc<SharedString> {
    let columns: Vec<SharedString> = data.iter().map(SharedString::from).collect();
    ModelRc::from(Rc::new(VecModel::from(columns)))
}

fn new_model_shared_string_slices(data: &[Vec<String>]) -> ModelRc<ModelRc<SharedString>> {
    let arr: Vec<ModelRc<SharedString>> = data
        .iter()
        .map(|item| new_model_shared_string_slice(item))
        .collect();
    ModelRc::from(Rc::new(VecModel::from(arr)))
}

static STATUS_PENDING: i8 = 0;
static STATUS_PROCESSING: i8 = 1;
static STATUS_DONE: i8 = 2;
static STATUS_FAIL: i8 = -1;

struct ImageFile {
    // 状态
    status: AtomicI8,
    // 文件名
    name: String,
    // 原始数据
    original_data: Arc<Vec<u8>>,
    // 原文件
    original: PathBuf,
    // 新文件
    file: PathBuf,
    // 文件大小
    size: AtomicU64,
    // 节约空间
    saving: AtomicI8,
    // 对比区别
    diff: AtomicI64,
}

impl ImageFile {
    fn values(&self, index: usize) -> Vec<String> {
        let size = self.size.load(Ordering::Relaxed);
        let status = self.status.load(Ordering::Relaxed);
        let status_str = match status {
            0 => "",
            1 => "...",
            -1 => "✗",
            _ => "✓",
        };
        let saving = if status == STATUS_DONE {
            format!("{}%", self.saving.load(Ordering::Relaxed))
        } else {
            "".to_string()
        };
        let index_str = if index % 2 == 0 { "even" } else { "odd" };
        let diff = self.diff.load(Ordering::Relaxed);
        let diff_str = if diff < 0 {
            "".to_string()
        } else {
            format!("{:.5}", diff as f64 / TEN_THOUSANDS)
        };
        vec![
            index_str.to_string(),
            status_str.to_string(),
            self.name.clone(),
            ByteSize(size).to_string(),
            saving,
            diff_str,
        ]
    }
}

fn load_images(
    file_list: &[PathBuf],
    ext_list: &[String],
    formats: &[String],
) -> Result<Vec<ImageFile>> {
    let mut image_files = vec![];
    let mut file_paths = vec![];
    let mut dir_list = vec![];
    let mut entry_list = vec![];
    for file in file_list.iter() {
        if file.is_dir() {
            dir_list.push(file.to_string_lossy().to_string());
            continue;
        }
        let ext = file
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if ext_list.contains(&ext) {
            entry_list.push(file.clone());
        }
    }
    for dir in dir_list.iter() {
        for ext in ext_list.iter() {
            file_paths.push(format!(r#"{dir}/**/*.{ext}"#));
        }
    }
    for file_path in file_paths.iter() {
        for entry in glob(file_path).context(PatternSnafu {})?.flatten() {
            entry_list.push(entry);
        }
    }
    for entry in entry_list.iter() {
        let metadata = std::fs::metadata(entry).context(IoSnafu {})?;
        let mut file = fs::File::open(entry).context(IoSnafu)?;
        let mut contents = vec![];
        file.read_to_end(&mut contents).context(IoSnafu)?;
        let original_data = Arc::new(contents);
        for item in formats.iter() {
            let mut file = entry.clone();
            file.set_extension(item);
            let name = file
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            image_files.push(ImageFile {
                status: AtomicI8::new(STATUS_PENDING),
                name: name.clone(),
                original: entry.clone(),
                original_data: original_data.clone(),
                file,
                size: AtomicU64::new(metadata.len()),
                saving: AtomicI8::new(0),
                diff: AtomicI64::new(-1),
            });
        }
        image_files.push(ImageFile {
            status: AtomicI8::new(STATUS_PENDING),
            name: entry
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            original: entry.clone(),
            original_data,
            file: entry.clone(),
            size: AtomicU64::new(metadata.len()),
            saving: AtomicI8::new(0),
            diff: AtomicI64::new(-1),
        });
    }
    Ok(image_files)
}

static TEN_THOUSANDS: f64 = 10000.0;

struct OptimParams {
    avif: u8,
    webp: u8,
    png: u8,
    jpeg: u8,
}

pub fn save_file(file: &PathBuf, data: &[u8]) -> Result<()> {
    fs::write(file, data).context(IoSnafu {})
}

async fn optim_image(file: &ImageFile, params: &OptimParams) -> Result<()> {
    let mut original_ext = file
        .original
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if original_ext.is_empty() {
        original_ext = "jpeg".to_string();
    }
    let ext = if file.name.contains(".avif") {
        "avif"
    } else if file.name.contains(".webp") {
        "webp"
    } else if file.name.contains(".png") {
        "png"
    } else {
        "jpeg"
    };

    let quality = match ext {
        "avif" => params.avif,
        "webp" => params.webp,
        "png" => params.png,
        _ => params.jpeg,
    };

    let tasks = vec![
        vec![
            imageoptimize::PROCESS_LOAD.to_string(),
            general_purpose::STANDARD.encode(&*file.original_data),
            original_ext,
        ],
        vec![
            imageoptimize::PROCESS_OPTIM.to_string(),
            ext.to_string(),
            quality.to_string(),
            "1".to_string(),
        ],
        // 参数需要最少两个
        vec![imageoptimize::PROCESS_DIFF.to_string()],
    ];
    let result = imageoptimize::run(tasks).await?;
    let diff = result.diff;
    let buf = result.get_buffer()?;
    let size = file.size.load(Ordering::Relaxed);
    let mut current_size = buf.len() as u64;
    let mut exists = false;
    // 判断文件是否已存在
    if let Ok(data) = file.file.metadata() {
        // 文件仅读则无法覆盖
        if data.permissions().readonly() {
            let mut perm = data.permissions();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                perm.set_mode(0o644);
            }
            #[cfg(not(unix))]
            {
                perm.set_readonly(false);
            }
            if let Err(err) = std::fs::set_permissions(file.file.clone(), perm) {
                let name = file.file.to_string_lossy().to_string();
                error!(category = "set-permissions", name, err = err.to_string(),);
            }
        }
        // 如果存在的文件更小
        // 由于metadata返回的size比真实的大偏差少于1kb的也忽略
        let size = data.len();
        if current_size >= size || size - current_size < 1024 {
            exists = true;
            current_size = size;
        }
    }
    let saving: i8 = if current_size > size {
        -(((current_size - size) * 100 / size) as i8)
    } else {
        (100 - current_size * 100 / size) as i8
    };
    file.size.store(current_size, Ordering::Relaxed);
    file.saving.store(saving, Ordering::Relaxed);
    // 如果是原文件，而且压缩效果无用
    if saving == 0 && file.original == file.file {
        file.diff.store(0, Ordering::Relaxed);
        return Ok(());
    }
    let v = diff * TEN_THOUSANDS;
    file.diff.store(v as i64, Ordering::Relaxed);
    if !exists {
        save_file(&file.file, &buf)?;
    }
    Ok(())
}

async fn optim_images(s: Sender<i64>, image_files: Arc<Vec<ImageFile>>, params: &OptimParams) {
    for (index, file) in image_files.iter().enumerate() {
        let count = index as i64 + 1;
        file.status.store(STATUS_PROCESSING, Ordering::Relaxed);
        match optim_image(file, params).await {
            Ok(()) => file.status.store(STATUS_DONE, Ordering::Relaxed),
            Err(err) => {
                let name = file.name.clone();
                error!(name, err = err.to_string(),);
                file.status.store(STATUS_FAIL, Ordering::Relaxed);
            }
        }
        if let Err(err) = s.send(count) {
            error!(category = "channel-sender", err = err.to_string(),);
        }
    }
}

static AVIF: &str = "avif";
static WEBP: &str = "webp";

pub struct State {
    pub processing: bool,
    pub png_quality: u8,
    pub jpeg_quality: u8,
    pub avif_quality: u8,
    pub webp_quality: u8,
    image_files: Arc<Vec<ImageFile>>,
    update_sender: Sender<i64>,
}

impl State {
    pub fn get_columns() -> ModelRc<SharedString> {
        new_model_shared_string_slice(&[
            "Device".to_string(),
            "Mount Point".to_string(),
            "Total".to_string(),
            "Free".to_string(),
        ])
    }
    pub fn count(&self) -> usize {
        self.image_files.len()
    }
    pub fn get_values(&self) -> ModelRc<ModelRc<SharedString>> {
        let values: Vec<Vec<String>> = self
            .image_files
            .iter()
            .enumerate()
            .map(|(index, item)| item.values(index))
            .collect();
        new_model_shared_string_slices(&values)
    }
    pub fn select_files(&mut self) -> Result<bool> {
        if self.processing {
            return Ok(false);
        }
        let mut ext_list = vec![];
        if self.jpeg_quality > 0 {
            ext_list.push("jpeg".to_string());
            ext_list.push("jpg".to_string());
        }
        if self.png_quality > 0 {
            ext_list.push("png".to_string());
        }

        // TODO 后续若支持file与folder同时选择则放开
        // 暂时调整了rfd模块，macos现支持选择
        let files = FileDialog::new()
            .set_title("Please select images")
            .add_filter("image-or-folder", &ext_list)
            .pick_folders();
        if files.is_none() {
            return Ok(false);
        }
        // 保证不会为空
        self.processing = true;
        let mut support_formats = vec![];
        if self.avif_quality > 0 {
            support_formats.push(AVIF.to_string());
        }
        if self.webp_quality > 0 {
            support_formats.push(WEBP.to_string());
        }

        // files 已保证不会为空
        match load_images(&files.unwrap(), &ext_list, &support_formats) {
            Ok(image_files) => {
                self.image_files = Arc::new(image_files);
                if let Err(err) = self.update_sender.send(0) {
                    error!(category = "channel-sender", err = err.to_string(),);
                }
                let s = self.update_sender.clone();
                let image_files = self.image_files.clone();
                // 启动子进程处理
                let avif_quality = self.avif_quality;
                let webp_quality = self.webp_quality;
                let png_quality = self.png_quality;
                let jpeg_quality = self.jpeg_quality;

                std::thread::spawn(move || {
                    let mut worker_threads = num_cpus::get() / 2;
                    if worker_threads == 0 {
                        worker_threads = 1;
                    }
                    let runtime = tokio::runtime::Builder::new_multi_thread()
                        .enable_all()
                        .thread_name("image_optimize")
                        .worker_threads(worker_threads)
                        .build()
                        .expect("Creating tokio runtime");
                    runtime.block_on(async move {
                        optim_images(
                            s,
                            image_files,
                            &OptimParams {
                                avif: avif_quality,
                                webp: webp_quality,
                                png: png_quality,
                                jpeg: jpeg_quality,
                            },
                        )
                        .await;
                    });
                });
            }
            Err(err) => {
                // 如果出错，则将processing设置为false
                self.processing = false;
                return Err(err);
            }
        }
        Ok(true)
    }
}

static APP_STATE: OnceCell<Mutex<State>> = OnceCell::new();
pub fn must_new_state(update_sender: Sender<i64>) -> &'static Mutex<State> {
    APP_STATE.get_or_init(|| {
        Mutex::new(State {
            processing: false,
            image_files: Arc::new(vec![]),
            avif_quality: 70,
            webp_quality: 80,
            png_quality: 80,
            jpeg_quality: 80,
            update_sender,
        })
    })
}
pub fn lock() -> Result<MutexGuard<'static, State>> {
    if let Some(value) = APP_STATE.get() {
        return Ok(value.lock());
    }
    Err(Error::Init {})
}
