mod commands;
mod lyrics;
mod metadata;
mod models;
mod player;

use tauri::Manager;

use player::PlayerHandle;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // O motor de áudio (thread própria + canal de comandos) fica
            // disponível para todos os comandos via `State<PlayerHandle>`.
            app.manage(PlayerHandle::start(app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // biblioteca
            commands::open_files,
            commands::open_folder,
            commands::get_playlist,
            commands::remove_track,
            commands::clear_playlist,
            commands::get_cover,
            // playback
            commands::get_status,
            commands::play_index,
            commands::toggle_play,
            commands::play,
            commands::pause,
            commands::stop,
            commands::next_track,
            commands::previous_track,
            commands::seek,
            commands::set_volume,
            commands::set_repeat,
            commands::cycle_repeat,
            // tempo real + letras
            commands::watch_status,
            commands::fetch_lyrics,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o NZ Player");
}
