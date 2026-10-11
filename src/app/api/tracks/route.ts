import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Track = {
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

async function searchJamendo(
  query: string,
  clientId: string,
  mode: "search" | "namesearch"
) {
  const url = new URL("https://api.jamendo.com/v3.0/tracks/");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "30");
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
      data.headers?.error_message ||
        `Jamendo HTTP ${response.status}`
    );
  }

  return (Array.isArray(data.results) ? data.results : []) as Track[];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "Şarkı veya sanatçı adı yaz.", tracks: [] },
      { status: 400 }
    );
  }

  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "JAMENDO_CLIENT_ID eksik.", tracks: [] },
      { status: 503 }
    );
  }

  const errors: string[] = [];
  let tracks: Track[] = [];

  try {
    try {
      tracks = await searchJamendo(query, clientId, "search");
    } catch (error) {
      errors.push(
        `Genel arama: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`
      );
    }

    if (tracks.length === 0) {
      try {
        tracks = await searchJamendo(query, clientId, "namesearch");
      } catch (error) {
        errors.push(
          `İsim araması: ${
            error instanceof Error ? error.message : "Bilinmeyen hata"
          }`
        );
      }
    }

    if (tracks.length === 0) {
      return NextResponse.json({
        tracks: [],
        error: errors.length
          ? "Jamendo arama istekleri başarısız oldu."
          : "Bu arama için Jamendo kataloğunda sonuç bulunamadı.",
        details: errors,
      });
    }

    const seen = new Set<string>();

    const results = tracks
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
      { tracks: results },
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
