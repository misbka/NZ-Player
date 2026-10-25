import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Music2, X } from "lucide-react";
import TrackList from "./components/TrackList";
import NowPlaying from "./components/NowPlaying";
import TransportControls from "./components/TransportControls";
import LyricsPanel from "./components/LyricsPanel";
import { usePlayerStatus } from "./lib/usePlayerStatus";
import * as api from "./lib/api";
import type { LyricsResult, Track } from "./types";

export default function App() {
  const { status, lastError, setLastError } = usePlayerStatus();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsAttempt, setLyricsAttempt] = useState(0);

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const currentTrack =
    status.current_index !== null ? (tracks[status.current_index] ?? null) : null;
  const currentTrackId = currentTrack?.id ?? null;

  /* -------------------------------------------------- bootstrap ------ */
  useEffect(() => {
    api
      .getPlaylist()
      .then(setTracks)
      .catch(() => undefined);
  }, []);

  /* ----------------------------------- cover + lyrics for current ---- */
  useEffect(() => {
    if (currentTrackId === null) {
      setCoverUrl(null);
      setLyrics(null);
      setLyricsLoading(false);
      return;
    }

    let cancelled = false;
    const index = tracksRef.current.findIndex((t) => t.id === currentTrackId);
    const track = index >= 0 ? tracksRef.current[index] : null;

    setCoverUrl(null);
    setLyrics(null);
    setLyricsLoading(true);

    if (index >= 0) {
      api
        .getCover(index)
        .then((url) => {
          if (!cancelled) setCoverUrl(url);
        })
        .catch(() => undefined);
    }

    if (track) {
      api
        .fetchLyrics(track.title, track.artist, track.album)
        .then((result) => {
          if (cancelled) return;
          setLyrics(result);
          setLyricsLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setLyrics({
            found: false,
            synced: false,
            lines: [],
            plain: null,
            source: null,
            message: `Falha ao consultar o lrclib.net (${String(err)}).`,
          });
          setLyricsLoading(false);
        });
    } else {
      setLyricsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [currentTrackId, lyricsAttempt]);

  /* --------------------------------------------------- keyboard ------- */
  const toggleRef = useRef<() => void>(() => undefined);
  toggleRef.current = () => void safe(api.togglePlay());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleRef.current();
      }
    };
    const onError = (e: Event) => setLastError(String((e as CustomEvent).detail));
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("nz-error", onError);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("nz-error", onError);
    };
  }, [setLastError]);

  /* ---------------------------------------------------- actions ------- */
  const run = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (err) {
      setLastError(String(err));
    } finally {
      setBusy(false);
    }
  }, [setLastError]);

  const openFiles = () =>
    run(async () => {
      const result = await api.openFiles();
      setTracks(result);
    });

  const openFolder = () =>
    run(async () => {
      const result = await api.openFolder();
      setTracks(result);
    });

  const removeTrack = (index: number) =>
    run(async () => {
      const result = await api.removeTrack(index);
      setTracks(result);
    });

  const clearPlaylist = () =>
    run(async () => {
      const result = await api.clearPlaylist();
      setTracks(result);
    });

  const cycleRepeat = () => void safe(api.cycleRepeat());

  const retryLyrics = () => setLyricsAttempt((n) => n + 1);

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(1200px_600px_at_15%_-10%,rgba(124,58,237,0.22),transparent_60%),radial-gradient(900px_500px_at_100%_0%,rgba(16,185,129,0.10),transparent_55%),#07070c]">
      {/* ------------------------------------------------------------ */}
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center justify-between gap-4 border-b border-white/8 px-5 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 shadow-[0_6px_20px_rgba(124,58,237,0.45)]">
            <Music2 size={17} className="text-white" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide text-white">NZ Player</p>
            <p className="text-[11px] text-zinc-500">reprodutor local · Tauri + React</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-400 sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status.playing ? "animate-pulse bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            {status.playing ? "tocando" : "parado"}
          </span>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[320px_minmax(0,1fr)_340px] lg:overflow-hidden">
        <div className="flex min-h-[380px] flex-col lg:min-h-0">
          <TrackList
            tracks={tracks}
            currentIndex={status.current_index}
            loading={busy}
            onOpenFiles={openFiles}
            onOpenFolder={openFolder}
            onClear={clearPlaylist}
            onPlay={(index) => void safe(api.playIndex(index))}
            onRemove={removeTrack}
          />
        </div>

        <section className="flex min-h-[520px] min-w-0 flex-col gap-4 lg:min-h-0">
          <NowPlaying track={currentTrack} coverUrl={coverUrl} playing={status.playing} />
          <TransportControls
            playing={status.playing}
            hasTrack={status.has_track}
            positionMs={status.position_ms}
            durationMs={status.duration_ms}
            volume={status.volume}
            repeat={status.repeat}
            onToggle={() => void safe(api.togglePlay())}
            onStop={() => void safe(api.stop())}
            onNext={() => void safe(api.nextTrack())}
            onPrevious={() => void safe(api.previousTrack())}
            onSeek={(ms) => void safe(api.seek(ms))}
            onVolume={(v) => void safe(api.setVolume(v))}
            onCycleRepeat={cycleRepeat}
          />
        </section>

        <div className="flex min-h-[380px] flex-col lg:min-h-0">
          <LyricsPanel
            lyrics={lyrics}
            loading={lyricsLoading}
            positionMs={status.position_ms}
            playing={status.playing}
            onRetry={retryLyrics}
          />
        </div>
      </main>

      {/* ------------------------------------------------------------ */}
      {lastError && (
        <div className="nz-fade-up pointer-events-auto fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/80 px-4 py-2.5 text-sm text-red-200 shadow-xl backdrop-blur">
          <AlertCircle size={16} className="shrink-0" />
          <span className="truncate">{lastError}</span>
          <button
            type="button"
            onClick={() => setLastError(null)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Fire-and-forget helper that surfaces IPC errors as a toast. */
async function safe(task: Promise<unknown>): Promise<void> {
  try {
    await task;
  } catch (err) {
    console.error(err);
    window.dispatchEvent(new CustomEvent("nz-error", { detail: String(err) }));
  }
}
