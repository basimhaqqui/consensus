import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import CompetitionNav from "@/components/CompetitionNav";

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "UFC CONSENSUS // Fight Terminal",
  description:
    "An integrated MMA fight terminal with independent Elo forecasts, market consensus, fighter pages, official rankings, picks, and a public graded ledger.",
  twitter: {
    card: "summary_large_image",
  },
};

export default function UfcLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${barlow.variable} ufc-theme min-h-screen`}>
      <main className="site-shell">
        <div className="site-topbar">
          <Link href="/" className="site-wordmark">
            <span>▸</span>
            <span>CONSENSUS</span>
            <span className="hidden text-zinc-600 sm:inline">/ COMBAT DESK</span>
          </Link>
          <CompetitionNav active="ufc" />
        </div>
        {children}
      </main>
    </div>
  );
}
