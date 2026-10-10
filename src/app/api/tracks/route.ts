
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!clientId) {
    return NextResponse.json(
      { error: "Müzik servisi henüz yapılandırılmadı." },
      { status: 503 }
    );
  }

  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "1 ile 100 karakter arasında arama yaz." },
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

    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Müzik servisi şu anda yanıt vermiyor." },
        { status: 502 }
      );
    }

    const result = await response.json();

    if (result.headers?.status !== "success") {
      return NextResponse.json(
        { error: "Müzik araması başarısız oldu." },
        { status: 502 }
      );
    }

    const tracks = (Array.isArray(result.results) ? result.results : [])
      .filter(
        (track: Record<string, unknown>) =>
          typeof track.id === "string" ||
          typeof track.id === "number"
      )
      .map((track: Record<string, unknown>) => ({
        id: String(track.id),
        title: String(track.name ?? "İsimsiz parça"),
        artist: String(track.artist_name ?? "Bilinmeyen sanatçı"),
        album: String(track.album_name ?? ""),
        image: String(track.album_image ?? track.image ?? ""),
        audio: typeof track.audio === "string" ? track.audio : "",
        duration: Math.max(0, Number(track.duration) || 0),
        downloadable: track.audiodownload_allowed === true,
      }))
      .filter((track: { id: string; audio: string }) =>
        track.id && track.audio.startsWith("http")
      );

    return NextResponse.json(
      { tracks },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Bağlantı zaman aşımına uğradı veya hata oluştu." },
      { status: 502 }
    );
  }
}
