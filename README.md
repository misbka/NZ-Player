# NZ Player 🎵

A local audio player (Windows Media Player / Spotify style) built with **Tauri v2** — featuring a **Rust backend** (`rodio` + `lofty` + `reqwest`) and a **React + Vite + TailwindCSS frontend**, with **real-time synchronized lyrics** powered by [lrclib.net](https://lrclib.net).

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Desktop | Tauri v2 (`tauri`, `tauri-build`) |
| Audio | `rodio` 0.20 (codecs via Symphonia → reliable *seeking*) |
| Metadata / Album Art | `lofty` (ID3, Vorbis, FLAC, MP4, etc.) |
| Networking / Lyrics | `reqwest` (rustls) + `serde` + `serde_json` + `tokio` |
| Native Dialogs | `rfd` (files and folders) |
| Frontend | React 19 + Vite 6 + TailwindCSS 4 + Lucide + `@tauri-apps/api` |

## Project Structure

```text
.
├── index.html
├── package.json
├── vite.config.ts
├── scripts/generate-icons.mjs     # Generates PNG/ICO icons
├── src/                           # Frontend (React)
│   ├── App.tsx                    # Layout + global state
│   ├── main.tsx / index.css / types.ts
│   ├── components/
│   │   ├── TrackList.tsx          # Library / playlist
│   │   ├── NowPlaying.tsx         # Album art + title/artist/album
│   │   ├── TransportControls.tsx  # Play/pause/next/previous/stop/repeat/volume
│   │   ├── ProgressBar.tsx        # Click-and-drag seeking
│   │   ├── VolumeSlider.tsx
│   │   └── LyricsPanel.tsx        # Synchronized lyrics
│   └── lib/
│       ├── api.ts                 # invoke() wrappers
│       ├── usePlayerStatus.ts     # Subscribes to the status Channel
│       └── format.ts
└── src-tauri/                     # Backend (Rust)
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── main.rs / lib.rs
        ├── models.rs              # Track, PlayerStatus, RepeatMode, LyricsResult
        ├── metadata.rs            # lofty: tags, duration, album art, folder scanning
        ├── player.rs              # Audio thread (OutputStream + Sink) + commands
        ├── lyrics.rs              # lrclib.net + LRC parser
        └── commands.rs            # Tauri commands exposed to the frontend
```

## Getting Started

```bash
# 1. Generate icons (one-time setup)
npm run icons

# 2. Install dependencies
npm install

# 3. Run in development mode (Vite + Tauri)
npm run tauri dev

# 4. Build for production
npm run tauri build
```

> **Requirements:** Rust (stable) + Node.js 18+. On Windows, WebView2 is usually already installed.

## Features

- **Playback:** Play, pause, stop, next, and previous; clickable/draggable progress bar with current and total playback time; volume control with icon and slider; repeat modes (off / repeat all / repeat one).
- **Music Library:** Add individual files or entire folders using the native file dialog; track list displaying title, artist, album, and duration; remove individual tracks, clear the entire list, double-click to play, and highlight the currently playing track.
- **Interface:** Album art extracted from metadata tags; prominently displayed metadata; modern, responsive dark theme; `Space` keyboard shortcut for play/pause.
- **Lyrics (Key Feature):** The backend queries `lrclib.net/api/get` (with a fallback to `/api/search`), parses the LRC format (`[mm:ss.xx]`, multiple timestamps, metadata), and returns lines with their corresponding `time_ms` values. The frontend highlights the current line and automatically scrolls as the song progresses. Synchronization is handled through `Channel<PlayerStatus>`, updated every 200 ms.

  When lyrics are unavailable, a friendly message is displayed along with a "Try Again" button.

## Real-Time Data Flow

```text
audio thread ──(status every 50ms)──▶ Arc<Mutex<PlayerStatus>>
                                           │
Tauri command ──▶ UnboundedSender<Cmd> ──▶ engine (50ms loop)
                                           │
                       watch_status(Channel) ──▶ 200ms ──▶ React
                                           │
                       fetch_lyrics ──▶ lrclib.net ──▶ LRC parser
```

The playback position is retrieved using `Sink::get_pos()` (which correctly freezes when paused and is updated when seeking), combined with an `offset` used exclusively as a fallback when reloading the audio file.
