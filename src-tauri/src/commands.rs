// Copyright 2024 Tree xie.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use crate::utils;
use glob::{glob, PatternError};
use imageoptimize::{run, PROCESS_DIFF, PROCESS_LOAD, PROCESS_OPTIM};
use serde::Serialize;
use snafu::{ResultExt, Snafu};
use std::path::{Path, PathBuf};
use tauri::{command, Manager, Window};
use tokio::fs;

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Optimize processing error: {source:?}"))]
    OptimizeProcessing {
        source: imageoptimize::ImageProcessingError,
    },
    #[snafu(display("Io error: {source:?}"))]
    Io { source: std::io::Error },
    #[snafu(display("Glob error: {source}"))]
    Pattern { source: PatternError },
    #[snafu(display("Format is invalid"))]
    FormatInvalid {},
}
impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        let (category, message) = match self {
            Error::OptimizeProcessing { source } => ("optim".to_string(), source.to_string()),
            Error::Io { source } => ("io".to_string(), source.to_string()),
            Error::Pattern { source } => ("pattern".to_string(), source.to_string()),
            Error::FormatInvalid {} => ("format".to_string(), "Format is invalid".to_string()),
        };
        let json =
            r#"{"category": ""#.to_string() + &category + r#"", "message": ""# + &message + r#""}"#;
        serializer.serialize_str(json.as_ref())
    }
}

type Result<T, E = Error> = std::result::Result<T, E>;

// 关闭启动视窗切换至主视窗
#[command]
pub fn close_splashscreen(window: Window) {
    // 关闭启动视图
    if let Some(splashscreen) = window.get_webview_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    // 展示主视图
    window.get_webview_window("main").unwrap().show().unwrap();
}

#[command]
pub fn show_splashscreen(window: Window) {
    window
        .get_webview_window("splashscreen")
        .unwrap()
        .show()
        .unwrap();
}

#[derive(Debug, Default, Serialize)]
pub struct ImageOptimizeResult {
    pub diff: f64,
    pub hash: String,
    pub size: usize,
    pub original_size: usize,
}

fn get_backup_file(hash: &str) -> PathBuf {
    utils::get_app_cache_dir().join(format!("{hash}.bak"))
}

fn get_image_format(file: &str) -> Result<String> {
    let mut ext = Path::new(&file)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    if ext.is_empty() {
        return Err(Error::FormatInvalid {});
    }
    if ext == "jpg" {
        ext = "jpeg".to_string()
    }
    Ok(ext)
}

#[command(async)]
pub async fn image_convert(
    file: String,
    target: String,
    quality: usize,
) -> Result<ImageOptimizeResult> {
    let format = get_image_format(&target)?;
    let img = run(vec![
        vec![PROCESS_LOAD.to_string(), format!("file://{file}")],
        vec![
            PROCESS_OPTIM.to_string(),
            format,
            quality.to_string(),
            "1".to_string(),
        ],
        vec![PROCESS_DIFF.to_string()],
    ])
    .await
    .context(OptimizeProcessingSnafu)?;
    let metadata = fs::metadata(&file).await.context(IoSnafu)?;
    let image_buffer = img.get_buffer().context(OptimizeProcessingSnafu)?;

    fs::write(target, &image_buffer).await.context(IoSnafu)?;

    Ok(ImageOptimizeResult {
        diff: img.diff,
        original_size: metadata.len() as usize,
        size: image_buffer.len(),
        ..Default::default()
    })
}

#[command(async)]
pub async fn image_optimize(file: String, quality: usize) -> Result<ImageOptimizeResult> {
    let format = get_image_format(&file)?;
    let img = run(vec![
        vec![PROCESS_LOAD.to_string(), format!("file://{file}")],
        vec![
            PROCESS_OPTIM.to_string(),
            format,
            quality.to_string(),
            "1".to_string(),
        ],
        vec![PROCESS_DIFF.to_string()],
    ])
    .await
    .context(OptimizeProcessingSnafu)?;
    let image_buffer = img.get_buffer().context(OptimizeProcessingSnafu)?;
    let buf = fs::read(&file).await.context(IoSnafu)?;
    let original_size = buf.len();
    if image_buffer.len() >= original_size {
        return Ok(ImageOptimizeResult {
            diff: 0.0,
            hash: "".to_string(),
            original_size,
            size: original_size,
        });
    }
    let mut hash = blake3::hash(&buf).to_hex().to_string();
    let backup = get_backup_file(&hash);
    if !backup.exists() {
        // ignore error
        if let Err(e) = fs::write(backup, buf).await {
            hash = "".to_string();
            println!("{e:?}")
        }
    }
    fs::write(file, &image_buffer).await.context(IoSnafu)?;

    Ok(ImageOptimizeResult {
        diff: img.diff,
        hash,
        original_size,
        size: image_buffer.len(),
    })
}

#[command(async)]
pub async fn restore_file(hash: String, file: String) -> Result<u64> {
    let size = fs::copy(get_backup_file(&hash), file)
        .await
        .context(IoSnafu)?;
    Ok(size)
}

#[command(async)]
pub async fn list_file(folders: Vec<String>, exts: Vec<String>) -> Result<Vec<String>> {
    let mut entry_list = vec![];
    let mut file_paths = vec![];
    for dir in folders.iter() {
        for ext in exts.iter() {
            file_paths.push(format!(r#"{dir}/**/*.{ext}"#));
        }
    }
    for file_path in file_paths.iter() {
        for entry in glob(file_path).context(PatternSnafu {})?.flatten() {
            entry_list.push(entry.to_string_lossy().to_string());
        }
    }
    Ok(entry_list)
}
