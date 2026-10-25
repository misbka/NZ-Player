import { invoke } from "@tauri-apps/api/core";
import type { PlayerStatus, RepeatMode, Track, LyricsResult } from "../types";

/* ------------------------------------------------------------------ */
/* Playlist / library                                                  */
/* ------------------------------------------------------------------ */

export const getPlaylist = () => invoke<Track[]>("get_playlist");

export const getStatus = () => invoke<PlayerStatus>("get_status");

export const openFiles = () => invoke<Track[]>("open_files");

export const openFolder = () => invoke<Track[]>("open_folder");

export const removeTrack = (index: number) => invoke<Track[]>("remove_track", { index });

export const clearPlaylist = () => invoke<Track[]>("clear_playlist");

/** Returns a `data:` URL with the embedded cover art, or `null`. */
export const getCover = (index: number) => invoke<string | null>("get_cover", { index });

/* ------------------------------------------------------------------ */
/* Playback                                                            */
/* ------------------------------------------------------------------ */

export const playIndex = (index: number) => invoke<void>("play_index", { index });
export const togglePlay = () => invoke<void>("toggle_play");
export const play = () => invoke<void>("play");
export const pause = () => invoke<void>("pause");
export const stop = () => invoke<void>("stop");
export const nextTrack = () => invoke<void>("next_track");
export const previousTrack = () => invoke<void>("previous_track");
export const seek = (positionMs: number) => invoke<void>("seek", { positionMs });
export const setVolume = (volume: number) => invoke<void>("set_volume", { volume });
export const setRepeat = (mode: RepeatMode) => invoke<void>("set_repeat", { mode });
/** Off -> All -> One -> Off (o ciclo vive no backend). */
export const cycleRepeat = () => invoke<void>("cycle_repeat");

/* ------------------------------------------------------------------ */
/* Lyrics (lrclib.net)                                                 */
/* ------------------------------------------------------------------ */

export const fetchLyrics = (title: string, artist: string, album: string) =>
  invoke<LyricsResult>("fetch_lyrics", { title, artist, album });
