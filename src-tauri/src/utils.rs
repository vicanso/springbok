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

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static APP_CACHE_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn set_app_cache_dir(dir: &Path) {
    APP_CACHE_DIR.get_or_init(|| dir.to_path_buf());
}

pub fn get_app_cache_dir() -> PathBuf {
    APP_CACHE_DIR.get().cloned().unwrap()
}
