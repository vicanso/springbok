use crossbeam_channel::{select, tick, unbounded};
use home::home_dir;
use serde::{Deserialize, Serialize};
use slint::ComponentHandle;
use slint::SharedString;
use snafu::{ResultExt, Snafu};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::time::Duration;
use substring::Substring;

slint::include_modules!();

mod image_processing;
mod state;

#[derive(Debug, Snafu)]
enum Error {
    #[snafu(display("Platform: {source}"))]
    Platform { source: slint::PlatformError },
}
type Result<T, E = Error> = std::result::Result<T, E>;

#[derive(Debug, PartialEq, Serialize, Deserialize, Default)]
struct ConvertConfig {
    avif_quality: Option<u8>,
    support_avif: Option<bool>,
    webp_quality: Option<u8>,
    support_webp: Option<bool>,
    png_quality: Option<u8>,
    support_png: Option<bool>,
    jpeg_quality: Option<u8>,
    support_jpeg: Option<bool>,
}

fn get_config_file() -> PathBuf {
    let dir = home_dir().unwrap();
    let config_path = dir.join(".image-converter");
    config_path.join("config.yml")
}

fn load_config(config: &Config) {
    let config_file = get_config_file();
    fs::create_dir_all(config_file.parent().unwrap()).unwrap();
    if !config_file.exists() {
        fs::File::create(config_file.clone()).unwrap();
    }

    let mut file = fs::File::open(config_file).unwrap();
    let mut contents = String::new();
    file.read_to_string(&mut contents).unwrap();
    let conf: ConvertConfig = serde_yaml::from_str(&contents).unwrap();
    config.set_avif_quality(conf.avif_quality.unwrap_or(70) as i32);
    config.set_support_avif(conf.support_avif.unwrap_or(true));
    config.set_webp_quality(conf.webp_quality.unwrap_or(80) as i32);
    config.set_support_webp(conf.support_webp.unwrap_or(true));
    config.set_png_quality(conf.png_quality.unwrap_or(80) as i32);
    config.set_support_png(conf.support_png.unwrap_or(true));
    config.set_jpeg_quality(conf.jpeg_quality.unwrap_or(80) as i32);
    config.set_support_jpeg(conf.support_jpeg.unwrap_or(true));
}

fn main() -> Result<()> {
    let app = AppWindow::new().context(PlatformSnafu {})?;
    load_config(&app.global::<Config>());

    let (update_sender, update_receiver) = unbounded::<i64>();

    state::must_new_state(update_sender);

    let app_image_list = app.as_weak();
    std::thread::spawn(move || {
        let ticker = tick(Duration::from_millis(500));
        let mut dot_count: usize = 0;

        loop {
            select! {
              recv(ticker) -> _ => {
                dot_count += 1;
                app_image_list.upgrade_in_event_loop(move |h| {
                    let size = dot_count % 3;
                    h.set_select_btn_text(SharedString::from("...".substring(0, size + 1)));
                }).unwrap();
              },
              recv(update_receiver) -> result => {
                // TODO error的处理
                let count = result.unwrap_or_default();
                if count == 0 {
                    dot_count = 0;
                }
                app_image_list.upgrade_in_event_loop(move |h| {
                    let mut state = state::lock().unwrap();
                    h.set_values(state.get_values());
                    let total = state.count();
                    let tips = format!(" ({count}/{total})");
                    h.set_processing_tips(SharedString::from(tips));
                    if total == count as usize {
                        state.processing = false;
                        h.set_processing(state.processing);
                    }
                })
                .unwrap();
              },
            }
        }
    });

    let app_show_open_dialog = app.as_weak();
    app.on_show_open_dialog(move || {
        let mut state = state::lock().unwrap();
        if let Some(app) = app_show_open_dialog.upgrade() {
            let config = app.global::<Config>();
            if config.get_support_jpeg() {
                state.jpeg_quality = config.get_jpeg_quality() as u8;
            } else {
                state.jpeg_quality = 0;
            }
            if config.get_support_png() {
                state.png_quality = config.get_png_quality() as u8;
            } else {
                state.png_quality = 0;
            }
            if config.get_support_avif() {
                state.avif_quality = config.get_avif_quality() as u8;
            } else {
                state.avif_quality = 0;
            }
            if config.get_support_webp() {
                state.webp_quality = config.get_webp_quality() as u8;
            } else {
                state.webp_quality = 0;
            }
            let conf = ConvertConfig {
                avif_quality: Some(config.get_avif_quality() as u8),
                support_avif: Some(config.get_support_avif()),
                webp_quality: Some(config.get_webp_quality() as u8),
                support_webp: Some(config.get_support_webp()),
                png_quality: Some(config.get_png_quality() as u8),
                support_png: Some(config.get_support_png()),
                jpeg_quality: Some(config.get_jpeg_quality() as u8),
                support_jpeg: Some(config.get_support_jpeg()),
            };
            fs::write(get_config_file(), serde_yaml::to_string(&conf).unwrap()).unwrap();
        }
        if state.select_files().unwrap() {
            if state.count() == 0 {
                return;
            }
            let processing = state.processing;
            app_show_open_dialog
                .upgrade_in_event_loop(move |h| {
                    h.set_select_btn_text(SharedString::from("..."));
                    h.set_processing(processing);
                })
                .unwrap();
        }
    });
    app.set_columns(state::State::get_columns());

    app.run().context(PlatformSnafu {})
}
