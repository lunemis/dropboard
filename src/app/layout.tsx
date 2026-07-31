import type { Metadata, Viewport } from "next";
import { LOCALE } from "../lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Dropboard",
  title: "Dropboard",
  description: "Open-source inbox and library for AI-generated deliverables",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#12151a" },
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
