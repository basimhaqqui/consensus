import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import WatchlistDashboard from "@/components/WatchlistDashboard";

export const metadata: Metadata = {
  title: "Your Watchlist — CONSENSUS",
  description:
    "A personal sports intelligence board for saved World Cup matches, football players, and UFC fighters.",
  alternates: { canonical: "/watchlist" },
};

export default function WatchlistPage() {
  return (
    <main className="site-shell">
      <header className="site-topbar">
        <Link href="/" className="site-wordmark">
          <span>▸</span> CONSENSUS
        </Link>
        <Nav />
      </header>
      <WatchlistDashboard />
      <Footer />
    </main>
  );
}
