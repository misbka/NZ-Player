use std::sync::OnceLock;
use std::time::Duration;

use serde::Deserialize;

use crate::models::{LyricLine, LyricsResult};

const GET_URL: &str = "https://lrclib.net/api/get";
const SEARCH_URL: &str = "https://lrclib.net/api/search";
const USER_AGENT: &str = "NZ-Player/0.1 (desktop audio player; +https://lrclib.net)";

/// Resposta crua do lrclib.net (a API devolve campos extras, por isso `#[serde(default)]`).
#[derive(Debug, Clone, Deserialize)]
struct LrclibTrack {
    #[serde(default, rename = "trackName")]
    #[allow(dead_code)]
    track_name: Option<String>,
    #[serde(default, rename = "artistName")]
    #[allow(dead_code)]
    artist_name: Option<String>,
    #[serde(default, rename = "instrumentals")]
    instrumentals: Option<bool>,
    #[serde(default, rename = "plainLyrics")]
    plain_lyrics: Option<String>,
    #[serde(default, rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(12))
            .connect_timeout(Duration::from_secs(8))
            .build()
            .unwrap_or_default()
    })
}

/// Consulta `lrclib.net/api/get` e, na ausência de resultado, tenta `api/search`.
pub async fn fetch(title: &str, artist: &str, album: &str) -> Result<LyricsResult, String> {
    let title = title.trim();
    let artist = artist.trim();

    if title.is_empty() {
        return Ok(LyricsResult::not_found(
            "Esta faixa não tem título nas tags, então não dá para buscar a letra.",
        ));
    }

    let client = client();

    let direct = client
        .get(GET_URL)
        .query(&[
            ("track_name", title),
            ("artist_name", artist),
            ("album_name", album.trim()),
        ])
        .send()
        .await
        .map_err(|e| format!("Falha ao consultar o lrclib.net: {e}"))?;

    if direct.status().is_success() {
        let track: LrclibTrack = direct
            .json()
            .await
            .map_err(|e| format!("Resposta inválida do lrclib.net: {e}"))?;
        return Ok(build_result(Some(track), "lrclib.net/api/get"));
    }

    if direct.status() != reqwest::StatusCode::NOT_FOUND {
        return Ok(LyricsResult::not_found(format!(
            "O lrclib.net respondeu com HTTP {}.",
            direct.status()
        )));
    }

    // Fallback: busca aproximada.
    let search = client
        .get(SEARCH_URL)
        .query(&[("track_name", title), ("artist_name", artist)])
        .send()
        .await
        .map_err(|e| format!("Falha ao consultar o lrclib.net: {e}"))?;

    if !search.status().is_success() {
        return Ok(LyricsResult::not_found(
            "Nenhuma letra encontrada para esta faixa.",
        ));
    }

    let candidates: Vec<LrclibTrack> = search
        .json()
        .await
        .map_err(|e| format!("Resposta inválida do lrclib.net: {e}"))?;

    match candidates.into_iter().next() {
        Some(track) => Ok(build_result(Some(track), "lrclib.net/api/search")),
        None => Ok(LyricsResult::not_found(
            "Nenhuma letra encontrada para esta faixa.",
        )),
    }
}

fn build_result(track: Option<LrclibTrack>, source: &str) -> LyricsResult {
    let Some(track) = track else {
        return LyricsResult::not_found("Nenhuma letra encontrada para esta faixa.");
    };

    if track.instrumentals.unwrap_or(false) {
        return LyricsResult {
            found: false,
            synced: false,
            lines: Vec::new(),
            plain: None,
            source: Some(source.to_string()),
            message: Some("Esta faixa é instrumental — não há letra.".to_string()),
        };
    }

    if let Some(synced) = track.synced_lyrics {
        let lines = parse_lrc(&synced);
        if !lines.is_empty() {
            return LyricsResult {
                found: true,
                synced: true,
                lines,
                plain: track.plain_lyrics,
                source: Some(source.to_string()),
                message: None,
            };
        }
    }

    match track.plain_lyrics {
        Some(plain) if !plain.trim().is_empty() => LyricsResult {
            found: true,
            synced: false,
            lines: Vec::new(),
            plain: Some(plain),
            source: Some(source.to_string()),
            message: None,
        },
        _ => LyricsResult::not_found("Nenhuma letra encontrada para esta faixa."),
    }
}

