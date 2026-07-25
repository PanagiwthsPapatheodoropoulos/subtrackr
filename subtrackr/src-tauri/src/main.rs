// src-tauri/src/main.rs
// Prevents an extra console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // Deep-link handler — lets the app handle subtrackr:// URLs
        // (used for OAuth callbacks like Gmail import on desktop)
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            // Restore window position/size from previous session
            // (Tauri handles this automatically with window state plugin)
            #[cfg(debug_assertions)]
            window.open_devtools();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SubTrackr");
}