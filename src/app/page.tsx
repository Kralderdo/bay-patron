
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
};

type SavedTrack = Track & {
  blob: Blob;
};

const FAVORITES_KEY = "bay-patron-favorites";
const PLAYLIST_KEY = "bay-patron-playlist";
const DB_NAME = "bay-patron-offline";
const STORE_NAME = "tracks";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Bu tarayıcı çevrimdışı kaydı desteklemiyor."));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOfflineTracks(): Promise<SavedTrack[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

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
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put({
      ...track,
      blob,
    });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function deleteOfflineTrack(id: string) {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

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
    "Sevdiğin müzikleri keşfet."
  );
  const [playing, setPlaying] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef("");

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITES_KEY);
      const savedPlaylist = localStorage.getItem(PLAYLIST_KEY);

      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites) as Track[]);
      }

      if (savedPlaylist) {
        setPlaylist(JSON.parse(savedPlaylist) as Track[]);
      }
    } catch {
      setMessage("Kayıtlı listeler okunamadı.");
    }

    getOfflineTracks()
      .then(setOfflineTracks)
      .catch(() => {
        setMessage(
          "Çevrimdışı alanı bu tarayıcıda kullanılamıyor."
        );
      });

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
      setMessage("Favoriler tarayıcıya kaydedilemedi.");
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

    const searchTerm = query.trim();

    if (!searchTerm) {
      setMessage("Önce bir şarkı veya sanatçı adı yaz.");
      return;
    }

    setLoading(true);
    setSection("Arama");
    setMessage("Müzikler aranıyor...");

    try {
      const response = await fetch(
        `/api/tracks?q=${encodeURIComponent(searchTerm)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Arama başarısız.");
      }

      const results = (data.tracks ?? []) as Track[];

      setTracks(results);
      setMessage(
        results.length
          ? `${results.length} müzik bulundu.`
          : "Sonuç bulunamadı. Başka bir isim dene."
      );
    } catch (error) {
      setTracks([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Bir bağlantı hatası oluştu."
      );
    } finally {
      setLoading(false);
    }
  }

  function playTrack(track: Track) {
    if (!track.audio) {
      setMessage("Bu parçanın oynatma bağlantısı bulunamadı.");
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
      setMessage("Bu parça zaten çalma listende.");
      return;
    }

    persistPlaylist([...playlist, track]);
    setMessage("Parça çalma listene eklendi.");
  }

  async function downloadTrack(track: Track) {
    if (!track.downloadable) {
      setMessage(
        "Bu parçanın çevrimdışı indirme izni görünmüyor."
      );
      return;
    }

    setDownloadingId(track.id);
    setMessage("Parça çevrimdışı dinleme için hazırlanıyor...");

    try {
      const response = await fetch(track.audio);

      if (!response.ok) {
        throw new Error("Ses dosyası alınamadı.");
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("Ses dosyası boş geldi.");
      }

      await saveOfflineTrack(track, blob);

      const updated = await getOfflineTracks();
      setOfflineTracks(updated);
      setMessage("Parça bu cihaz için kaydedildi.");
    } catch {
      setMessage(
        "Kayıt başarısız. Kaynak indirmeye izin vermiyor olabilir."
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
    <main className="min-h-screen bg-[#08090b] pb-36 text-white">
      <header className="sticky top-0 z-20 border-b border-yellow-500/15 bg-[#08090b]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => {
              setSection("Keşfet");
              setMessage("BAY PATRON'a hoş geldin.");
            }}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-2xl text-black shadow-lg shadow-yellow-500/10">
              ♛
            </span>
            <span>
              <span className="block text-lg font-black tracking-[0.16em] text-yellow-300 sm:text-xl">
                BAY PATRON
              </span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Music experience
              </span>
            </span>
          </button>

          <span className="hidden rounded-full border border-yellow-500/20 px-3 py-1.5 text-xs text-yellow-200 sm:inline">
            PREMIUM TASARIM
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-[#211b0b] via-[#111214] to-[#090a0c] p-6 sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl" />

          <div className="relative max-w-3xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-yellow-300">
              Müzik senin dünyan
            </p>

            <h1 className="text-4xl font-black leading-tight sm:text-6xl">
              Sesini aç.
              <br />
              <span className="text-yellow-300">
                Tarzını yaşa.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">
              Yeni parçalar keşfet, favorilerini biriktir ve
              izin verilen müzikleri cihazına kaydet.
            </p>

            <form
              onSubmit={searchMusic}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Şarkı veya sanatçı ara..."
                aria-label="Şarkı veya sanatçı ara"
                maxLength={100}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-sm outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/70"
              />

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-yellow-400 px-7 py-4 font-bold text-black transition hover:bg-yellow-300 disabled:opacity-60"
              >
                {loading ? "Aranıyor..." : "⌕ Müzik Ara"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <nav className="flex gap-2 overflow-x-auto pb-3">
          {[
            { name: "Keşfet", icon: "✦" },
            { name: "Favoriler", icon: "♥" },
            { name: "Çalma Listem", icon: "☷" },
            { name: "Çevrimdışı", icon: "↓" },
          ].map((item) => (
            <button
              key={item.name}
              onClick={() => setSection(item.name)}
              className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                section === item.name
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-yellow-400/40 hover:text-white"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-yellow-400">
              BAY PATRON COLLECTION
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {section === "Keşfet"
                ? "Müzik keşfet"
                : section}
            </h2>
          </div>

          <span className="text-sm text-zinc-500">
            {visibleTracks.length} parça
          </span>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3 text-sm text-zinc-400"
        >
          {message}
        </p>

        {visibleTracks.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="group flex min-w-0 gap-4 rounded-2xl border border-white/[0.08] bg-[#111214] p-3 transition hover:border-yellow-400/30 hover:bg-[#151619]"
                >
                  <button
                    onClick={() => {
                      if (section === "Çevrimdışı") {
                        playOfflineTrack(track as SavedTrack);
                      } else {
                        playTrack(track);
                      }
                    }}
                    aria-label={`${track.title} parçasını çal`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-yellow-500/20 to-zinc-900"
                  >
                    {track.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-4xl text-yellow-300">
                        ♫
                      </span>
                    )}

                    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-2xl opacity-0 transition group-hover:opacity-100">
                      ▶
                    </span>
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <button
                      onClick={() => {
                        if (section === "Çevrimdışı") {
                          playOfflineTrack(track as SavedTrack);
                        } else {
                          playTrack(track);
                        }
                      }}
                      className="truncate text-left font-bold text-white hover:text-yellow-300"
                    >
                      {track.title}
                    </button>

                    <p className="mt-1 truncate text-sm text-zinc-400">
                      {track.artist}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <span className="text-xs text-zinc-600">
                        {formatTime(track.duration)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFavorite(track)}
                          aria-label={
                            isFavorite
                              ? "Favorilerden çıkar"
                              : "Favorilere ekle"
                          }
                          title="Favoriler"
                          className={`rounded-lg px-2 py-1.5 text-lg ${
                            isFavorite
                              ? "text-yellow-300"
                              : "text-zinc-500 hover:text-yellow-300"
                          }`}
                        >
                          {isFavorite ? "♥" : "♡"}
                        </button>

                        <button
                          onClick={() => addToPlaylist(track)}
                          aria-label="Çalma listesine ekle"
                          title="Listeye ekle"
                          className="rounded-lg px-2 py-1.5 text-lg text-zinc-400 hover:text-yellow-300"
                        >
                          +
                        </button>

                        {section === "Çevrimdışı" ? (
                          <button
                            onClick={() =>
                              removeOfflineTrack(track.id)
                            }
                            aria-label="Çevrimdışı kaydı sil"
                            title="Kaydı sil"
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
                                  : "Bu parça için indirme izni yok"
                            }
                            className="rounded-lg px-2 py-1.5 text-sm text-yellow-300 hover:bg-yellow-300/10 disabled:cursor-not-allowed disabled:text-zinc-700"
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
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-14 text-center">
            <div className="text-4xl text-yellow-300">♫</div>
            <p className="mt-4 font-semibold text-zinc-300">
              {section === "Favoriler"
                ? "Henüz favorin yok."
                : section === "Çalma Listem"
                  ? "Çalma listen henüz boş."
                  : section === "Çevrimdışı"
                    ? "Henüz çevrimdışı parçan yok."
                    : "Müzik arayarak başlayabilirsin."}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {section === "Keşfet"
                ? "Yukarıdaki arama kutusunu kullan."
                : "Parçaları keşfet bölümünden ekleyebilirsin."}
            </p>
            {section !== "Keşfet" && (
              <button
                onClick={() => setSection("Keşfet")}
                className="mt-5 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black"
              >
                Müzik keşfet
              </button>
            )}
          </div>
        )}
      </section>

      <footer className="mx-auto mt-12 max-w-7xl px-4 pb-8 text-center text-xs leading-6 text-zinc-600 sm:px-6">
        BAY PATRON © {new Date().getFullYear()} · Müzik haklarına ve
        kaynak lisanslarına saygı göster.
        <br />
        Çevrimdışı kayıt yalnızca indirmeye izin verilen parçalarda
        kullanılmalıdır.
      </footer>

      {current && audioSource && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-yellow-400/20 bg-[#0b0c0e]/95 shadow-2xl shadow-black backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-yellow-400/10 text-xl text-yellow-300">
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
                <p className="truncate text-sm font-bold">
                  {current.title}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {current.artist}
                </p>
              </div>

              <span className="hidden text-xs text-yellow-300 sm:inline">
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
                className="rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/5 hover:text-white"
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
                  "Bu parça oynatılamadı. Başka bir parça deneyebilirsin."
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
