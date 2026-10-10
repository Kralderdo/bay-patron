
export const APP_NAME = "👑BAY PATRON";

export const STORAGE_KEYS = {
  favorites: "bay-patron-favorites",
  playlist: "bay-patron-playlist",
  offlineDatabase: "bay-patron-offline",
  offlineStore: "tracks",
} as const;

export const MUSIC_SETTINGS = {
  apiEndpoint: "/api/tracks",
  maxSearchLength: 100,
  resultLimit: 30,
} as const;

export const THEME = {
  background: "#08090b",
  foreground: "#ffffff",
  gold: "#facc15",
} as const;
