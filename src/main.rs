use bytesize::ByteSize;
use glob::{glob, PatternError};
use rfd::FileDialog;
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};
use snafu::{ResultExt, Snafu};
use std::sync::Arc;
use std::{path::PathBuf, rc::Rc};

slint::include_modules!();

#[derive(Debug, Snafu)]
enum Error {
    #[snafu(display("Glob: {source}"))]
    Pattern { source: PatternError },
    #[snafu(display("Platform: {source}"))]
    Platform { source: slint::PlatformError },
    #[snafu(display("Io: {source}"))]
    Io { source: std::io::Error },
}

type Result<T, E = Error> = std::result::Result<T, E>;

fn new_model_shared_string_slice(data: &Vec<String>) -> ModelRc<SharedString> {
    let columns: Vec<SharedString> = data.iter().map(SharedString::from).collect();
    ModelRc::from(Rc::new(VecModel::from(columns)))
}

fn new_model_shared_string_slices(data: &Vec<Vec<String>>) -> ModelRc<ModelRc<SharedString>> {
    let arr: Vec<ModelRc<SharedString>> = data.iter().map(new_model_shared_string_slice).collect();
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
// https://github.com/slint-ui/slint/issues/747

fn main() -> Result<()> {
    let app = Arc::new(AppWindow::new().context(PlatformSnafu {})?);
    let columns = new_model_shared_string_slice(&vec![
        "Device".to_string(),
        "Mount Point".to_string(),
        "Total".to_string(),
        "Free".to_string(),
    ]);

    let ui_clone = app.clone();
    app.on_show_open_dialog(move || {
        if let Some(dir) = FileDialog::new().pick_folder() {
            // TODO error 处理
            let image_files = load_images(dir.to_str().unwrap_or_default()).unwrap();
            let values = image_files.iter().map(|item| item.values()).collect();
            ui_clone.set_values(new_model_shared_string_slices(&values));
        }
    });
    app.set_columns(columns);

    app.run().context(PlatformSnafu {})
}
