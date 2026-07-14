// Server-rendered triple probability views — all three values are in the DOM and the
// card's data-view attribute (flipped by ViewToggle) decides which one shows.

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function TriProb({ c, m, b }: { c: number; m: number; b: number }) {
  return (
    <>
      <span className="group-data-[view=model]:hidden group-data-[view=books]:hidden">{pct(c)}</span>
      <span className="hidden group-data-[view=model]:inline">{pct(m)}</span>
      <span className="hidden group-data-[view=books]:inline">{pct(b)}</span>
    </>
  );
}

export function TriBar({ c, m, b, h }: { c: number; m: number; b: number; h: string }) {
  const inner = (p: number) => (
    <>
      <div className="bg-red/90" style={{ width: pct(p) }} />
      <div className="bg-blue/80 flex-1" />
    </>
  );
  const base = `${h} overflow-hidden rounded-full bg-zinc-900`;
  return (
    <>
      <div className={`${base} flex group-data-[view=model]:hidden group-data-[view=books]:hidden`}>{inner(c)}</div>
      <div className={`${base} hidden group-data-[view=model]:flex`}>{inner(m)}</div>
      <div className={`${base} hidden group-data-[view=books]:flex`}>{inner(b)}</div>
    </>
  );
}

export function MethodChips({ method }: { method: { ko: number; sub: number; dec: number } }) {
  const item = (label: string, v: number) => (
    <span className="whitespace-nowrap">
      <span className="text-zinc-500">{label}</span> {Math.round(v * 100)}%
    </span>
  );
  return (
    <div className="flex justify-center gap-4 text-[10px] uppercase tracking-wider text-muted tabnums">
      {item("ko", method.ko)}
      {item("sub", method.sub)}
      {item("dec", method.dec)}
    </div>
  );
}
