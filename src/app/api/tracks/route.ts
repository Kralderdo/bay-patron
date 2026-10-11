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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchJamendo(query: string, clientId: string) {
  const url = new URL("https://api.jamendo.com/v3.0/tracks/");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "30");
  url.searchParams.set("search", query);
  url.searchParams.set("audioformat", "mp32");
  url.searchParams.set("include", "musicinfo");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  const data = await response.json();

  if (!response.ok || data.headers?.status !== "success") {
    throw new Error(
      data.headers?.error_message ||
        `Jamendo HTTP ${response.status}`
    );
  }

  return (Array.isArray(data.results) ? data.results : []) as JamendoTrack[];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "Bir şarkı adı, sanatçı veya aramak istediğin sözleri yaz.", tracks: [] },
      { status: 400 }
    );
  }

  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "JAMENDO_CLIENT_ID ayarlanmamış.", tracks: [] },
      { status: 503 }
    );
  }

  try {
    const queries = [query];
    const words = query.split(/\s+/).filter(Boolean);

    // Uzun söz parçalarında Jamendo'nun arama yapabileceği
    // kısa kelime gruplarını da dene.
    if (words.length >= 4) {
      queries.push(words.slice(0, 3).join(" "));
      queries.push(words.slice(-3).join(" "));
    }

    const uniqueQueries = [...new Set(queries)];
    const results = await Promise.allSettled(
      uniqueQueries.map((q) => searchJamendo(q, clientId))
    );

    const allTracks = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    const seen = new Set<string>();
    const tracks = allTracks
      .filter((track) => {
        if (
          track.id == null ||
          typeof track.audio !== "string" ||
          !track.audio.startsWith("https://")
        ) {
          return false;
        }

        const id = String(track.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((track) => ({
        id: String(track.id),
        title: track.name ?? "İsimsiz parça",
        artist: track.artist_name ?? "Bilinmeyen sanatçı",
        album: track.album_name ?? "",
        image: track.album_image ?? track.image ?? "",
        audio: track.audio!,
        duration: Math.max(0, Number(track.duration) || 0),
        downloadable: track.audiodownload_allowed === true,
      }));

    return NextResponse.json(
      {
        tracks,
        searchMode: words.length >= 4 ? "expanded" : "standard",
        note:
          "Jamendo genel arama yapar; şarkı sözlerinin tamamında arama yapmaz.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Müzik araması başarısız oldu.",
        details:
          error instanceof Error ? error.message : "Bilinmeyen hata",
        tracks: [],
      },
      { status: 502 }
    );
  }
}
