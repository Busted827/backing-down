import { useEffect, useRef, useState, type ReactNode } from "react";
import { Anchor, Flag, Gauge, Pause, Play, RotateCcw, Timer, Trophy, Volume2, VolumeX, Wrench } from "lucide-react";
import { BOATS, ENGINE_COST, PAINTS, TURN_COST, placeWord, type BoatId, type PaintId } from "@/game/content";
import { Game } from "@/game/Game";
import type { Snap } from "@/game/types";

const INITIAL: Snap = {
  phase: "title",
  ready: false,
  paused: false,
  muted: false,
  hasSeason: false,
  championships: 0,
  best: 0,
  heatName: "Parish Fair",
  heatBlurb: "",
  heatIndex: 0,
  heatCount: 4,
  timeLeft: 82,
  trailerAngle: 0,
  jackknife: false,
  speed: 0,
  playerPlace: 1,
  damage: 0,
  feetLeft: 0,
  rigs: [],
  points: 0,
  standings: [],
  engine: 0,
  turn: 0,
  boat: "jon",
  paint: "bone",
  ownedBoats: ["jon"],
  ownedPaints: ["bone"],
  results: [],
  headline: "",
  detail: "",
  seasonWon: false,
};

const PAINT_BG: Record<PaintId, string> = {
  bone: "bg-paint-bone",
  ember: "bg-primary",
  lake: "bg-paint-lake",
  night: "bg-paint-night",
};

function fmtTime(s: number) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
}

