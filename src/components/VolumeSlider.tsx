import { Volume1, Volume2, VolumeX } from "lucide-react";

interface Props {
  volume: number;
  onChange: (volume: number) => void;
}

export default function VolumeSlider({ volume, onChange }: Props) {
  const Icon = volume <= 0.001 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex w-40 items-center gap-2">
      <button
        type="button"
        title={volume > 0 ? "Mudo" : "Restaurar som"}
        onClick={() => onChange(volume > 0.001 ? 0 : 0.8)}
        className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
      >
        <Icon size={18} />
      </button>

      <input
        className="nz-range w-full"
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(volume * 100)}
        aria-label="Volume"
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </div>
  );
}
