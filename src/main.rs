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
use std::{fs::File, sync::Mutex};
use substring::Substring;
use tracing::error;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

slint::include_modules!();

mod image_processing;
mod state;

#[derive(Debug, Snafu)]
enum Error {
    #[snafu(display("Platform: {source}"))]
    Platform { source: slint::PlatformError },
    #[snafu(display("Io: {source}"))]
    Io { source: std::io::Error },
    #[snafu(display("Yaml: {source}"))]
    Yaml { source: serde_yaml::Error },
    #[snafu(display("{message}"))]
    NotFound { message: String },
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

fn get_config_file() -> Result<PathBuf> {
    let dir = home_dir().ok_or(Error::NotFound {
        message: "home is not found".to_string(),
    })?;
    let config_path = dir.join(".image-converter");
    Ok(config_path.join("config.yml"))
}

fn load_config(config: &Config) -> Result<()> {
    let config_file = get_config_file()?;
    fs::create_dir_all(config_file.parent().unwrap()).context(IoSnafu {})?;
    if !config_file.exists() {
        fs::File::create(config_file.clone()).context(IoSnafu {})?;
    }

    let mut file = fs::File::open(config_file).context(IoSnafu {})?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).context(IoSnafu {})?;
    let conf: ConvertConfig = serde_yaml::from_str(&contents).context(YamlSnafu {})?;
    config.set_avif_quality(conf.avif_quality.unwrap_or(70) as i32);
    config.set_support_avif(conf.support_avif.unwrap_or(true));
    config.set_webp_quality(conf.webp_quality.unwrap_or(80) as i32);
    config.set_support_webp(conf.support_webp.unwrap_or(true));
    config.set_png_quality(conf.png_quality.unwrap_or(80) as i32);
    config.set_support_png(conf.support_png.unwrap_or(true));
    config.set_jpeg_quality(conf.jpeg_quality.unwrap_or(80) as i32);
    config.set_support_jpeg(conf.support_jpeg.unwrap_or(true));
    Ok(())
}

fn init_logger() -> Result<()> {
    let timer = tracing_subscriber::fmt::time::OffsetTime::local_rfc_3339().unwrap_or_else(|_| {
        tracing_subscriber::fmt::time::OffsetTime::new(
            time::UtcOffset::from_hms(0, 0, 0).unwrap(),
            time::format_description::well_known::Rfc3339,
        )
    });
    if cfg!(debug_assertions) {
        let subscriber = FmtSubscriber::builder()
            .with_max_level(Level::INFO)
            .with_timer(timer)
            .with_ansi(false)
            .finish();
        tracing::subscriber::set_global_default(subscriber)
            .expect("setting default subscriber failed");
    } else {
        let log_file = get_config_file()
            .unwrap()
            .parent()
            .unwrap()
            .join("image-converter.log");

        let log_file = File::create(log_file).context(IoSnafu {})?;
        let subscriber = tracing_subscriber::fmt()
            .with_writer(Mutex::new(log_file))
            .with_max_level(Level::INFO)
            .with_timer(timer)
            .with_ansi(false)
            .finish();

        tracing::subscriber::set_global_default(subscriber)
            .expect("setting default subscriber failed");
    }
    Ok(())
}

fn main() -> Result<()> {
    let app = AppWindow::new().context(PlatformSnafu {})?;
    load_config(&app.global::<Config>())?;
    init_logger()?;

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
                if let Err(err) = app_image_list.upgrade_in_event_loop(move |h| {
                    let size = dot_count % 3;
                    h.set_select_btn_text(SharedString::from("...".substring(0, size + 1)));
                }) {
                    error!(
                        category = "event-loop",
                        err = err.to_string(),
                    );
                };
              },
              recv(update_receiver) -> result => {
                if let Err(err) = result {
                    error!(
                        category = "recv",
                        err = err.to_string(),
                    );
                    return;
                }
                // error已处理
                let count = result.unwrap_or_default();
                if count == 0 {
                    dot_count = 0;
                }
                if let Err(err) = app_image_list.upgrade_in_event_loop(move |h| {
                    // 只要已初始化则不会异常，因此直接使用unwrap
                    let mut state = state::lock().unwrap();
                    h.set_values(state.get_values());
                    let total = state.count();
                    let tips = format!(" ({count}/{total})");
                    h.set_processing_tips(SharedString::from(tips));
                    if total == count as usize {
                        state.processing = false;
                        h.set_processing(state.processing);
                    }
                }) {
                    error!(
                        category = "event-loop",
                        err = err.to_string(),
                    );
                }
              },
            }
        }
    });

    let app_show_open_dialog = app.as_weak();
    app.on_show_open_dialog(move || {
        // state 只要初始化则不会异常
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
            if let Ok(file) = get_config_file() {
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
                // to yml不会失败，因此使用unwrap
                if let Err(err) = fs::write(file, serde_yaml::to_string(&conf).unwrap()) {
                    error!(category = "fs-write", err = err.to_string());
                }
            }
        }
        match state.select_files() {
            Ok(_) => {
                if state.count() == 0 {
                    return;
                }
                let processing = state.processing;
                if let Err(err) = app_show_open_dialog.upgrade_in_event_loop(move |h| {
                    h.set_select_btn_text(SharedString::from("..."));
                    h.set_processing(processing);
                }) {
                    error!(category = "event-loop", err = err.to_string(),);
                }
            }
            Err(err) => {
                error!(category = "select-files", err = err.to_string());
            }
        }
    });
    app.set_columns(state::State::get_columns());

    app.run().context(PlatformSnafu {})
}
