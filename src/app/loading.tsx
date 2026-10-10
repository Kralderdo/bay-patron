
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08090b] text-white">
      <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10 text-5xl text-yellow-300">
        ♛
      </div>

      <h1 className="mt-6 text-2xl font-black tracking-[0.2em] text-yellow-300">
        BAY PATRON
      </h1>

      <p className="mt-3 text-sm text-zinc-500">
        Müzik dünyası hazırlanıyor...
      </p>

      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-yellow-400" />
      </div>
    </main>
  );
}