export function BackingDown() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snap>(INITIAL);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, setSnap);
    gameRef.current = game;
    const mq = window.matchMedia("(pointer: coarse), (max-width: 800px)");
    const apply = () => setTouch(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const g = () => gameRef.current;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg touch-none select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute right-3 top-3 z-20 flex gap-2">
          {snap.phase === "race" && (
            <IconButton label={snap.paused ? "Resume" : "Pause"} onClick={() => g()?.togglePause()}>
              {snap.paused ? <Play /> : <Pause />}
            </IconButton>
          )}
          <IconButton label={snap.muted ? "Unmute" : "Mute"} onClick={() => g()?.toggleMute()}>
            {snap.muted ? <VolumeX /> : <Volume2 />}
          </IconButton>
        </div>

        {snap.phase === "title" && (
          <section className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[58%] flex-col justify-end md:inset-y-0 md:left-0 md:max-h-none md:w-96">
            <div className="flex max-h-full flex-col gap-5 overflow-y-auto border-border bg-surface p-5 md:h-full md:border-r md:p-8">
              <div>
                <p className="font-display text-sm uppercase tracking-widest text-primary">One ramp. One winner.</p>
                <h1 className="mt-2 font-display text-5xl uppercase leading-none tracking-wide text-fg md:text-6xl">
                  Backing Down
                </h1>
                <p className="mt-4 text-pretty text-muted">
                  Race the dirt in reverse with a boat on the hitch. It ends in one parking lot and one ramp.
                  First hull in the water takes the heat. Everyone else is scored on distance and damage.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {snap.hasSeason ? (
                  <>
                    <Primary onClick={() => g()?.resumeSeason()}>Resume season</Primary>
                    <Secondary onClick={() => g()?.startSeason()}>Start over</Secondary>
                  </>
                ) : (
                  <Primary onClick={() => g()?.startSeason()}>Start</Primary>
                )}
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                <Tip icon={<RotateCcw className="text-primary" />} title="Back it down">
                  S or Down reverses you toward the ramp. W pulls forward when the trailer folds.
                </Tip>
                <Tip icon={<Gauge className="text-primary" />} title="Nose and boat disagree">
                  A turns the nose left, D right. In reverse the boat swings against it.
                </Tip>
                <Tip icon={<Anchor className="text-primary" />} title="Season garage">
                  Engine, tight turn, boats, and paint last four heats. Then they reset.
                </Tip>
              </ul>
              <p className="text-sm text-muted">
                {snap.championships > 0 ? `${snap.championships} season${snap.championships === 1 ? "" : "s"} won. ` : ""}
                {snap.best > 0 ? `Best haul ${snap.best} pts.` : "Stock truck. Stock jon boat. No one is owed a win."}
              </p>
            </div>
          </section>
        )}

        {snap.phase === "race" && (
          <>
            <Hud snap={snap} />
            {snap.paused && (
              <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-bg/80">
                <div className="flex flex-col items-center gap-4 bg-surface p-8">
                  <h2 className="font-display text-4xl uppercase tracking-wide">Paused</h2>
                  <Primary onClick={() => g()?.togglePause()}>Resume</Primary>
                </div>
              </div>
            )}
            {touch && !snap.paused && <TouchPad onHold={(which, down) => g()?.hold(which, down)} />}
          </>
        )}

        {snap.phase === "results" && (
          <Center>
            <p className="font-display text-sm uppercase tracking-widest text-primary">
              Heat {snap.heatIndex + 1} · {snap.heatName}
            </p>
            <h2 className="mt-2 font-display text-4xl uppercase leading-none tracking-wide">{snap.headline}</h2>
            <p className="mt-3 text-pretty text-muted">{snap.detail}</p>
            <ResultList snap={snap} />
            <div className="mt-5">
              <Primary onClick={() => g()?.continueAfterResults()}>
                {snap.heatIndex + 1 >= snap.heatCount ? "Season standings" : "To the pits"}
              </Primary>
            </div>
          </Center>
        )}

        {snap.phase === "garage" && (
          <Center>
            <Garage snap={snap} game={g} />
          </Center>
        )}

        {snap.phase === "champion" && (
          <Center>
            <p className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-primary">
              {snap.seasonWon && <Trophy />} Season over
            </p>
            <h2 className="mt-2 font-display text-4xl uppercase leading-none tracking-wide">{snap.headline}</h2>
            <p className="mt-3 text-pretty text-muted">{snap.detail}</p>
            <ol className="mt-5 flex flex-col gap-2">
              {snap.standings.map((row, i) => (
                <li key={row.name} className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 border-b border-border py-2">
                  <span className="font-display text-muted">{i + 1}</span>
                  <span className={row.isPlayer ? "text-primary" : ""}>{row.name}</span>
                  <span className="tabular-nums">{row.points}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-col gap-2">
              <Primary onClick={() => g()?.newSeasonFromChampion()}>Start</Primary>
              <Secondary onClick={() => g()?.backToTitle()}>Back</Secondary>
            </div>
          </Center>
        )}
      </div>
    </main>
  );
}

function Hud({ snap }: { snap: Snap }) {
  const mph = Math.round(Math.abs(snap.speed) * 2.237);
  const gear = snap.speed < -0.45 ? "Backing" : snap.speed > 0.45 ? "Pulling" : "Stopped";
  const needle = Math.max(-1, Math.min(1, snap.trailerAngle / 1.35));
  return (
    <div className="absolute inset-x-0 top-0 flex flex-col gap-3 p-3 md:p-5">
      <div className="flex items-start justify-between gap-3 pr-24">
        <div>
          <p className="font-display text-sm uppercase tracking-widest text-primary">
            Heat {snap.heatIndex + 1}/{snap.heatCount} · {snap.heatName}
          </p>
          <p className="font-display text-4xl uppercase leading-none text-fg">{placeWord(snap.playerPlace)}</p>
        </div>
        <div className="flex items-center gap-2 bg-surface px-3 py-2">
          <Timer className="text-primary" />
          <span className="font-display text-2xl tabular-nums">{fmtTime(snap.timeLeft)}</span>
        </div>
      </div>
      <div className="relative h-2 w-full max-w-xl bg-surface-2">
        <span className="absolute right-0 top-1/2 h-3 w-0.5 -translate-y-1/2 bg-primary" />
        {snap.rigs.map((rig) => (
          <span
            key={rig.name}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg"
            style={{ left: `${Math.max(0, Math.min(100, rig.progress * 100))}%`, background: rig.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Stat label={gear} value={`${mph}`} unit="mph" />
        <Stat label="To ramp" value={`${snap.feetLeft}`} unit="ft" />
        <Stat label="Hull" value={`${Math.round(snap.damage)}`} unit="%" />
        <div className="min-w-40">
          <p className="text-xs uppercase tracking-widest text-muted">Trailer</p>
          <div className="relative mt-1 h-2 w-40 bg-surface-2">
            <span className="absolute left-1/2 top-0 h-full w-px bg-muted" />
            <span
              className="absolute top-1/2 h-4 w-1 -translate-y-1/2 bg-primary"
              style={{ left: `${50 + needle * 46}%` }}
            />
          </div>
          {snap.jackknife && <p className="mt-1 text-xs uppercase tracking-wide text-primary">Straighten — pull forward</p>}
        </div>
      </div>
      <ul className="hidden max-w-xs flex-col gap-1 md:flex">
        {snap.rigs
          .slice()
          .sort((a, b) => a.place - b.place)
          .map((rig) => (
            <li key={rig.name} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 shrink-0" style={{ background: rig.color }} />
              <span className={rig.isPlayer ? "text-fg" : "text-muted"}>
                {placeWord(rig.place)} {rig.name}
              </span>
              <span className="ml-auto tabular-nums text-muted">{rig.launched ? "IN" : `${Math.round(rig.damage)}%`}</span>
            </li>
          ))}
      </ul>
      <p className="hidden text-sm text-muted md:block">S backs you down · W pulls forward · A left · D right</p>
    </div>
  );
}

function TouchPad({ onHold }: { onHold: (which: "back" | "pull" | "left" | "right", down: boolean) => void }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 pb-4">
      <HoldButton label="Pull forward" className="h-12 bg-surface-2 text-fg" onHold={(d) => onHold("pull", d)}>
        Pull forward
      </HoldButton>
      <div className="flex gap-2">
        <HoldButton
          label="Steer left"
          className="h-16 w-16 shrink-0 bg-surface-2 font-display text-xl text-fg"
          onHold={(d) => onHold("left", d)}
        >
          A
        </HoldButton>
        <HoldButton
          label="Back it down"
          className="h-16 flex-1 bg-primary text-on-primary"
          onHold={(d) => onHold("back", d)}
        >
          Back it down
        </HoldButton>
        <HoldButton
          label="Steer right"
          className="h-16 w-16 shrink-0 bg-surface-2 font-display text-xl text-fg"
          onHold={(d) => onHold("right", d)}
        >
          D
        </HoldButton>
      </div>
    </div>
  );
}

function Garage({ snap, game }: { snap: Snap; game: () => Game | null }) {
  const next = snap.heatIndex + 1;
  return (
    <>
      <p className="font-display text-sm uppercase tracking-widest text-primary">
        Pits · Heat {next} of {snap.heatCount}
      </p>
      <h2 className="mt-1 font-display text-4xl uppercase leading-none tracking-wide">{snap.heatName}</h2>
      <p className="mt-2 text-pretty text-muted">{snap.heatBlurb}</p>
      <p className="mt-3 font-display text-2xl tabular-nums">
        {snap.points} <span className="text-base text-muted">pts</span>
      </p>
      <div className="mt-4 grid gap-3">
        <Upgrade
          icon={<Gauge className="text-primary" />}
          title="Engine"
          level={snap.engine}
          note={snap.engine >= 2 ? "Top end. It still has to make the ramp." : "More reverse. You arrive with less time to think."}
          cost={snap.engine < 2 ? ENGINE_COST[snap.engine] : null}
          canBuy={snap.engine < 2 && snap.points >= ENGINE_COST[snap.engine]}
          onBuy={() => game()?.buyEngine()}
        />
        <Upgrade
          icon={<Wrench className="text-primary" />}
          title="Tight turn"
          level={snap.turn}
          note={snap.turn >= 2 ? "The trailer almost listens." : "Shorter nose swing, less jackknife."}
          cost={snap.turn < 2 ? TURN_COST[snap.turn] : null}
          canBuy={snap.turn < 2 && snap.points >= TURN_COST[snap.turn]}
          onBuy={() => game()?.buyTurn()}
        />
      </div>
      <h3 className="mt-5 font-display text-sm uppercase tracking-widest text-muted">Boat</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(Object.keys(BOATS) as BoatId[]).map((id) => {
          const boat = BOATS[id];
          const owned = snap.ownedBoats.includes(id);
          const selected = snap.boat === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!owned && snap.points < boat.price}
              onClick={() => game()?.buyBoat(id)}
              className={`border p-3 text-left ${selected ? "border-primary bg-surface-2" : "border-border bg-bg"} disabled:opacity-40`}
            >
              <span className="flex items-center justify-between font-display uppercase tracking-wide">
                {boat.name}
                <span className="text-sm text-muted">{owned ? "Owned" : `${boat.price}`}</span>
              </span>
              <span className="mt-1 block text-sm text-pretty text-muted">{boat.blurb}</span>
            </button>
          );
        })}
      </div>
      <h3 className="mt-5 font-display text-sm uppercase tracking-widest text-muted">Paint</h3>
      <div className="mt-2 flex gap-2">
        {(Object.keys(PAINTS) as PaintId[]).map((id) => {
          const paint = PAINTS[id];
          const owned = snap.ownedPaints.includes(id);
          const selected = snap.paint === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={`${paint.name} paint${owned ? "" : `, ${paint.price} points`}`}
              disabled={!owned && snap.points < paint.price}
              onClick={() => game()?.buyPaint(id)}
              className={`flex h-12 w-12 items-center justify-center border-2 disabled:opacity-40 ${selected ? "border-fg" : "border-transparent"}`}
            >
              <span className={`h-8 w-8 ${PAINT_BG[id]}`} />
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Primary onClick={() => game()?.gridUp()}>
          <Flag /> Grid up
        </Primary>
        <button type="button" className="h-11 text-sm text-muted" onClick={() => game()?.abandon()}>
          Abandon season
        </button>
      </div>
    </>
  );
}

function Upgrade({
  icon,
  title,
  level,
  note,
  cost,
  canBuy,
  onBuy,
}: {
  icon: ReactNode;
  title: string;
  level: number;
  note: string;
  cost: number | null;
  canBuy: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-border bg-bg p-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="font-display uppercase tracking-wide">
          {title} <span className="text-muted">{level}/2</span>
        </p>
        <p className="text-sm text-pretty text-muted">{note}</p>
      </div>
      {cost !== null && (
        <button
          type="button"
          disabled={!canBuy}
          onClick={onBuy}
          className="h-11 shrink-0 bg-primary px-3 font-display uppercase tracking-wide text-on-primary disabled:opacity-40"
        >
          {cost}
        </button>
      )}
    </div>
  );
}

function ResultList({ snap }: { snap: Snap }) {
  return (
    <ol className="mt-4">
      {snap.results.map((row) => (
        <li key={row.name} className="grid grid-cols-[3rem_1fr_auto] gap-2 border-b border-border py-2 text-sm">
          <span className="font-display text-lg">{placeWord(row.place)}</span>
          <span>
            <span className={row.isPlayer ? "text-primary" : ""}>{row.name}</span>
            <span className="mt-0.5 block text-muted">
              {row.launched ? "Launched" : `${row.feet} ft short`} · {row.damage}% hull
            </span>
          </span>
          <span className="tabular-nums text-fg">+{row.earned}</span>
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display text-2xl tabular-nums leading-none">
        {value}
        <span className="ml-1 text-sm text-muted">{unit}</span>
      </p>
    </div>
  );
}

function Tip({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="font-display uppercase tracking-wide text-fg">{title}</span>
        <span className="mt-0.5 block text-pretty text-muted">{children}</span>
      </span>
    </li>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-bg/80 p-3 md:items-center">
      <div className="max-h-full w-full max-w-lg overflow-y-auto bg-surface p-5 md:p-6">{children}</div>
    </div>
  );
}

function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-2 bg-primary font-display text-lg uppercase tracking-wide text-on-primary"
    >
      {children}
    </button>
  );
}

function Secondary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center border border-border bg-surface-2 font-display text-lg uppercase tracking-wide text-fg"
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center bg-surface text-fg"
    >
      {children}
    </button>
  );
}

function HoldButton({
  label,
  className,
  onHold,
  children,
}: {
  label: string;
  className: string;
  onHold: (down: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`font-display uppercase tracking-wide ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {children}
    </button>
  );
}
