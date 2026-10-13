import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JamendoTrack = {
  id?: string | number;
  name?: string;
  artist_name?: string;
  album_name?: string;
  album_image?: string;
  image?: string;
  audio?: string;
  duration?: number;
  audiodownload_allowed?: boolean;
};

type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images?: { url: string }[];
  };
  duration_ms: number;
  external_urls?: { spotify?: string };
};

async function searchJamendo(
  query: string,
  clientId: string,
  mode: "search" | "namesearch"
): Promise<JamendoTrack[]> {
  const url = new URL("https://api.jamendo.com/v3.0/tracks/");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "30");
  url.searchParams.set(mode, query);
  url.searchParams.set("audioformat", "mp32");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json();

  if (!response.ok || data.headers?.status !== "success") {
    throw new Error("Jamendo araması başarısız.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify ortam değişkenleri eksik.");
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error("Spotify erişim anahtarı alınamadı.");
  }

  return data.access_token as string;
}

async function searchSpotify(query: string) {
  const token = await getSpotifyToken();
  const url = new URL("https://api.spotify.com/v1/search");

  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "30");
  url.searchParams.set("market", "TR");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Spotify araması başarısız.");
  }

  return (data.tracks?.items ?? []) as SpotifyTrack[];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "Bir şarkı veya sanatçı adı yaz." },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const tracks: object[] = [];

  const jobs = await Promise.allSettled([
    searchSpotify(query),
    process.env.JAMENDO_CLIENT_ID
      ? searchJamendo(
          query,
          process.env.JAMENDO_CLIENT_ID,
          "search"
        )
      : Promise.resolve([] as JamendoTrack[]),
  ]);

  if (jobs[0].status === "fulfilled") {
    for (const track of jobs[0].value) {
      tracks.push({
        id: `spotify-${track.id}`,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        image: track.album.images?.[0]?.url ?? "",
        audio: "",
        duration: Math.round(track.duration_ms / 1000),
        downloadable: false,
        source: "Spotify",
        previewOnly: false,
        officialUrl: track.external_urls?.spotify ?? "",
      });
    }
  } else {
    errors.push("Spotify: Arama başarısız oldu.");
  }

  if (jobs[1].status === "fulfilled") {
    for (const track of jobs[1].value) {
      if (!track.id || !track.audio?.startsWith("https://")) {
        continue;
      }

      tracks.push({
        id: `jamendo-${track.id}`,
        title: track.name ?? "İsimsiz parça",
        artist: track.artist_name ?? "Bilinmeyen sanatçı",
        album: track.album_name ?? "",
        image: track.album_image ?? track.image ?? "",
        audio: track.audio,
        duration: Math.max(0, Number(track.duration) || 0),
        downloadable: track.audiodownload_allowed === true,
        source: "Jamendo",
        previewOnly: false,
        officialUrl: "",
      });
    }
  } else {
    errors.push("Jamendo: Arama başarısız oldu.");
  }

  return NextResponse.json(
    {
      tracks,
      total: tracks.length,
      details: errors,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
