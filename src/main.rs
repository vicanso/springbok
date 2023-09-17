use crossbeam_channel::{select, tick, unbounded};
use slint::ComponentHandle;
use slint::SharedString;
use snafu::{ResultExt, Snafu};
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

// https://github.com/slint-ui/slint/issues/747

fn main() -> Result<()> {
    let app = AppWindow::new().context(PlatformSnafu {})?;

    let (update_sender, update_receiver) = unbounded::<i64>();

    // https://docs.rs/crossbeam-channel/latest/crossbeam_channel/

    state::must_new_state(update_sender);

    // app.set_webp_quality(80);

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
    // app.on_toggle_support_avif(|| {
    //     // TODO error 处理
    //     let mut state = state::lock().unwrap();
    //     state.toggle_avif();
    // });
    // app.on_toggle_support_webp(|| {
    //     // TODO error 处理
    //     let mut state = state::lock().unwrap();
    //     state.toggle_webp();
    // });

    let app_show_open_dialog = app.as_weak();
    app.on_show_open_dialog(move || {
        let mut state = state::lock().unwrap();
        if let Some(app) = app_show_open_dialog.upgrade() {
            let config = app.global::<Config>();
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
        }
        if state.select_files().unwrap() {
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
