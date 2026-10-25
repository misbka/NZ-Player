# NZ Player 🎵

Player de áudio local (estilo Windows Media Player / Spotify) construído com **Tauri v2** —
backend em **Rust** (`rodio` + `lofty` + `reqwest`) e frontend **React + Vite + TailwindCSS**,
com **letras sincronizadas em tempo real** via [lrclib.net](https://lrclib.net).

## Stack

| Camada | Tecnologias |
| --- | --- |
| Desktop | Tauri v2 (`tauri`, `tauri-build`) |
| Áudio | `rodio` 0.20 (codecs via Symphonia → *seek* confiável) |
| Metadados/capas | `lofty` (ID3, Vorbis, FLAC, MP4…) |
| Rede/letras | `reqwest` (rustls) + `serde` + `serde_json` + `tokio` |
| Diálogos nativos | `rfd` (arquivos e pastas) |
| Frontend | React 19 + Vite 6 + TailwindCSS 4 + Lucide + `@tauri-apps/api` |

## Estrutura

```
.
├── index.html
├── package.json
├── vite.config.ts
├── scripts/generate-icons.mjs     # gera os ícones PNG/ICO
├── src/                           # frontend (React)
│   ├── App.tsx                    # layout + estado global
│   ├── main.tsx / index.css / types.ts
│   ├── components/
│   │   ├── TrackList.tsx          # biblioteca / playlist
│   │   ├── NowPlaying.tsx         # capa + título/artista/álbum
│   │   ├── TransportControls.tsx  # play/pause/next/prev/stop/repetição/volume
│   │   ├── ProgressBar.tsx        # seek por clique/arraste
│   │   ├── VolumeSlider.tsx
│   │   └── LyricsPanel.tsx        # letra sincronizada
│   └── lib/
│       ├── api.ts                 # wrappers de invoke()
│       ├── usePlayerStatus.ts     # assina o Channel de status
│       └── format.ts
└── src-tauri/                     # backend (Rust)
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── main.rs / lib.rs
        ├── models.rs              # Track, PlayerStatus, RepeatMode, LyricsResult
        ├── metadata.rs            # lofty: tags, duração, capa, varredura de pastas
        ├── player.rs              # thread de áudio (OutputStream + Sink) + comandos
        ├── lyrics.rs              # lrclib.net + parser LRC
        └── commands.rs            # comandos Tauri expostos ao frontend
```

## Como rodar

```bash
# 1. ícones (uma única vez)
npm run icons

# 2. dependências
npm install

# 3. modo desenvolvimento (Vite + Tauri)
npm run tauri dev

# 4. build de produção
npm run tauri build
```

> Requisitos: Rust (stable) + Node 18+. No Windows, o WebView2 já costuma estar instalado.

## Funcionalidades

- **Playback**: play, pause, stop, próxima, anterior; barra de progresso clicável/arrastável
  com tempo atual/total; volume com ícone + slider; modos de repetição (desligada / tudo / uma).
- **Biblioteca**: adicionar arquivos ou pastas inteiras pelo diálogo nativo, lista com
  título/artista/álbum/duração, remoção individual, limpar lista, duplo clique para tocar e
  destaque da faixa atual.
- **Interface**: capa extraída das tags, metadados em destaque, tema escuro moderno e
  responsivo, atalho de `Espaço` para play/pause.
- **Letras (destaque)**: o backend consulta `lrclib.net/api/get` (com *fallback* para
  `/api/search`), faz o parser do formato LRC (`[mm:ss.xx]`, múltiplos timestamps, metadados),
  devolve as linhas já com `time_ms` e o frontend destaque/rolagem automática da linha atual —
  sincronia via `Channel<PlayerStatus>` atualizado a cada 200 ms.
  Sem letra: mensagem amigável + botão "Tentar novamente".

## Fluxo de tempo real

```
thread de áudio ──(status a cada 50ms)──▶ Arc<Mutex<PlayerStatus>>
                                              │
comando Tauri ──▶ UnboundedSender<Cmd> ──▶ motor (loop 50ms)
                                              │
                          watch_status(Channel) ──▶ 200ms ──▶ React
                                              │
                          fetch_lyrics ──▶ lrclib.net ──▶ parser LRC
```

A posição é lida com `Sink::get_pos()` (congela corretamente no pause e é reposicionada no
*seek*), somada a um `offset` usado apenas no *fallback* de recarregamento do arquivo.
