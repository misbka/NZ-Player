import { Disc3, Music4 } from "lucide-react";
import type { Track } from "../types";
import { fileNameOf } from "../lib/format";

interface Props {
  track: Track | null;
  coverUrl: string | null;
  playing: boolean;
}

export default function NowPlaying({ track, coverUrl, playing }: Props) {
  if (!track) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="grid h-56 w-56 place-items-center rounded-3xl border border-dashed border-white/12 bg-white/3">
          <Music4 size={54} className="text-zinc-700" />
        </div>
        <div>
          <p className="text-lg font-semibold text-zinc-300">Nada tocando</p>
          <p className="mt-1 max-w-xs text-sm text-zinc-500">
            Adicione músicas à biblioteca e dê duplo clique em uma faixa para começar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="nz-fade-up flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div className="relative">
        <div
          className={`absolute -inset-3 rounded-[2rem] bg-accent-500/20 blur-2xl ${
            playing ? "opacity-100" : "opacity-40"
          }`}
        />
        {coverUrl ? (
          <img
            key={coverUrl}
            src={coverUrl}
            alt={`Capa de ${track.album || track.title}`}
            className="relative h-64 w-64 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
            draggable={false}
          />
        ) : (
          <div className="relative grid h-64 w-64 place-items-center rounded-2xl bg-gradient-to-br from-ink-800 to-ink-950 ring-1 ring-white/10">
            <Disc3
              size={92}
              className={`text-accent-500/70 ${playing ? "animate-spin [animation-duration:6s]" : ""}`}
            />
          </div>
        )}
      </div>

      <div className="max-w-md px-2">
        <h1 className="truncate text-2xl font-bold tracking-tight text-white">{track.title}</h1>
        <p className="mt-1 truncate text-sm font-medium text-accent-400">
          {track.artist || "Artista desconhecido"}
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {track.album || "Álbum desconhecido"}
        </p>
        <p className="mt-3 truncate text-[11px] text-zinc-700" title={track.path}>
          {fileNameOf(track.path)}
        </p>
      </div>
    </div>
  );
}
