
"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BAY PATRON hata:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08090b] px-5 text-center text-white">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-4xl text-yellow-300">
        ♛
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-yellow-300">
        BAY PATRON
      </p>

      <h1 className="mt-3 text-3xl font-black">
        Bir şeyler ters gitti
      </h1>

      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
        Sayfa yüklenirken beklenmeyen bir hata oluştu.
        Tekrar deneyebilirsin.
      </p>

      <button
        onClick={() => reset()}
        className="mt-7 rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black transition hover:bg-yellow-300"
      >
        Tekrar Dene
      </button>
    </main>
  );
}
