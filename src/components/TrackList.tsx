import { Disc3, FilePlus2, FolderPlus, ListX, Trash2 } from "lucide-react";
import type { Track } from "../types";
import { formatTime } from "../lib/format";

interface Props {
  tracks: Track[];
  currentIndex: number | null;
  loading: boolean;
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onClear: () => void;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
}

export default function TrackList({
  tracks,
  currentIndex,
  loading,
  onOpenFiles,
  onOpenFolder,
  onClear,
  onPlay,
  onRemove,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/8 bg-white/4 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Biblioteca</h2>
          <p className="text-[11px] text-zinc-500">{tracks.length} faixa(s)</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Adicionar arquivos"
            onClick={onOpenFiles}
            disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-accent-400 disabled:opacity-40"
          >
            <FilePlus2 size={17} />
          </button>
          <button
            type="button"
            title="Adicionar pasta"
            onClick={onOpenFolder}
            disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-accent-400 disabled:opacity-40"
          >
            <FolderPlus size={17} />
          </button>
          <button
            type="button"
            title="Limpar lista"
            onClick={onClear}
            disabled={loading || tracks.length === 0}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-40"
          >
            <ListX size={17} />
          </button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <Disc3
              size={34}
              className={`text-accent-500 ${loading ? "animate-spin" : "opacity-50"}`}
            />
            <p className="text-sm text-zinc-400">
              {loading ? "Lendo metadados…" : "Sua lista está vazia"}
            </p>
            {!loading && (
              <p className="text-xs leading-relaxed text-zinc-600">
                Use os botões acima para adicionar arquivos MP3/FLAC/OGG ou uma pasta inteira.
              </p>
            )}
          </div>
        ) : (
          <ul className="p-1.5">
            {tracks.map((track, index) => {
              const active = index === currentIndex;
              return (
                <li
                  key={`${track.id}-${track.path}`}
                  onDoubleClick={() => onPlay(index)}
                  className={`group flex cursor-default items-center gap-3 rounded-xl px-3 py-2 transition ${
                    active ? "bg-accent-500/18" : "hover:bg-white/6"
                  }`}
                  title={track.path}
                >
                  <span
                    className={`w-6 shrink-0 text-center text-xs tabular-nums ${
                      active ? "text-accent-400" : "text-zinc-600"
                    }`}
                  >
                    {active ? "▶" : index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        active ? "text-accent-300" : "text-zinc-100"
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {track.artist}
                      {track.album ? ` · ${track.album}` : ""}
                    </p>
                  </div>

                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                    {formatTime(track.duration_ms)}
                  </span>

                  <button
                    type="button"
                    title="Remover da lista"
                    onClick={() => onRemove(index)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="border-t border-white/8 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-600">
        duplo clique para tocar
      </p>
    </div>
  );
}
