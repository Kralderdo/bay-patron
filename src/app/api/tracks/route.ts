import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "Bir şarkı veya sanatçı adı yaz." },
      { status: 400 }
    );
  }

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Jamendo API anahtarı eksik.",
        details: "Vercel Environment Variables bölümüne JAMENDO_CLIENT_ID ekle.",
        tracks: [],
      },
      { status: 503 }
    );
  }

  try {
    const url = new URL("https://api.jamendo.com/v3.0/tracks/");

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "30");
    url.searchParams.set("search", query);
    url.searchParams.set("audioformat", "mp32");
    url.searchParams.set("include", "musicinfo");

    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const result = await response.json();

    if (!response.ok || result.headers?.status !== "success") {
      return NextResponse.json(
        {
          error: "Müzik servisi aramayı tamamlayamadı.",
          details:
            result.headers?.error_message ??
            result.headers?.message ??
            `HTTP ${response.status}`,
          tracks: [],
        },
        { status: 502 }
      );
    }

    const tracks = (
      Array.isArray(result.results) ? result.results : []
    )
      .filter(
        (track: Record<string, unknown>) =>
          (typeof track.id === "string" ||
            typeof track.id === "number") &&
          typeof track.audio === "string" &&
          track.audio.startsWith("https://")
      )
      .map((track: Record<string, unknown>) => ({
        id: String(track.id),
        title: String(track.name ?? "İsimsiz parça"),
        artist: String(track.artist_name ?? "Bilinmeyen sanatçı"),
        album: String(track.album_name ?? ""),
        image: String(track.album_image ?? track.image ?? ""),
        audio: String(track.audio),
        duration: Math.max(0, Number(track.duration) || 0),
        downloadable: track.audiodownload_allowed === true,
      }));

    return NextResponse.json(
      { tracks },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Müzik servisine bağlanılamadı.",
        details:
          error instanceof Error
            ? error.message
            : "Bilinmeyen bağlantı hatası",
        tracks: [],
      },
      { status: 502 }
    );
  }
        }
