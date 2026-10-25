import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MicVocal, SearchX } from "lucide-react";
import type { LyricsResult } from "../types";

interface Props {
  lyrics: LyricsResult | null;
  loading: boolean;
  positionMs: number;
  playing: boolean;
  onRetry: () => void;
}

/** Finds the index of the line that should be highlighted right now. */
function activeLineIndex(lines: LyricsResult["lines"], positionMs: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let answer = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time_ms <= positionMs) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}

export default function LyricsPanel({ lyrics, loading, positionMs, playing, onRetry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeout = useRef<number | undefined>(undefined);

  const synced = lyrics?.synced ?? false;
  const active = useMemo(
    () => (synced && lyrics ? activeLineIndex(lyrics.lines, positionMs) : -1),
    [lyrics, synced, positionMs],
  );

  // Keep the active line centered, unless the user scrolled on their own.
  useEffect(() => {
    if (active < 0 || userScrolling) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    el?.scrollIntoView({ block: "center", behavior: playing ? "smooth" : "auto" });
  }, [active, userScrolling, playing]);

  const handleScroll = () => {
    setUserScrolling(true);
    window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => setUserScrolling(false), 2500);
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/8 bg-white/4 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <MicVocal size={15} className="text-accent-400" />
          <h2 className="text-sm font-semibold tracking-wide text-white">Letra</h2>
        </div>
        {lyrics?.synced && (
          <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-300">
            sincronizada
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-5"
      >
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 size={24} className="animate-spin text-accent-500" />
            <p className="text-sm">Procurando letra em lrclib.net…</p>
          </div>
        )}

        {!loading && !lyrics?.found && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <SearchX size={30} className="text-zinc-600" />
            <p className="max-w-[16rem] text-sm text-zinc-500">
              {lyrics?.message ?? "Nenhuma letra disponível para esta faixa."}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-accent-500/50 hover:text-accent-300"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && lyrics?.found && !lyrics.synced && lyrics.plain && (
          <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-400">
            {lyrics.plain}
            <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-600">
              letra sem sincronia de tempo
            </p>
          </div>
        )}

        {!loading && lyrics?.found && lyrics.synced && (
          <ul className="flex flex-col gap-1">
            {lyrics.lines.map((line, index) => {
              const isActive = index === active;
              const isPast = index < active;
              return (
                <li
                  key={`${line.time_ms}-${index}`}
                  data-line={index}
                  className={`cursor-pointer rounded-lg px-2 py-1.5 text-[15px] leading-6 transition-all duration-200 ${
                    isActive
                      ? "scale-[1.02] bg-accent-500/12 font-semibold text-white"
                      : isPast
                        ? "text-zinc-600"
                        : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {line.text || "♪"}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="border-t border-white/8 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-600">
        fonte: lrclib.net
      </p>
    </div>
  );
}
