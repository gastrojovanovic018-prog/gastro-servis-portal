import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gastro Oprema | Servisni portal",
  description: "Prijava kvara i praćenje servisnih naloga za klijente Gastro Opreme",
  icons: {
    icon: [{ url: "/gastro-servis-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/gastro-servis-512.png", sizes: "512x512", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Gastro Servis",
    statusBarStyle: "default",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#e8772a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
