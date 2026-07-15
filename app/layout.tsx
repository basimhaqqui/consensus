import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://consensus-football.vercel.app"),
  title: "CONSENSUS // World Cup 2026 Match Terminal",
  description:
    "A live consensus forecast for every 2026 World Cup knockout match — model win probabilities, expected scorelines, and confidence, in one terminal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-mono">
        <div className="fixed top-0 inset-x-0 h-px z-50 bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
