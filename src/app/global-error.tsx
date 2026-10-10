
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BAY PATRON uygulama hatası:", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#08090b",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <main>
          <div style={{ fontSize: 64, color: "#facc15" }}>♛</div>
          <h1 style={{ color: "#facc15" }}>BAY PATRON</h1>
          <h2>Beklenmeyen bir hata oluştu.</h2>
          <p style={{ color: "#a1a1aa" }}>
            Tekrar deneyerek sayfayı yeniden yükleyebilirsin.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "14px 22px",
              border: 0,
              borderRadius: 12,
              background: "#facc15",
              color: "#08090b",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </main>
      </body>
    </html>
  );
}
