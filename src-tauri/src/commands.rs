use std::path::Path as StdPath;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use base64::Engine as _;
use tauri::ipc::Channel;
use tauri::State;

use crate::lyrics;
use crate::metadata;
use crate::models::{LyricsResult, PlayerStatus, RepeatMode, Track};
use crate::player::{Cmd, PlayerHandle};

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/* ------------------------------------------------------------------ */
/* Biblioteca                                                          */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub async fn open_files(state: State<'_, PlayerHandle>) -> Result<Vec<Track>, String> {
    let picked = rfd::AsyncFileDialog::new()
        .set_title("Selecionar arquivos de áudio")
        .add_filter("Músicas", &metadata::AUDIO_EXTENSIONS)
        .pick_files()
        .await;

    let Some(files) = picked else {
        return Ok(state.playlist());
    };

    let paths: Vec<std::path::PathBuf> = files
        .iter()
        .map(|handle| handle.path().to_path_buf())
        .collect();

    let tracks = tauri::async_runtime::spawn_blocking(move || metadata::read_tracks(paths))
        .await
        .map_err(|err| format!("Falha ao ler os metadados: {err}"))?;

    Ok(state.append(tracks))
}

#[tauri::command]
pub async fn open_folder(state: State<'_, PlayerHandle>) -> Result<Vec<Track>, String> {
    let picked = rfd::AsyncFileDialog::new()
        .set_title("Selecionar uma pasta de músicas")
        .pick_folder()
        .await;

    let Some(folder) = picked else {
        return Ok(state.playlist());
    };

    let path = folder.path().to_path_buf();

    let tracks = tauri::async_runtime::spawn_blocking(move || metadata::read_folder(&path))
        .await
        .map_err(|err| format!("Falha ao ler os metadados: {err}"))?;

    Ok(state.append(tracks))
}

#[tauri::command]
pub fn get_playlist(state: State<'_, PlayerHandle>) -> Vec<Track> {
    state.playlist()
}

#[tauri::command]
pub fn remove_track(index: usize, state: State<'_, PlayerHandle>) -> Vec<Track> {
    state.remove(index)
}

#[tauri::command]
pub fn clear_playlist(state: State<'_, PlayerHandle>) -> Vec<Track> {
    state.clear()
}

#[tauri::command]
pub fn get_cover(index: usize, state: State<'_, PlayerHandle>) -> Option<String> {
    let track = lock(&state.playlist).get(index).cloned()?;
    if !track.has_cover {
        return None;
    }

    if let Some(cached) = lock(&state.covers).get(&track.id).cloned() {
        return Some(cached);
    }

    let (mime, data) = metadata::extract_cover(StdPath::new(&track.path))?;
    let url = format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(data)
    );

    lock(&state.covers).insert(track.id, url.clone());
    Some(url)
}

/* ------------------------------------------------------------------ */
/* Playback                                                            */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub fn get_status(state: State<'_, PlayerHandle>) -> PlayerStatus {
    state.status()
}

#[tauri::command]
pub fn play_index(index: usize, state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::PlayIndex(index))
}

#[tauri::command]
pub fn toggle_play(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Toggle)
}

#[tauri::command]
pub fn play(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Play)
}

#[tauri::command]
pub fn pause(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Pause)
}

#[tauri::command]
pub fn stop(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Stop)
}

#[tauri::command]
pub fn next_track(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Next)
}

#[tauri::command]
pub fn previous_track(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Previous)
}

#[tauri::command]
pub fn seek(position_ms: u64, state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::Seek(position_ms))
}

#[tauri::command]
pub fn set_volume(volume: f32, state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::SetVolume(volume))
}

#[tauri::command]
pub fn set_repeat(mode: RepeatMode, state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::SetRepeat(mode))
}

#[tauri::command]
pub fn cycle_repeat(state: State<'_, PlayerHandle>) -> Result<(), String> {
    state.send(Cmd::CycleRepeat)
}

/* ------------------------------------------------------------------ */
/* Tempo real (Channel)                                                */
/* ------------------------------------------------------------------ */

/// Abre um [`Channel`] que recebe um [`PlayerStatus`] a cada ~200ms.
///
/// É esse stream que alimenta a barra de progresso **e** a sincronia da letra.
#[tauri::command]
pub async fn watch_status(
    channel: Channel<PlayerStatus>,
    state: State<'_, PlayerHandle>,
) -> Result<(), String> {
    let status: Arc<Mutex<PlayerStatus>> = Arc::clone(&state.status);

    tauri::async_runtime::spawn(async move {
        loop {
            let snapshot = lock(&status).clone();
            if channel.send(snapshot).is_err() {
                // Frontend desconectou (reload em dev, janela fechada, ...).
                break;
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    });

    Ok(())
}

/* ------------------------------------------------------------------ */
/* Letras (lrclib.net)                                                 */
/* ------------------------------------------------------------------ */

#[tauri::command]
pub async fn fetch_lyrics(
    title: String,
    artist: String,
    album: String,
) -> Result<LyricsResult, String> {
    lyrics::fetch(&title, &artist, &album).await
}
