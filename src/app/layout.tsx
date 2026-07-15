import type { Metadata, Viewport } from "next";
import { LOCALE } from "../lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Dropboard",
  title: "Dropboard",
  description: "A review board for AI-generated deliverables",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14171c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={LOCALE} className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
