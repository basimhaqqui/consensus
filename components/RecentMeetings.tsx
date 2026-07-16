import type { H2HGame } from "@/lib/match";

// Previous meetings between the two sides — actual scoreline, winner in bold
// (FotMob style), competition + date under each result.
export default function RecentMeetings({ games }: { games: H2HGame[] }) {
  if (games.length === 0) return null;
  return (
    <section className="terminal-panel mt-5 p-4">
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">
        Recent meetings
      </h2>
      <ul className="divide-y divide-line/40">
        {games.slice(0, 5).map((g, i) => (
          <Meeting key={i} g={g} />
        ))}
      </ul>
    </section>
  );
}

function Meeting({ g }: { g: H2HGame }) {
  const draw = g.winner === "draw";
  return (
    <li className="py-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
        <span
          className={`truncate text-right ${
            g.winner === "home" ? "font-semibold text-zinc-100" : "text-muted"
          }`}
        >
          {g.home}
          {g.winner === "home" && <WinChip />}
        </span>
        <span className="rounded-md bg-panel2/80 px-2 py-0.5 font-semibold tabnums text-zinc-200">
          {g.homeScore} – {g.awayScore}
        </span>
        <span
          className={`truncate text-left ${
            g.winner === "away" ? "font-semibold text-zinc-100" : "text-muted"
          }`}
        >
          {g.winner === "away" && <WinChip left />}
          {g.away}
        </span>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-zinc-600">
        {draw && <span className="text-zinc-500">Draw · </span>}
        {g.comp ? `${g.comp} · ` : ""}
        {g.date ? new Date(g.date).toISOString().slice(0, 10) : ""}
      </div>
    </li>
  );
}

function WinChip({ left }: { left?: boolean }) {
  return (
    <span
      className={`inline-block rounded-[4px] bg-[#1fa34a] px-1 text-[10px] font-bold leading-[1.5] text-white align-middle ${
        left ? "mr-1.5" : "ml-1.5"
      }`}
    >
      W
    </span>
  );
}
