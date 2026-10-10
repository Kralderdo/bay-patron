
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08090b] px-5 text-center text-white">
      <div className="text-7xl text-yellow-300">♛</div>

      <p className="mt-8 text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
        BAY PATRON
      </p>

      <h1 className="mt-4 text-6xl font-black">404</h1>

      <p className="mt-4 text-zinc-400">
        Aradığın sayfa burada bulunamadı.
      </p>

      <Link
        href="/"
        className="mt-8 rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black transition hover:bg-yellow-300"
      >
        Ana Sayfaya Dön
      </Link>
    </main>
  );
}
