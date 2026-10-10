
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!clientId) {
    return NextResponse.json(
      { error: "Jamendo API anahtarı henüz ayarlanmadı." },
      { status: 503 }
    );
  }

  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "Lütfen geçerli bir şarkı veya sanatçı adı gir." },
      { status: 400 }
    );
  }

  try {
    const url = new URL("https://api.jamendo.com/v3.0/tracks/");

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "30");
    url.searchParams.set("namesearch", query);
    url.searchParams.set("audioformat", "mp32");
    url.searchParams.set("include", "musicinfo");

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Müzik servisine şu anda ulaşılamıyor." },
        { status: 502 }
      );
    }

    const result = await response.json();

    if (result.headers?.status !== "success") {
      return NextResponse.json(
        { error: "Müzikler alınamadı. Daha sonra tekrar dene." },
        { status: 502 }
      );
    }

    const tracks = (result.results ?? []).map(
      (track: Record<string, unknown>) => ({
        id: String(track.id ?? ""),
        title: String(track.name ?? "İsimsiz parça"),
        artist: String(track.artist_name ?? "Bilinmeyen sanatçı"),
        album: String(track.album_name ?? ""),
        image: String(track.album_image ?? track.image ?? ""),
        audio: String(track.audio ?? ""),
        duration: Number(track.duration ?? 0),
        downloadable: track.audiodownload_allowed === true,
      })
    );

    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json(
      { error: "Bağlantı hatası oluştu. Tekrar dene." },
      { status: 500 }
    );
  }
}
