use bytesize::ByteSize;
use crossbeam_channel::Sender;
use glob::{glob, PatternError};
use once_cell::sync::{Lazy, OnceCell};
use rfd::FileDialog;
use slint::{ModelRc, SharedString, VecModel};
use snafu::{ResultExt, Snafu};
use std::sync::mpsc;
use std::sync::{Mutex, MutexGuard};
use std::{path::PathBuf, rc::Rc};

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
}
type Result<T, E = Error> = std::result::Result<T, E>;

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

struct ImageFile {
    name: String,
    path: PathBuf,
    size: u64,
}

impl ImageFile {
    fn values(&self) -> Vec<String> {
        vec![
            "".to_string(),
            self.name.clone(),
            ByteSize(self.size).to_string(),
            "20%".to_string(),
            "0.01".to_string(),
        ]
    }
}

fn load_images(dir: &str) -> Result<Vec<ImageFile>> {
    let ext_list = ["png", "jpeg", "jpg"];
    let mut file_paths = vec![];
    for ext in ext_list.iter() {
        file_paths.push(format!(r#"{dir}/*.{ext}"#));
        file_paths.push(format!(r#"{dir}/**/*.{ext}"#));
    }
    let mut image_files = vec![];
    for file_path in file_paths.iter() {
        for entry in glob(file_path).context(PatternSnafu {})?.flatten() {
            let metadata = std::fs::metadata(&entry).context(IoSnafu {})?;
            image_files.push(ImageFile {
                name: entry
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                path: entry,
                size: metadata.len(),
            });
        }
    }
    Ok(image_files)
}

pub struct State {
    pub processing: bool,
    pub dir: String,
    image_files: Vec<ImageFile>,
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
    pub fn get_values(&self) -> ModelRc<ModelRc<SharedString>> {
        let values: Vec<Vec<String>> = self.image_files.iter().map(|item| item.values()).collect();
        new_model_shared_string_slices(&values)
    }
    pub fn select_files(&mut self) -> Result<bool> {
        if self.processing {
            return Ok(false);
        }
        let folder = FileDialog::new().pick_folder();
        if folder.is_none() {
            return Ok(false);
        }
        // 保证不会为空
        let dir = folder.unwrap().to_str().unwrap_or_default().to_string();
        self.processing = true;
        self.dir = dir;
        match load_images(&self.dir) {
            Ok(image_files) => {
                self.image_files = image_files;
                // TODO 处理error
                self.update_sender.send(0).unwrap();
                let s = self.update_sender.clone();
                std::thread::spawn(move || {
                    s.send(1).unwrap();
                });
                // 启动子进程处理
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
            dir: "".to_string(),
            image_files: vec![],
            update_sender,
        })
    })
}
pub fn lock() -> Result<MutexGuard<'static, State>> {
    if let Some(value) = APP_STATE.get() {
        return value.lock().map_err(|err| Error::Lock {
            message: err.to_string(),
        });
    }
    Err(Error::Init {})
}
