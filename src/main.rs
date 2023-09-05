use slint::{ModelRc, SharedString, VecModel};
use std::rc::Rc;
slint::include_modules!();

fn new_model_shared_string_slice(data: &Vec<String>) -> ModelRc<SharedString> {
    let columns: Vec<SharedString> = data.iter().map(|item| SharedString::from(item)).collect();
    ModelRc::from(Rc::new(VecModel::from(columns)))
}

fn new_model_shared_string_slices(data: &Vec<Vec<String>>) -> ModelRc<ModelRc<SharedString>> {
    let arr: Vec<ModelRc<SharedString>> = data
        .iter()
        .map(|items| new_model_shared_string_slice(items))
        .collect();
    ModelRc::from(Rc::new(VecModel::from(arr)))
}

fn main() -> Result<(), slint::PlatformError> {
    let ui = AppWindow::new()?;
    let columns = new_model_shared_string_slice(&vec![
        "Device".to_string(),
        "Mount Point".to_string(),
        "Total".to_string(),
        "Free".to_string(),
    ]);
    ui.set_columns(columns);

    let values = vec![
        vec![
            "/dev/sda1".to_string(),
            "/".to_string(),
            "/255GB".to_string(),
            "/82.2GB".to_string(),
        ],
        vec![
            "/dev/sda2".to_string(),
            "/tmp".to_string(),
            "/60.5GB".to_string(),
            "/44.5GB".to_string(),
        ],
        vec![
            "/dev/sdb1".to_string(),
            "/home".to_string(),
            "/255GB".to_string(),
            "/32.2GB".to_string(),
        ],
    ];

    ui.set_values(new_model_shared_string_slices(&values));

    ui.run()
}
