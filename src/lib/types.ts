
export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  audio: string;
  duration: number;
  downloadable: boolean;
};

export type SavedTrack = Track & {
  blob: Blob;
};

export type MusicApiResponse = {
  tracks: Track[];
  error?: string;
};
