import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "UFC CONSENSUS // Fight Terminal",
  description:
    "An MMA fight terminal: an independent fighter Elo model with win probabilities for every upcoming UFC bout — market odds and a public graded ledger next.",
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
    <div className={`${barlow.variable} ufc-theme flex min-h-screen flex-1 flex-col`}>
      {children}
    </div>
  );
}
