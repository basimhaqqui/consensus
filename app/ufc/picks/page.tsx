import Link from "next/link";
import PicksBoard from "./PicksBoard";

export const metadata = { title: "My Picks — UFC CONSENSUS" };

export default function PicksPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <div className="pt-5">
        <Link href="/ufc" className="display text-base font-bold tracking-tight flex items-center gap-1.5">
          <span className="text-accent">▸</span> UFC CONSENSUS
        </Link>
      </div>

      <header className="pt-8 pb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Pick&apos;em</div>
        <h1 className="display mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight">My Picks</h1>
        <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">
          Every fight you called — winner, method, round — graded against the result and scored
          head-to-head with the model&apos;s picks from the same moment.
        </p>
      </header>

      <PicksBoard />
    </div>
  );
}
