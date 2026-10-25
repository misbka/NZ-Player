use serde::{Deserialize, Serialize};

/// Uma faixa da biblioteca, com os metadados lidos via `lofty`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: u32,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub track_no: u32,
    pub has_cover: bool,
}

/// Modo de repetição do player.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum RepeatMode {
    #[default]
    Off,
    All,
    One,
}

impl RepeatMode {
    pub fn next(self) -> Self {
        match self {
            RepeatMode::Off => RepeatMode::All,
            RepeatMode::All => RepeatMode::One,
            RepeatMode::One => RepeatMode::Off,
        }
    }
}

/// Snapshot do player enviado ao frontend a cada ~200ms pelo `Channel`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStatus {
    pub playing: bool,
    pub has_track: bool,
    pub current_index: Option<usize>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub repeat: RepeatMode,
}

impl Default for PlayerStatus {
    fn default() -> Self {
        Self {
            playing: false,
            has_track: false,
            current_index: None,
            position_ms: 0,
            duration_ms: 0,
            volume: 0.8,
            repeat: RepeatMode::Off,
        }
    }
}

/// Uma linha da letra com o instante (em milissegundos) em que ela deve ser exibida.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

/// Resposta da busca de letra (lrclib.net) já processada.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResult {
    pub found: bool,
    pub synced: bool,
    pub lines: Vec<LyricLine>,
    pub plain: Option<String>,
    pub source: Option<String>,
    pub message: Option<String>,
}

impl LyricsResult {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            found: false,
            synced: false,
            lines: Vec::new(),
            plain: None,
            source: None,
            message: Some(message.into()),
        }
    }
}
