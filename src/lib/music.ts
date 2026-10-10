
import type { Track } from "./types";

export function normalizeTrack(track: Track): Track {
  return {
    id: String(track.id),
    title: String(track.title || "İsimsiz parça"),
    artist: String(track.artist || "Bilinmeyen sanatçı"),
    album: String(track.album || ""),
    image: String(track.image || ""),
    audio: String(track.audio || ""),
    duration: Math.max(0, Number(track.duration) || 0),
    downloadable: track.downloadable === true,
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function uniqueTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    if (!track.id || seen.has(track.id)) {
      return false;
    }

    seen.add(track.id);
    return true;
  });
}
