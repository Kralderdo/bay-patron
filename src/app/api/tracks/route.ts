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
  artists?: { name: string }[];
  album?: {
    name?: string;
    images?: { url: string }[];
  };
  duration_ms?: number;
  external_urls?: { spotify?: string };
};

type ResultTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  audio: string;
  duration: number;
  downloadable: boolean;
  source: string;
  previewOnly: boolean;
  officialUrl: string;
};

async function searchJamendo(
  query: string,
  clientId: string,
  mode: "search" | "namesearch"
): Promise<JamendoTrack[]> {
  const url = new URL("https://api.jamendo.com/v3.0/tracks/");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "50");
  url.searchParams.set(mode, query);
  url.searchParams.set("audioformat", "mp32");
  url.searchParams.set("include", "musicinfo");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  const data = await response.json();

  if (!response.ok || data.headers?.status !== "success") {
    throw new Error(
      data.headers?.error_message || "Jamendo araması başarısız."
    );
  }

  return Array.isArray(data.results) ? data.results : [];
}

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "SPOTIFY_CLIENT_ID veya SPOTIFY_CLIENT_SECRET eksik."
    );
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
      signal: AbortSignal.timeout(12000),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Spotify erişim anahtarı alınamadı."
    );
  }

  return data.access_token as string;
}

async function searchSpotify(
  query: string
): Promise<SpotifyTrack[]> {
  const token = await getSpotifyToken();
  const url = new URL("https://api.spotify.com/v1/search");

  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");

  // Spotify aramasında sonuç sayısını 10 ile sınırla.
  url.searchParams.set("limit", "10");
  url.searchParams.set("market", "TR");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        `Spotify araması başarısız (HTTP ${response.status}).`
    );
  }

  return Array.isArray(data.tracks?.items)
    ? data.tracks.items
    : [];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length > 100) {
    return NextResponse.json(
      {
        error: "Bir şarkı veya sanatçı adı yaz.",
        tracks: [],
        total: 0,
      },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const results: ResultTrack[] = [];
  const seen = new Set<string>();

  function addTrack(track: ResultTrack) {
    const key = `${track.source}:${track.id}`;

    if (seen.has(key)) return;

    seen.add(key);
    results.push(track);
  }

  const jamendoId = process.env.JAMENDO_CLIENT_ID;

  const jobs = await Promise.allSettled([
    searchSpotify(query),
    jamendoId
      ? searchJamendo(query, jamendoId, "search")
      : Promise.resolve([] as JamendoTrack[]),
    jamendoId
      ? searchJamendo(query, jamendoId, "namesearch")
      : Promise.resolve([] as JamendoTrack[]),
  ]);

  // Spotify sonuçları
  if (jobs[0].status === "fulfilled") {
    for (const track of jobs[0].value) {
      addTrack({
        id: `spotify-${track.id}`,
        title: track.name || "İsimsiz parça",
        artist:
          track.artists?.map((artist) => artist.name).join(", ") ||
          "Bilinmeyen sanatçı",
        album: track.album?.name || "",
        image: track.album?.images?.[0]?.url || "",
        audio: "",
        duration: Math.round((track.duration_ms || 0) / 1000),
        downloadable: false,
        source: "Spotify",
        previewOnly: false,
        officialUrl: track.external_urls?.spotify || "",
      });
    }
  } else {
    const reason = jobs[0].reason;

    errors.push(
      `Spotify: ${
        reason instanceof Error ? reason.message : "Arama başarısız."
      }`
    );
  }

  // Jamendo sonuçlarını birleştir
  for (const index of [1, 2] as const) {
    const job = jobs[index];

    if (job.status === "rejected") {
      const reason = job.reason;

      errors.push(
        `Jamendo: ${
          reason instanceof Error ? reason.message : "Arama başarısız."
        }`
      );
      continue;
    }

    for (const track of job.value as JamendoTrack[]) {
      if (
        track.id == null ||
        !track.audio?.startsWith("https://")
      ) {
        continue;
      }

      addTrack({
        id: `jamendo-${track.id}`,
        title: track.name || "İsimsiz parça",
        artist: track.artist_name || "Bilinmeyen sanatçı",
        album: track.album_name || "",
        image: track.album_image || track.image || "",
        audio: track.audio,
        duration: Math.max(0, Number(track.duration) || 0),
        downloadable: track.audiodownload_allowed === true,
        source: "Jamendo",
        previewOnly: false,
        officialUrl: "",
      });
    }
  }

  // Başlıktaki tam eşleşmelere öncelik ver.
  const normalizedQuery = query.toLocaleLowerCase("tr-TR");

  results.sort((a, b) => {
    const aMatch =
      a.title.toLocaleLowerCase("tr-TR") === normalizedQuery;
    const bMatch =
      b.title.toLocaleLowerCase("tr-TR") === normalizedQuery;

    return Number(bMatch) - Number(aMatch);
  });

  return NextResponse.json(
    {
      tracks: results,
      total: results.length,
      details: errors,
      message:
        results.length > 0
          ? `${results.length} sonuç bulundu.`
          : "Sonuç bulunamadı. Başka bir arama dene.",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
  }
