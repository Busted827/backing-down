import { BOATS, ENGINE_COST, PAINTS, TRACKS, TURN_COST, payout, type BoatId, type PaintId } from "@/game/content";
import { AudioBus } from "@/game/audio";
import { Input } from "@/game/input";
import { cssHex, feet } from "@/game/math";
import { Renderer } from "@/game/render";
import { freshSeason, loadSave, writeSave, type SaveData, type Season } from "@/game/save";
import { Sim } from "@/game/sim";
import { HEAT_COUNT, type ResultRow, type Snap, type Standing } from "@/game/types";

type Probe = {
  getYaw: () => number;
  getSpeed: () => number;
  setKeys: (codes: string[]) => void;
  setSteer: (v: number) => void;
};

declare global {
  interface Window {
    __controlsTest?: Probe;
    __pendingStart?: boolean;
    __backing?: {
      phase: () => string;
      progress: () => number;
      speed: () => number;
      damage: () => number;
      launched: () => string[];
      rigs: () => { n: string; p: number; d: number; L: boolean }[];
      clock: () => number;
      jack: () => number;
      pos: () => { x: number; z: number; vx: number; vz: number };
    };
  }
}

const NAMES = ["You", "Crawdad", "June Bug", "Ramp Rat"];

export class Game {
  private sim = new Sim();
  private render: Renderer;
  private input = new Input();
  private audio = new AudioBus();
  private save: SaveData;
  private phase: Snap["phase"] = "title";
  private paused = false;
  private snap: Snap;
  private listeners = new Set<(snap: Snap) => void>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudAcc = 0;
  private dead = false;
  private results: ResultRow[] = [];
  private headline = "";
  private detail = "";
  private racingHeat = 0;
  private seasonWon = false;
  private onVis: () => void;

  constructor(canvas: HTMLCanvasElement, listener: (snap: Snap) => void) {
    this.save = loadSave();
    this.audio.muted = this.save.muted;
    this.render = new Renderer(canvas);
    this.sim.loadAttract();
    this.render.build(this.sim);
    this.listeners.add(listener);
    this.snap = this.makeSnap();
    this.attachProbe();
    this.onVis = () => {
      if (document.visibilityState === "visible") this.audio.resume();
    };
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("keydown", this.onEsc);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (window.__pendingStart) {
      window.__pendingStart = false;
      this.startSeason();
    } else {
      this.publish();
    }
  }

