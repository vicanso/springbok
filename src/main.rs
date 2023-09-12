use crossbeam_channel::{select, tick, unbounded};
use slint::ComponentHandle;
use snafu::{ResultExt, Snafu};
use std::time::Duration;

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

    let app_image_list = app.as_weak();
    std::thread::spawn(move || {
        let ticker = tick(Duration::from_millis(500));
        loop {
            select! {
              recv(ticker) -> _ => {},
              recv(update_receiver) -> result => {
                // TODO error的处理
                let count = result.unwrap_or_default();
                app_image_list.upgrade_in_event_loop(move |h| {
                    let mut state = state::lock().unwrap();
                    h.set_values(state.get_values());
                    if state.count() == count as usize {
                        state.processing = false;
                        h.set_processing(state.processing);
                    }
                })
                .unwrap();
              },
            }
        }
    });
    // let ui_show_open_dialog = app.clone();
    let app_show_open_dialog = app.as_weak();
    app.on_show_open_dialog(move || {
        // TODO error 处理
        let mut state = state::lock().unwrap();
        if state.select_files().unwrap() {
            let processing = state.processing;
            app_show_open_dialog
                .upgrade_in_event_loop(move |h| {
                    h.set_processing(processing);
                })
                .unwrap();
        }
    });
    app.set_columns(state::State::get_columns());

    app.run().context(PlatformSnafu {})
}
