export type RepeatMode = "off" | "all" | "one";

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  track_no: number;
  has_cover: boolean;
}

export interface PlayerStatus {
  playing: boolean;
  has_track: boolean;
  current_index: number | null;
  position_ms: number;
  duration_ms: number;
  volume: number;
  repeat: RepeatMode;
}

export interface LyricLine {
  time_ms: number;
  text: string;
}

export interface LyricsResult {
  found: boolean;
  synced: boolean;
  lines: LyricLine[];
  plain: string | null;
  source: string | null;
  message: string | null;
}

export const DEFAULT_STATUS: PlayerStatus = {
  playing: false,
  has_track: false,
  current_index: null,
  position_ms: 0,
  duration_ms: 0,
  volume: 0.8,
  repeat: "off",
};
