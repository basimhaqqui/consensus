import PicksBoard from "./PicksBoard";

export const metadata = { title: "My Picks — UFC CONSENSUS" };

export default function PicksPage() {
  return (
    <div>
      <header className="site-header site-header--compact">
        <div className="site-kicker">01 / Pick&apos;em</div>
        <h1 className="site-title site-title--small">My Picks</h1>
        <p className="site-subtitle">
          Every fight you called — winner, method, round — graded against the result and scored
          head-to-head with the model&apos;s picks from the same moment.
        </p>
      </header>

      <div className="mt-10">
        <PicksBoard />
      </div>
    </div>
  );
}
