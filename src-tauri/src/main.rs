// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod pty;

use commands::*;
use commands::pty_commands::PtyState;

fn main() {
    tauri::Builder::default()
        .manage(PtyState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            create_pty_session,
            write_to_pty,
            resize_pty,
            close_pty_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
