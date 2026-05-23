import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "DACH Pipeline",
  description: "Private credit deal pipeline tracker for DACH origination",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DACH Pipeline",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0f17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen overflow-x-hidden">
        {/* Mobile: narrow centered, bottom nav padding */}
        {/* Desktop: offset for sidebar, wider content */}
        <main className="max-w-lg mx-auto pb-24 lg:max-w-5xl lg:ml-[220px] lg:mr-auto lg:pb-8 lg:px-2">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
