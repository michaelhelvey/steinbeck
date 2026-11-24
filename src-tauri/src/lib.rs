pub mod analysis;
pub mod commands;
pub mod dictionary;

use tauri::Manager;

use commands::Engine;
use dictionary::UserDictionary;

/// The name of the user dictionary file in the app data directory.
const DICTIONARY_FILE: &str = "dictionary.txt";

/// Builds and runs the Steinbeck Tauri application.
///
/// In debug builds, this function also attaches the log plugin at `Info` level, and at `Debug`
/// level for this crate.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::analyze,
            commands::add_to_dictionary,
            commands::read_file,
            commands::write_file,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .level_for("steinbeck_lib", log::LevelFilter::Debug)
                        .build(),
                )?;
            }

            let dictionary = app.path().app_data_dir()?.join(DICTIONARY_FILE);
            log::info!("user dictionary: {}", dictionary.display());
            app.manage(Engine::new(UserDictionary::new(dictionary)));

            let handle = app.handle().clone();
            std::thread::spawn(move || handle.state::<Engine>().warm_up());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
