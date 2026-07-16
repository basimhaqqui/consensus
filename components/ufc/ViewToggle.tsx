"use client";

// Three-way per-card view switch. The card root carries data-view="cons|model|books";
// probability spans/bars show or hide via group-data variants, so the card itself stays
// server-rendered and this is the only client code.
const BTN = "px-1.5 py-px rounded text-[10px] uppercase tracking-wider";

export default function ViewToggle() {
  const set = (e: React.MouseEvent<HTMLButtonElement>, v: string) =>
    e.currentTarget.closest("[data-view]")?.setAttribute("data-view", v);
  return (
    <span className="segmented-control flex items-center gap-0.5 p-0.5">
      <button
        type="button"
        onClick={(e) => set(e, "cons")}
        className={`${BTN} bg-warn/20 text-warn group-data-[view=model]:bg-transparent group-data-[view=model]:text-muted group-data-[view=books]:bg-transparent group-data-[view=books]:text-muted`}
      >
        cons
      </button>
      <button
        type="button"
        onClick={(e) => set(e, "model")}
        className={`${BTN} text-muted group-data-[view=model]:bg-accent/20 group-data-[view=model]:text-accent`}
      >
        model
      </button>
      <button
        type="button"
        onClick={(e) => set(e, "books")}
        className={`${BTN} text-muted group-data-[view=books]:bg-blue/20 group-data-[view=books]:text-blue`}
      >
        books
      </button>
    </span>
  );
}