  subscribe(fn: (snap: Snap) => void) {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  getSnapshot() {
    return this.snap;
  }

  unlock() {
    this.audio.unlock();
  }

  startSeason() {
    this.audio.unlock();
    this.save.season = freshSeason();
    writeSave(this.save);
    this.paused = false;
    this.beginRace();
  }

  resumeSeason() {
    this.audio.unlock();
    if (!this.save.season) {
      this.startSeason();
      return;
    }
    this.phase = "garage";
    this.paused = false;
    this.publish();
  }

  gridUp() {
    if (!this.save.season) return;
    if (this.save.season.racesRun >= HEAT_COUNT) return;
    this.audio.unlock();
    this.paused = false;
    this.beginRace();
  }

  continueAfterResults() {
    const season = this.save.season;
    if (!season) {
      this.phase = "title";
      this.publish();
      return;
    }
    if (season.racesRun >= HEAT_COUNT) {
      this.crown();
      return;
    }
    this.phase = "garage";
    this.publish();
  }

  newSeasonFromChampion() {
    this.audio.unlock();
    this.save.season = freshSeason();
    writeSave(this.save);
    this.paused = false;
    this.beginRace();
  }

  backToTitle() {
    this.phase = "title";
    this.paused = false;
    this.sim.loadAttract();
    this.render.build(this.sim);
    this.publish();
  }

  abandon() {
    this.save.season = null;
    writeSave(this.save);
    this.backToTitle();
  }

  toggleMute() {
    this.save.muted = !this.save.muted;
    this.audio.setMuted(this.save.muted);
    writeSave(this.save);
    this.publish();
  }

  togglePause() {
    if (this.phase !== "race") return;
    this.paused = !this.paused;
    this.publish();
  }

  buyEngine() {
    const season = this.save.season;
    if (!season || season.engine >= 2) return;
    const cost = ENGINE_COST[season.engine];
    if ((season.points.You ?? 0) < cost) return;
    season.points.You -= cost;
    season.engine = (season.engine + 1) as 0 | 1 | 2;
    writeSave(this.save);
    this.publish();
  }

  buyTurn() {
    const season = this.save.season;
    if (!season || season.turn >= 2) return;
    const cost = TURN_COST[season.turn];
    if ((season.points.You ?? 0) < cost) return;
    season.points.You -= cost;
    season.turn = (season.turn + 1) as 0 | 1 | 2;
    writeSave(this.save);
    this.publish();
  }

  buyBoat(id: BoatId) {
    const season = this.save.season;
    if (!season) return;
    if (!season.ownedBoats.includes(id)) {
      const cost = BOATS[id].price;
      if ((season.points.You ?? 0) < cost) return;
      season.points.You -= cost;
      season.ownedBoats.push(id);
    }
    season.boat = id;
    writeSave(this.save);
    this.publish();
  }

  buyPaint(id: PaintId) {
    const season = this.save.season;
    if (!season) return;
    if (!season.ownedPaints.includes(id)) {
      const cost = PAINTS[id].price;
      if ((season.points.You ?? 0) < cost) return;
      season.points.You -= cost;
      season.ownedPaints.push(id);
    }
    season.paint = id;
    if (this.sim.player) {
      this.sim.player.color = PAINTS[id].color;
      this.render.setPaint(this.sim.player.id, PAINTS[id].color);
    }
    writeSave(this.save);
    this.publish();
  }

  hold(which: "back" | "pull" | "left" | "right", down: boolean) {
    this.input[which] = down;
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.audio.destroy();
    this.render.dispose();
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("keydown", this.onEsc);
    if (window.__controlsTest) delete window.__controlsTest;
    if (window.__backing) delete window.__backing;
  }

  private onEsc = (e: KeyboardEvent) => {
    if (e.code === "Escape") this.togglePause();
  };

  private beginRace() {
    const season = this.save.season;
    if (!season) return;
    this.racingHeat = season.racesRun;
    this.phase = "race";
    this.results = [];
    this.headline = "";
    this.sim.loadRace(this.racingHeat, {
      engine: season.engine,
      turn: season.turn,
      boat: season.boat,
      paint: season.paint,
    });
    this.render.build(this.sim);
    this.sim.dirty = false;
    this.publish();
  }

  private finishRace() {
    const season = this.save.season;
    if (!season) return;
    this.sim.frozen = true;
    const rows: ResultRow[] = this.sim.rigs
      .slice()
      .sort((a, b) => a.place - b.place)
      .map((rig) => {
        const earned = payout(rig.place, rig.damage, rig.launched);
        season.points[rig.name] = (season.points[rig.name] ?? 0) + earned;
        return {
          name: rig.name,
          place: rig.place,
          launched: rig.launched,
          feet: feet(this.sim.track.total - rig.progress),
          damage: Math.round(rig.damage),
          earned,
          isPlayer: rig.isPlayer,
          color: cssHex(rig.color),
        };
      });
    this.results = rows;
    const winner = rows[0];
    const you = rows.find((r) => r.isPlayer);
    if (winner?.launched && winner.isPlayer) {
      this.headline = "You put it in the water.";
      this.detail = "First hull down the only ramp. The rest were just close.";
    } else if (winner?.launched && !winner.isPlayer) {
      this.headline = `${winner.name} snaked the ramp.`;
      this.detail = you
        ? `You finish ${you.place === 2 ? "2nd" : you.place === 3 ? "3rd" : "4th"} — ${you.feet} ft short, hull ${you.damage}% hurt.`
        : "Somebody else launched.";
    } else if (you?.place === 1) {
      this.headline = "Nobody launched. You were closest.";
      this.detail = "Distance and damage decided it. The lake is still empty.";
    } else {
      this.headline = `${winner?.name ?? "Somebody"} was closer.`;
      this.detail = "No boat made the water. Places went to distance, then damage.";
    }
    season.racesRun += 1;
    season.round = Math.min(HEAT_COUNT - 1, season.racesRun);
    writeSave(this.save);
    this.phase = "results";
    this.paused = false;
    this.publish();
  }

  private crown() {
    const season = this.save.season;
    if (!season) return;
    const standings = this.standings(season);
    const best = standings[0];
    const you = season.points.You ?? 0;
    const leaders = standings.filter((s) => s.points === (best?.points ?? 0));
    this.seasonWon = leaders.length === 1 && !!leaders[0]?.isPlayer;
    if (this.seasonWon) {
      this.save.championships += 1;
      this.headline = "You took the season.";
      this.detail = "The garage is empty again. Engine, turn, boats, and paint go back to zero.";
    } else if (leaders.some((s) => s.isPlayer)) {
      this.headline = "Split season.";
      this.detail = "You tied the top. The garage still empties — nothing carries over.";
    } else {
      this.headline = `${best?.name ?? "Someone"} took the season.`;
      this.detail = "Upgrades do not carry. Next season starts stock, same as everyone.";
    }
    this.save.best = Math.max(this.save.best, you);
    this.save.season = null;
    writeSave(this.save);
    this.phase = "champion";
    this.publish();
  }

  private standings(season: Season): Standing[] {
    return NAMES.map((name) => ({
      name,
      points: season.points[name] ?? 0,
      isPlayer: name === "You",
    })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }

  private frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    const h = 1 / 60;
    let steps = 0;
    const racing = this.phase === "race" && !this.paused;
    const attract = this.phase === "title";
    while ((racing || attract) && this.acc >= h && steps < 8) {
      this.sim.step(h, this.input.getActions(), racing ? "race" : "attract");
      this.acc -= h;
      steps += 1;
    }
    if (!racing && !attract) this.acc = 0;
    if (this.sim.dirty) {
      this.sim.dirty = false;
      this.render.build(this.sim);
    }
    if (this.sim.events.hits) this.render.shake = Math.min(0.45, this.render.shake + 0.16);
    if (this.sim.events.splash) {
      this.audio.splash();
      this.render.shake = 0.4;
    } else if (this.sim.events.hits) this.audio.hit();
    if (racing && this.sim.finished) this.finishRace();
    const focus = this.sim.player ?? this.sim.rigs[0];
    this.audio.engineSpeed(focus && (racing || attract) ? focus.speed : 0);
    this.render.resize();
    this.render.draw(this.sim, dt || h);
    this.hudAcc += dt;
    if (this.phase === "race" && this.hudAcc > 0.1) {
      this.hudAcc = 0;
      this.publish();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private attachProbe() {
    const probe: Probe = {
      getYaw: () => this.sim.player?.yaw ?? 0,
      getSpeed: () => this.sim.player?.speed ?? 0,
      setKeys: (codes) => this.input.setKeys(codes),
      setSteer: (v) => this.input.setSteer(v),
    };
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("qa")) {
      window.__controlsTest = probe;
      window.__backing = {
        phase: () => this.phase,
        progress: () => this.sim.player?.progress ?? 0,
        speed: () => this.sim.player?.speed ?? 0,
        damage: () => this.sim.player?.damage ?? 0,
        launched: () => this.sim.rigs.filter((r) => r.launched).map((r) => r.name),
        rigs: () =>
          this.sim.rigs.map((r) => ({
            n: r.name,
            p: Math.round(r.progress),
            d: Math.round(r.damage),
            L: r.launched,
          })),
        clock: () => this.sim.time,
        jack: () => this.sim.player?.jack ?? 0,
        pos: () => ({
          x: this.sim.player?.x ?? 0,
          z: this.sim.player?.z ?? 0,
          vx: this.sim.player?.vx ?? 0,
          vz: this.sim.player?.vz ?? 0,
        }),
      };
    }
  }

  private publish() {
    this.snap = this.makeSnap();
    for (const fn of this.listeners) fn(this.snap);
  }

  private makeSnap(): Snap {
    const season = this.save.season;
    const track = this.sim.track;
    const shown =
      this.phase === "race" || this.phase === "results"
        ? TRACKS[this.racingHeat] ?? TRACKS[0]
        : TRACKS[Math.min(season?.racesRun ?? 0, TRACKS.length - 1)];
    const heatIndex =
      this.phase === "race" || this.phase === "results" ? this.racingHeat : (season?.racesRun ?? 0);
    const player = this.sim.player;
    const rigs = this.sim.rigs.map((rig) => ({
      name: rig.name,
      place: rig.place,
      progress: track.total ? rig.progress / track.total : 0,
      damage: rig.damage,
      launched: rig.launched,
      isPlayer: rig.isPlayer,
      color: cssHex(rig.color),
    }));
    return {
      phase: this.phase,
      ready: true,
      paused: this.paused,
      muted: this.save.muted,
      hasSeason: !!season,
      championships: this.save.championships,
      best: this.save.best,
      heatName: this.phase === "title" ? TRACKS[0].name : (shown?.name ?? ""),
      heatBlurb: shown?.blurb ?? "",
      heatIndex: Math.min(heatIndex, HEAT_COUNT - 1),
      heatCount: HEAT_COUNT,
      timeLeft: this.sim.timeLeft,
      trailerAngle: player?.jack ?? 0,
      jackknife: Math.abs(player?.jack ?? 0) > 0.85,
      speed: player?.speed ?? 0,
      playerPlace: player?.place ?? 1,
      damage: player?.damage ?? 0,
      feetLeft: feet(track.total - (player?.progress ?? 0)),
      rigs,
      points: season?.points.You ?? 0,
      standings: season ? this.standings(season) : [],
      engine: season?.engine ?? 0,
      turn: season?.turn ?? 0,
      boat: season?.boat ?? "jon",
      paint: season?.paint ?? "bone",
      ownedBoats: season?.ownedBoats ?? ["jon"],
      ownedPaints: season?.ownedPaints ?? ["bone"],
      results: this.results,
      headline: this.headline,
      detail: this.detail,
      seasonWon: this.seasonWon,
    };
  }
}