/* ------------------------------------------------------------------ */
/* Parser LRC                                                          */
/* ------------------------------------------------------------------ */

/// Converte o formato `[mm:ss.xx] texto` em linhas com timestamps em ms.
///
/// Suporta `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`, `[hh:mm:ss.xx]`, múltiplos
/// timestamps na mesma linha e ignora metadados (`[ar:...]`, `[ti:...]`, ...).
pub fn parse_lrc(raw: &str) -> Vec<LyricLine> {
    let mut lines: Vec<LyricLine> = Vec::new();

    for source_line in raw.lines() {
        let line = source_line.trim();
        if line.is_empty() {
            continue;
        }

        let bytes = line.as_bytes();
        let mut cursor = 0usize;
        let mut times: Vec<u64> = Vec::new();

        while cursor < bytes.len() && bytes[cursor] == b'[' {
            let Some(relative_end) = line[cursor..].find(']') else {
                break;
            };
            let end = cursor + relative_end;
            let tag = &line[cursor + 1..end];
            match parse_timestamp(tag) {
                Some(ms) => {
                    times.push(ms);
                    cursor = end + 1;
                }
                // Não é um timestamp (ex.: `[ar:Queen]`) -> o resto é texto.
                None => break,
            }
        }

        if times.is_empty() {
            continue;
        }

        let text = line[cursor..].trim();
        if text.is_empty() {
            continue;
        }

        for time_ms in times {
            lines.push(LyricLine {
                time_ms,
                text: text.to_string(),
            });
        }
    }

    lines.sort_by(|a, b| a.time_ms.cmp(&b.time_ms));
    lines
}

/// `mm:ss` / `mm:ss.xx` / `mm:ss.xxx` / `hh:mm:ss.xx` -> milissegundos.
fn parse_timestamp(tag: &str) -> Option<u64> {
    let parts: Vec<&str> = tag.split(':').collect();
    if !(2..=3).contains(&parts.len()) {
        return None;
    }

    // A(s) primeira(s) parte(s) precisam ser numéricas para ser um timestamp.
    let (minutes, seconds_part) = if parts.len() == 3 {
        let hours: u64 = parts[0].trim().parse().ok()?;
        let minutes: u64 = parts[1].trim().parse().ok()?;
        (hours * 60 + minutes, parts[2])
    } else {
        let minutes: u64 = parts[0].trim().parse().ok()?;
        (minutes, parts[1])
    };

    let (seconds_str, fraction_str) = match seconds_part.split_once('.') {
        Some((s, f)) => (s, f),
        None => (seconds_part, ""),
    };

    let seconds: u64 = seconds_str.trim().parse().ok()?;
    if seconds >= 60 {
        return None;
    }

    let fraction_ms = match fraction_str.len() {
        0 => 0,
        1 => fraction_str.parse::<u64>().ok()? * 100,
        2 => fraction_str.parse::<u64>().ok()? * 10,
        3 => fraction_str.parse::<u64>().ok()?,
        _ => fraction_str[..3].parse::<u64>().ok()?,
    };

    Some(minutes * 60_000 + seconds * 1_000 + fraction_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_lrc() {
        let raw = "[ar:Queen]\n[00:12.50]linha um\n[00:15.00][01:02.300]repetida\n[00:20]linha três";
        let lines = parse_lrc(raw);
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0].time_ms, 12_500);
        assert_eq!(lines[0].text, "linha um");
        assert_eq!(lines[1].time_ms, 15_000);
        assert_eq!(lines[2].time_ms, 20_000);
        assert_eq!(lines[3].time_ms, 62_300);
        assert_eq!(lines[3].text, "repetida");
    }

    #[test]
    fn ignores_metadata_and_supports_hours() {
        assert_eq!(parse_timestamp("ar:Queen"), None);
        assert_eq!(parse_timestamp("1:02.5"), Some(62_500));
        assert_eq!(parse_timestamp("01:02:03.250"), Some(3_723_250));
    }
}
