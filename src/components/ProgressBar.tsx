import { useCallback, useRef, useState } from "react";
import { clamp, formatTime } from "../lib/format";

interface Props {
  positionMs: number;
  durationMs: number;
  disabled?: boolean;
  onSeek: (ms: number) => void;
}

/** Click / drag seek bar with elapsed & total time. */
export default function ProgressBar({ positionMs, durationMs, disabled, onSeek }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const duration = durationMs > 0 ? durationMs : 0;
  const shown = scrub ?? positionMs;
  const percent = duration > 0 ? clamp((shown / duration) * 100, 0, 100) : 0;

  const positionFromEvent = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
    },
    [duration],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setScrub(positionFromEvent(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setScrub(positionFromEvent(e.clientX));
  };

  const commit = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const target = positionFromEvent(e.clientX);
    setScrub(null);
    onSeek(Math.round(target));
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="flex w-full items-center gap-3">
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-400">
        {formatTime(shown)}
      </span>

      <div
        ref={barRef}
        role="slider"
        aria-label="Progresso da música"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(shown)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyDown={(e) => {
          if (disabled || duration <= 0) return;
          if (e.key === "ArrowRight") onSeek(clamp(positionMs + 5000, 0, duration));
          if (e.key === "ArrowLeft") onSeek(clamp(positionMs - 5000, 0, duration));
        }}
        className={`group relative h-4 flex-1 cursor-pointer touch-none ${
          disabled ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/12" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-[width] duration-75"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_0_4px_rgba(139,92,246,0.35)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ left: `${percent}%` }}
        />
      </div>

      <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-400">
        {duration > 0 ? formatTime(duration) : "-:--"}
      </span>
    </div>
  );
}
