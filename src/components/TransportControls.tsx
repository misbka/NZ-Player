import { Pause, Play, Repeat, Repeat1, Square, SkipBack, SkipForward } from "lucide-react";
import type { RepeatMode } from "../types";
import ProgressBar from "./ProgressBar";
import VolumeSlider from "./VolumeSlider";

interface Props {
  playing: boolean;
  hasTrack: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  repeat: RepeatMode;
  onToggle: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (ms: number) => void;
  onVolume: (v: number) => void;
  onCycleRepeat: () => void;
}

export default function TransportControls(props: Props) {
  const {
    playing,
    hasTrack,
    positionMs,
    durationMs,
    volume,
    repeat,
    onToggle,
    onStop,
    onNext,
    onPrevious,
    onSeek,
    onVolume,
    onCycleRepeat,
  } = props;

  const repeatTitle =
    repeat === "off"
      ? "Repetição desligada"
      : repeat === "all"
        ? "Repetir playlist"
        : "Repetir faixa atual";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/4 p-4 backdrop-blur">
      <ProgressBar
        positionMs={positionMs}
        durationMs={durationMs}
        disabled={!hasTrack}
        onSeek={onSeek}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title={repeatTitle}
            onClick={onCycleRepeat}
            className={`relative grid h-9 w-9 place-items-center rounded-full transition ${
              repeat === "off"
                ? "text-zinc-400 hover:bg-white/10 hover:text-white"
                : "text-accent-400 hover:bg-white/10"
            }`}
          >
            {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            {repeat !== "off" && (
              <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent-400" />
            )}
          </button>

          <button
            type="button"
            title="Faixa anterior"
            onClick={onPrevious}
            disabled={!hasTrack}
            className="grid h-10 w-10 place-items-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            title={playing ? "Pausar" : "Reproduzir"}
            onClick={onToggle}
            className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink-950 shadow-[0_8px_30px_rgba(139,92,246,0.35)] transition hover:scale-105 active:scale-95"
          >
            {playing ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            title="Próxima faixa"
            onClick={onNext}
            disabled={!hasTrack}
            className="grid h-10 w-10 place-items-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            type="button"
            title="Parar"
            onClick={onStop}
            disabled={!hasTrack}
            className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>

        <VolumeSlider volume={volume} onChange={onVolume} />
      </div>
    </div>
  );
}
