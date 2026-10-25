use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::read_from_path;
use lofty::tag::Accessor;

use crate::models::Track;

/// Extensões reconhecidas como áudio.
pub const AUDIO_EXTENSIONS: [&str; 13] = [
    "mp3", "flac", "ogg", "oga", "opus", "wav", "m4a", "aac", "mp4", "aiff", "aif", "wma", "ape",
];

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

pub fn next_id() -> u32 {
    NEXT_ID.fetch_add(1, Ordering::Relaxed)
}

pub fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .map(|ext| {
            let ext = ext.to_string_lossy().to_lowercase();
            AUDIO_EXTENSIONS.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

fn file_name_fallback(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Sem título".to_string())
}

/// Lê título/artista/álbum/duração/capa de um arquivo de áudio.
pub fn read_track(path: &Path) -> Track {
    let mut title = file_name_fallback(path);
    let mut artist = "Artista desconhecido".to_string();
    let mut album = "Álbum desconhecido".to_string();
    let mut duration_ms = 0u64;
    let mut track_no = 0u32;
    let mut has_cover = false;

    if let Ok(tagged) = read_from_path(path) {
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(value) = tag.title() {
                if !value.trim().is_empty() {
                    title = value.trim().to_string();
                }
            }
            if let Some(value) = tag.artist() {
                if !value.trim().is_empty() {
                    artist = value.trim().to_string();
                }
            }
            if let Some(value) = tag.album() {
                if !value.trim().is_empty() {
                    album = value.trim().to_string();
                }
            }
            if let Some(value) = tag.track() {
                track_no = value;
            }
            has_cover = !tag.pictures().is_empty();
        }

        duration_ms = tagged.properties().duration().as_millis() as u64;
    }

    Track {
        id: next_id(),
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration_ms,
        track_no,
        has_cover,
    }
}

fn less(a: &Track, b: &Track) -> std::cmp::Ordering {
    let key = |t: &Track| if t.track_no == 0 { u32::MAX } else { t.track_no };
    key(a).cmp(&key(b)).then_with(|| a.title.cmp(&b.title))
}

/// Lê um conjunto de caminhos (arquivos selecionados pelo diálogo).
pub fn read_tracks(paths: Vec<PathBuf>) -> Vec<Track> {
    let mut tracks: Vec<Track> = paths
        .iter()
        .filter(|p| is_audio_file(p))
        .map(|p| read_track(p))
        .collect();
    tracks.sort_by(less);
    tracks
}

/// Varre uma pasta (recursivamente) e lê todas as faixas encontradas.
pub fn read_folder(folder: &Path) -> Vec<Track> {
    let mut files = Vec::new();
    collect_audio_files(folder, &mut files);
    files.sort();
    read_tracks(files)
}

fn collect_audio_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            collect_audio_files(&path, out);
        } else if meta.is_file() && is_audio_file(&path) {
            out.push(path);
        }
    }
}

/// Extrai a capa embutida no arquivo. Retorna `(mime, bytes)`.
pub fn extract_cover(path: &Path) -> Option<(String, Vec<u8>)> {
    let tagged = read_from_path(path).ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let picture = tag.pictures().first()?;

    let mime = picture
        .mime_type()
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| "image/jpeg".to_string());

    Some((mime, picture.data().to_vec()))
}
