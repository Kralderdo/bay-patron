"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  audio: string;
  duration: number;
  downloadable: boolean;
  source?: string;
  officialUrl?: string;
  previewOnly?: boolean;
};

type SavedTrack = Track & { blob: Blob };

const FAVORITES_KEY = "bay-patron-favorites";
const PLAYLIST_KEY = "bay-patron-playlist";
const DB_NAME = "bay-patron-offline";
const STORE_NAME = "tracks";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Çevrimdışı kayıt desteklenmiyor."));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOfflineTracks(): Promise<SavedTrack[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      resolve(request.result as SavedTrack[]);
      db.close();
    };

    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function saveOfflineTrack(track: Track, blob: Blob) {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...track, blob });

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function deleteOfflineTrack(id: string) {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  return `${Math.floor(seconds / 60)}:${String(
    Math.floor(seconds % 60)
  ).padStart(2, "0")}`;
}

const tabs = [
  { name: "Keşfet", icon: "✦" },
  { name: "Favoriler", icon: "♥" },
  { name: "Çalma Listem", icon: "☷" },
  { name: "Çevrimdışı", icon: "↓" },
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [audioSource, setAudioSource] = useState("");
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<SavedTrack[]>([]);
  const [section, setSection] = useState("Keşfet");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Krallara layık müziğini keşfet."
  );
  const [playing, setPlaying] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef("");

  useEffect(() => {
    try {
      const f = localStorage.getItem(FAVORITES_KEY);
      const p = localStorage.getItem(PLAYLIST_KEY);

      if (f) setFavorites(JSON.parse(f) as Track[]);
      if (p) setPlaylist(JSON.parse(p) as Track[]);
    } catch {
      setMessage("Kayıtlı listeler okunamadı.");
    }

    getOfflineTracks()
      .then(setOfflineTracks)
      .catch(() => {});

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function persistFavorites(next: Track[]) {
    setFavorites(next);

    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      setMessage("Favoriler kaydedilemedi.");
    }
  }

  function persistPlaylist(next: Track[]) {
    setPlaylist(next);

    try {
      localStorage.setItem(PLAYLIST_KEY, JSON.stringify(next));
    } catch {
      setMessage("Çalma listesi kaydedilemedi.");
    }
  }

  async function searchMusic(event?: FormEvent) {
    event?.preventDefault();

    const term = query.trim();

    if (!term) {
      setMessage("Bir şarkı veya sanatçı adı yaz.");
      return;
    }

    setLoading(true);
    setSection("Arama");
    setMessage("Spotify ve Jamendo katalogları aranıyor...");

    try {
      const response = await fetch(
        `/api/tracks?q=${encodeURIComponent(term)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Arama başarısız.");
      }

      const results = (data.tracks ?? []) as Track[];

      setTracks(results);
      setMessage(
        results.length
          ? `${results.length} parça bulundu.`
          : "Sonuç bulunamadı. Başka bir arama dene."
      );
    } catch (error) {
      setTracks([]);

      setMessage(
        error instanceof Error ? error.message : "Bağlantı hatası."
      );
    } finally {
      setLoading(false);
    }
  }

  function playTrack(track: Track) {
    if (!track.audio) {
      if (track.officialUrl) {
        window.open(
          track.officialUrl,
          "_blank",
          "noopener,noreferrer"
        );

        setMessage(
          `${track.title} Spotify'da açılıyor.`
        );
        return;
      }

      setMessage("Bu parça için oynatma bağlantısı bulunamadı.");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }

    setCurrent(track);
    setAudioSource(track.audio);
    setPlaying(true);
    setMessage(`Şimdi çalınıyor: ${track.title}`);
  }

  function playOfflineTrack(track: SavedTrack) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const url = URL.createObjectURL(track.blob);
    objectUrlRef.current = url;

    setCurrent(track);
    setAudioSource(url);
    setPlaying(true);
    setMessage(`Çevrimdışı çalınıyor: ${track.title}`);
  }

  function toggleFavorite(track: Track) {
    const exists = favorites.some((item) => item.id === track.id);

    persistFavorites(
      exists
        ? favorites.filter((item) => item.id !== track.id)
        : [...favorites, track]
    );
  }

  function addToPlaylist(track: Track) {
    if (playlist.some((item) => item.id === track.id)) {
      setMessage("Bu parça zaten listende.");
      return;
    }

    persistPlaylist([...playlist, track]);
    setMessage("Parça çalma listene eklendi.");
  }

  async function downloadTrack(track: Track) {
    if (!track.downloadable || !track.audio) {
      setMessage("Bu parça için indirme izni bulunmuyor.");
      return;
    }

    setDownloadingId(track.id);
    setMessage("Çevrimdışı kayıt hazırlanıyor...");

    try {
      const response = await fetch(track.audio);

      if (!response.ok) {
        throw new Error("Ses alınamadı.");
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("Dosya boş.");
      }

      await saveOfflineTrack(track, blob);
      setOfflineTracks(await getOfflineTracks());
      setMessage("Parça cihazına kaydedildi.");
    } catch {
      setMessage(
        "Kayıt başarısız. Kaynak indirmeyi engelliyor olabilir."
      );
    } finally {
      setDownloadingId("");
    }
  }

  async function removeOfflineTrack(id: string) {
    try {
      await deleteOfflineTrack(id);
      setOfflineTracks(await getOfflineTracks());
      setMessage("Çevrimdışı kayıt silindi.");
    } catch {
      setMessage("Kayıt silinemedi.");
    }
  }

  const visibleTracks =
    section === "Favoriler"
      ? favorites
      : section === "Çalma Listem"
        ? playlist
        : section === "Çevrimdışı"
          ? offlineTracks
          : tracks;

  return (
    <main className="royal-page min-h-screen overflow-hidden pb-40 text-white">
      <div className="royal-stars" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-[#d4af37]/20 bg-[#080706]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            onClick={() => {
              setSection("Keşfet");
              setMessage("BAY PATRON'a hoş geldin.");
            }}
            className="flex items-center gap-3 text-left"
          >
            <span className="royal-logo flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e9c75b]/50 bg-gradient-to-br from-[#ffe9a0] via-[#c99a2e] to-[#6b4510] text-3xl text-black">
              ♛
            </span>

            <span>
              <span className="royal-title block text-lg font-black tracking-[.16em] sm:text-xl">
                BAY PATRON
              </span>
              <span className="block text-[9px] uppercase tracking-[.35em] text-[#bba46c]">
                The Royal Music Club
              </span>
            </span>
          </button>

          <span className="hidden rounded-full border border-[#d4af37]/30 px-4 py-2 text-[10px] uppercase tracking-[.2em] text-[#e9cb76] sm:block">
            ♛ Premium Experience
          </span>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="royal-hero relative isolate overflow-hidden rounded-[30px] border border-[#caa54c]/35">
          <div className="royal-halo" />
          <div className="royal-orbit royal-orbit-one" />
          <div className="royal-orbit royal-orbit-two" />

          <div className="royal-particles" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>

          <div className="relative z-10 grid items-center gap-2 px-5 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1.05fr_.95fr] lg:px-14 lg:py-14">
            <div className="order-2 text-center lg:order-1 lg:text-left">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[.4em] text-[#f0d68b]">
                ✦ THE SOUND OF ROYALTY ✦
              </p>

              <h1 className="royal-title text-4xl font-black leading-[1.08] sm:text-6xl lg:text-7xl">
                Müziğin
                <br />
                <span>Hükümdarı.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-[#c1b9a7] lg:mx-0">
                Her ritimde ihtişam. Her notada ayrıcalık.
                Kendi müzik dünyanı keşfet.
              </p>

              <form
                onSubmit={searchMusic}
                className="royal-search mx-auto mt-7 flex max-w-2xl flex-col gap-2 rounded-2xl p-2 sm:flex-row lg:mx-0"
              >
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Şarkı veya sanatçı ara..."
                  aria-label="Şarkı veya sanatçı ara"
                  maxLength={100}
                  className="min-w-0 flex-1 rounded-xl bg-black/50 px-4 py-4 text-sm text-white outline-none placeholder:text-[#82775e] focus:ring-1 focus:ring-[#d4af37]/60"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="royal-button rounded-xl px-6 py-4 text-sm font-black text-black disabled:opacity-60"
                >
                  {loading ? "ARANIYOR..." : "⌕ MÜZİK ARA"}
                </button>
              </form>
            </div>

            <div className="royal-crown-stage order-1 mx-auto flex w-full max-w-md items-center justify-center lg:order-2">
              <div className="royal-crown-ring" />
              <div className="royal-crown">♛</div>
              <div className="royal-crown-caption">BAY PATRON</div>
              <div className="royal-crown-subtitle">KING OF MUSIC</div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-3 border-t border-[#d4af37]/20 bg-black/30 px-4 py-3 text-[9px] uppercase tracking-[.25em] text-[#b9a36d] sm:text-[10px]">
            <span className="royal-live-dot" />
            Discover · Listen · Repeat
            <span className="text-[#e5c45d]">✦</span>
            Your music, your kingdom
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <nav className="flex gap-2 overflow-x-auto pb-3">
          {tabs.map((item) => (
            <button
              key={item.name}
              onClick={() => setSection(item.name)}
              className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                section === item.name
                  ? "border-[#e4c15d] bg-gradient-to-r from-[#f3dc8d] to-[#bd8c2d] text-black"
                  : "border-[#d4af37]/15 bg-[#14110c] text-[#b5aa91] hover:border-[#d4af37]/50 hover:text-[#ffe6a0]"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[.3em] text-[#d6b24e]">
              ✦ BAY PATRON COLLECTION
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              {section === "Keşfet" ? "Müzik keşfet" : section}
            </h2>
          </div>

          <span className="text-sm text-[#9b8d6b]">
            {visibleTracks.length} parça
          </span>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl border border-[#d4af37]/15 bg-[#14110c]/80 px-4 py-3 text-sm text-[#c3b89e]"
        >
          {message}
        </p>

        {visibleTracks.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTracks.map((track) => {
              const isFavorite = favorites.some(
                (item) => item.id === track.id
              );

              const isOffline = offlineTracks.some(
                (item) => item.id === track.id
              );

              return (
                <article
                  key={track.id}
                  className="royal-card group flex min-w-0 gap-4 rounded-2xl bg-gradient-to-br from-[#1c1810] to-[#0c0b09] p-3"
                >
                  <button
                    onClick={() =>
                      section === "Çevrimdışı"
                        ? playOfflineTrack(track as SavedTrack)
                        : playTrack(track)
                    }
                    aria-label={`${track.title} parçasını aç`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#d4af37]/25 bg-[#211a0b]"
                  >
                    {track.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-4xl text-[#e6c55d]">
                        ♫
                      </span>
                    )}

                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl opacity-0 transition group-hover:opacity-100">
                      {track.audio ? "▶" : "↗"}
                    </span>
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <button
                      onClick={() =>
                        section === "Çevrimdışı"
                          ? playOfflineTrack(track as SavedTrack)
                          : playTrack(track)
                      }
                      className="truncate text-left font-bold text-[#f6e8bd] hover:text-[#ffdc6c]"
                    >
                      {track.title}
                    </button>

                    <p className="mt-1 truncate text-sm text-[#a69b82]">
                      {track.artist}
                    </p>

                    <p className="mt-1 truncate text-[10px] text-[#d1ae50]">
                      {track.source ?? "Müzik"} 
                      {!track.audio && track.officialUrl
                        ? " · Spotify'da aç"
                        : ""}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-1 pt-3">
                      <span className="text-xs text-[#786c53]">
                        {formatTime(track.duration)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFavorite(track)}
                          aria-label="Favorilere ekle veya çıkar"
                          title="Favoriler"
                          className={`rounded-lg px-2 py-1.5 text-lg ${
                            isFavorite
                              ? "text-[#ffdc6c]"
                              : "text-[#8f8265] hover:text-[#ffdc6c]"
                          }`}
                        >
                          {isFavorite ? "♥" : "♡"}
                        </button>

                        <button
                          onClick={() => addToPlaylist(track)}
                          aria-label="Çalma listesine ekle"
                          title="Listeye ekle"
                          className="rounded-lg px-2 py-1.5 text-lg text-[#b5a16c] hover:bg-[#d4af37]/10"
                        >
                          +
                        </button>

                        {section === "Çevrimdışı" ? (
                          <button
                            onClick={() => removeOfflineTrack(track.id)}
                            aria-label="Çevrimdışı kaydı sil"
                            className="rounded-lg px-2 py-1.5 text-sm text-red-400"
                          >
                            ✕
                          </button>
                        ) : (
                          <button
                            onClick={() => downloadTrack(track)}
                            disabled={
                              !track.downloadable ||
                              isOffline ||
                              downloadingId === track.id
                            }
                            aria-label="Çevrimdışı kaydet"
                            title={
                              isOffline
                                ? "Zaten kaydedildi"
                                : track.downloadable
                                  ? "Çevrimdışı kaydet"
                                  : "İndirme izni yok"
                            }
                            className="rounded-lg px-2 py-1.5 text-sm text-[#e5c45d] hover:bg-[#d4af37]/10 disabled:cursor-not-allowed disabled:text-zinc-700"
                          >
                            {downloadingId === track.id
                              ? "…"
                              : isOffline
                                ? "✓"
                                : track.downloadable
                                  ? "↓"
                                  : "⊘"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d4af37]/20 bg-[#12100c]/60 px-5 py-14 text-center">
            <div className="text-5xl text-[#d8b650]">♛</div>

            <p className="mt-4 font-semibold text-[#e5d6b2]">
              {section === "Favoriler"
                ? "Henüz favorin yok."
                : section === "Çalma Listem"
                  ? "Çalma listen henüz boş."
                  : section === "Çevrimdışı"
                    ? "Henüz çevrimdışı parçan yok."
                    : "Müzik arayarak krallığını keşfet."}
            </p>

            <p className="mt-2 text-sm text-[#93866a]">
              {section === "Keşfet"
                ? "Yukarıdaki arama alanını kullan."
                : "Parçaları keşfet bölümünden ekleyebilirsin."}
            </p>

            {section !== "Keşfet" && (
              <button
                onClick={() => setSection("Keşfet")}
                className="royal-button mt-5 rounded-xl px-5 py-3 text-sm font-bold text-black"
              >
                Müzik keşfet
              </button>
            )}
          </div>
        )}
      </section>

      <footer className="mx-auto mt-12 max-w-7xl px-4 pb-8 text-center text-xs leading-6 text-[#6f644c] sm:px-6">
        BAY PATRON © {new Date().getFullYear()} · Müzik haklarına ve kaynak lisanslarına saygı göster.
        <br />
        Çevrimdışı kayıt yalnızca indirmeye izin verilen parçalarda kullanılmalıdır.
      </footer>

      {current && audioSource && (
        <div className="royal-player fixed inset-x-0 bottom-0 z-40 border-t border-[#d4af37]/30 bg-[#090806]/95 shadow-2xl shadow-black backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#d4af37]/30 bg-[#201909] text-center text-xl leading-[44px] text-[#e4c15d]">
                {current.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "♫"
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#f4e3b5]">
                  {current.title}
                </p>
                <p className="truncate text-xs text-[#96896b]">
                  {current.artist}
                </p>
              </div>

              <span className="hidden text-[10px] tracking-widest text-[#e4c15d] sm:inline">
                {playing ? "● OYNATIYOR" : "DURAKLATILDI"}
              </span>

              <button
                onClick={() => {
                  setCurrent(null);
                  setAudioSource("");
                  setPlaying(false);

                  if (objectUrlRef.current) {
                    URL.revokeObjectURL(objectUrlRef.current);
                    objectUrlRef.current = "";
                  }
                }}
                aria-label="Oynatıcıyı kapat"
                className="rounded-lg px-3 py-2 text-[#a99a75] hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <audio
              ref={audioRef}
              key={audioSource}
              src={audioSource}
              controls
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => {
                setPlaying(false);
                setMessage(
                  "Bu parça oynatılamadı. Başka bir parça dene."
                );
              }}
              className="h-10 w-full"
            />
          </div>
        </div>
      )}
    </main>
  );
  }
