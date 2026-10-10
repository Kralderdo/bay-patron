
import type { Metadata, Viewport } from "next";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://baypatron.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "♛ BAY PATRON | Müzik Dünyası",
    template: "%s | BAY PATRON",
  },

  description:
    "BAY PATRON ile müzik keşfet, favorilerini oluştur ve izin verilen parçaları çevrimdışı dinle.",

  applicationName: "BAY PATRON",

  manifest: "/manifest.json",

  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BAY PATRON",
  },

  openGraph: {
    title: "BAY PATRON | Müzik Dünyası",
    description:
      "Müzik keşfet, favorilerini oluştur ve kendi müzik dünyanı kur.",
    siteName: "BAY PATRON",
    type: "website",
    locale: "tr_TR",
    url: siteUrl,
  },

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
