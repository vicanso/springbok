use crossbeam_channel::{select, tick, unbounded};
use slint::ComponentHandle;
use snafu::{ResultExt, Snafu};
use std::rc::Rc;
use std::time::Duration;

slint::include_modules!();

mod state;

#[derive(Debug, Snafu)]
enum Error {
    #[snafu(display("Platform: {source}"))]
    Platform { source: slint::PlatformError },
}
type Result<T, E = Error> = std::result::Result<T, E>;

// https://github.com/slint-ui/slint/issues/747

fn main() -> Result<()> {
    let app = Rc::new(AppWindow::new().context(PlatformSnafu {})?);

    let (update_sender, update_receiver) = unbounded::<i64>();

    // https://docs.rs/crossbeam-channel/latest/crossbeam_channel/

    state::must_new_state(update_sender);

    let app_weak = app.as_weak();
    std::thread::spawn(move || {
        let ticker = tick(Duration::from_secs(2));
        loop {
            select! {
              recv(ticker) -> _ => {},
              recv(update_receiver) -> _ => {
                println!("update receiver");
                // TODO error的处理
                    app_weak.upgrade_in_event_loop(|h| {
                    let state = state::lock().unwrap();
                    h.set_values(state.get_values());
                })
                .unwrap();
              },
            }
        }
    });
    let ui_show_open_dialog = app.clone();
    app.on_show_open_dialog(move || {
        // TODO error 处理
        let mut state = state::lock().unwrap();
        if state.select_files().unwrap() {
            ui_show_open_dialog.set_processing(state.processing);
        }
    });
    app.set_columns(state::State::get_columns());
    // app.as_weak().upgrade_in_event_loop(|h| {
    //     print!("H");
    // });
    // handle
    //     .clone()
    //     .upgrade_in_event_loop(|h| {
    //         h.set_status("".into());
    //         h.set_is_building(true);
    //         let diagnostics_model = Rc::new(VecModel::<Diag>::default());
    //         h.set_diagnostics(ModelRc::from(
    //             diagnostics_model.clone() as Rc<dyn Model<Data = Diag>>
    //         ));
    //     })
    // app.window().set_rendering_notifier(|| Ok(()));

    app.run().context(PlatformSnafu {})
}
