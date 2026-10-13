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
      "Spotify için SPOTIFY_CLIENT_ID veya SPOTIFY_CLIENT_SECRET eksik."
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
  url.searchParams.set("limit", "50");
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
      data.error?.message || "Spotify araması başarısız."
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
        error: "Bir şarkı, sanatçı veya arama ifadesi yaz.",
        tracks: [],
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

  const jobs = await Promise.allSettled([
    searchSpotify(query),
    process.env.JAMENDO_CLIENT_ID
      ? searchJamendo(query, process.env.JAMENDO_CLIENT_ID, "search")
      : Promise.resolve([] as JamendoTrack[]),
    process.env.JAMENDO_CLIENT_ID
      ? searchJamendo(
          query,
          process.env.JAMENDO_CLIENT_ID,
          "namesearch"
        )
      : Promise.resolve([] as JamendoTrack[]),
  ]);

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
    errors.push(
      `Spotify: ${
        jobs[0].reason instanceof Error
          ? jobs[0].reason.message
          : "Arama başarısız."
      }`
    );
  }

  for (const index of [1, 2]) {
    const job = jobs[index];

    if (job.status === "rejected") {
      errors.push(
        `Jamendo: ${
          job.reason instanceof Error
            ? job.reason.message
            : "Arama başarısız."
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

  results.sort((a, b) => {
    const aStarts = a.title
      .toLocaleLowerCase("tr-TR")
      .startsWith(query.toLocaleLowerCase("tr-TR"));
    const bStarts = b.title
      .toLocaleLowerCase("tr-TR")
      .startsWith(query.toLocaleLowerCase("tr-TR"));

    return Number(bStarts) - Number(aStarts);
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
