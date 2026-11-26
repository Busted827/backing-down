import { AI, BOATS, PAINTS, TRACKS, type BoatId, type PaintId } from "@/game/content";
import { clamp, wrapAngle } from "@/game/math";
import { buildTrack, project, RAMP_HALF, spawnPose, type BuiltTrack } from "@/game/track";
import type { Actions } from "@/game/input";

export const HITCH = 1.9;
export const TONGUE = 2.65;

/** Dirt trailer assist. The lot does not get any of this. */
export const DIRT_JACK_BASE = 0.12; // rad/s the bend can drift with the wheel centered
export const DIRT_JACK_STEER = 1.0; // extra rad/s of bend at full lock
export const DIRT_JACK_CAP = 1.05; // ~60°: the dirt never folds the boat
export const DIRT_FOLLOW = 1.3; // 1/s: how fast your truck swings in behind the boat off the wheel
// Rivals straighten up quicker. This stands in for steady hands; their steering is a
// simple controller and it over-swings the boat at the player's setting.
export const DIRT_FOLLOW_AI = 1.7;
export const DIRT_WALL_DAMAGE = 0.5; // dirt walls and bales hurt half as much as the lot

export type Stats = {
  revMax: number;
  revAccel: number;
  fwdMax: number;
  fwdAccel: number;
  turnRate: number;
  stability: number;
  fragility: number;
  mass: number;
  halfWidth: number;
  angleTol: number;
};

export function statsFor(engine: number, turn: number, boat: BoatId): Stats {
  const b = BOATS[boat];
  const revMax = [11.4, 13.6, 16][engine] ?? 11.4;
  const revAccel = [20, 26, 33][engine] ?? 20;
  const fwdMax = [9, 10, 11][engine] ?? 9;
  const fwdAccel = [18, 20, 22][engine] ?? 18;
  const turnRate = [1.9, 2.3, 2.75][turn] ?? 1.9;
  const stability = [0.7, 1.35, 2.15][turn] ?? 0.7;
  return {
    revMax,
    revAccel,
    fwdMax,
    fwdAccel,
    turnRate,
    stability,
    fragility: b.fragility,
    mass: b.mass,
    halfWidth: b.halfWidth,
    angleTol: b.angleTol,
  };
}

export type Rig = {
  id: string;
  name: string;
  isPlayer: boolean;
  color: number;
  boat: BoatId;
  engine: number;
  turn: number;
  skill: number;
  nerve: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  vx: number;
  vz: number;
  axleX: number;
  axleZ: number;
  trailerYaw: number;
  holdYaw: number;
  holdTruck: number;
  steerCmd: number;
  jack: number;
  damage: number;
  launched: boolean;
  progress: number;
  place: number;
  hitCd: number;
  jackCd: number;
  failCd: number;
  recover: number;
  stuck: number;
  stuckMark: number;
  seed: number;
};

export class Sim {
  track: BuiltTrack = buildTrack(TRACKS[0]);
  rigs: Rig[] = [];
  player: Rig | null = null;
  time = 0;
  timeLeft = 78;
  outro = 0;
  finished = false;
  frozen = false;
  dirty = false;
  events = { hits: 0, splash: 0, jack: 0 };

  loadAttract() {
    this.track = buildTrack(TRACKS[0]);
    this.time = 0;
    this.timeLeft = 78;
    this.outro = 0;
    this.finished = false;
    this.frozen = false;
    this.player = null;
    this.rigs = AI.map((ai, i) => this.makeRig(ai.name, false, ai.color, ai.boat, 0, 0, ai.skill, ai.nerve, i));
    this.placeAll();
  }

  loadRace(round: number, player: { engine: number; turn: number; boat: BoatId; paint: PaintId }) {
    this.track = buildTrack(TRACKS[round % TRACKS.length]);
    this.time = 0;
    this.timeLeft = 82;
    this.outro = 0;
    this.finished = false;
    this.frozen = false;
    const paint = PAINTS[player.paint].color;
    const ais = AI.map((ai, i) => this.makeRig(ai.name, false, ai.color, ai.boat, 0, 0, ai.skill, ai.nerve, i + 1));
    this.player = this.makeRig("You", true, paint, player.boat, player.engine, player.turn, 1, 1, 0);
    this.rigs = [this.player, ...ais];
    this.placeAll();
  }

  private makeRig(
    name: string,
    isPlayer: boolean,
    color: number,
    boat: BoatId,
    engine: number,
    turn: number,
    skill: number,
    nerve: number,
    slot: number,
  ): Rig {
    return {
      id: name,
      name,
      isPlayer,
      color,
      boat,
      engine,
      turn,
      skill,
      nerve,
      x: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      vx: 0,
      vz: 0,
      axleX: 0,
      axleZ: 0,
      trailerYaw: 0,
      holdYaw: 0,
      holdTruck: 0,
      steerCmd: 0,
      jack: 0,
      damage: 0,
      launched: false,
      progress: 0,
      place: slot + 1,
      hitCd: 0,
      jackCd: 0,
      failCd: 0,
      recover: 0,
      stuck: 0,
      stuckMark: 0,
      seed: slot * 1.7 + 0.4,
    };
  }

  private placeAll() {
    const edge = this.track.baseWidth / 2 - 2.5;
    const fracs = [-0.78, -0.26, 0.26, 0.78];
    const dists = [12, 16, 12, 16];
    this.rigs.forEach((rig, i) => {
      const pose = spawnPose(this.track, dists[i] ?? 14, fracs[i] * edge);
      this.plant(rig, pose.x, pose.z, pose.yaw, pose.dist);
    });
  }

  private plant(rig: Rig, x: number, z: number, yaw: number, dist: number) {
    rig.x = x;
    rig.z = z;
    rig.yaw = yaw;
    rig.trailerYaw = yaw;
    rig.holdYaw = yaw;
    rig.holdTruck = yaw;
    rig.speed = 0;
    rig.vx = 0;
    rig.vz = 0;
    rig.progress = dist;
    rig.launched = false;
    rig.damage = 0;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    rig.axleX = x - fx * (HITCH + TONGUE);
    rig.axleZ = z - fz * (HITCH + TONGUE);
    rig.jack = 0;
  }

  step(dt: number, actions: Actions, mode: "attract" | "race") {
    if (this.frozen) return;
    this.events.hits = 0;
    this.events.splash = 0;
    this.events.jack = 0;
    this.time += dt;

    if (mode === "race" && this.outro <= 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0 && !this.finished) this.outro = 0.7;
    }

    for (const rig of this.rigs) {
      rig.hitCd = Math.max(0, rig.hitCd - dt);
      rig.jackCd = Math.max(0, rig.jackCd - dt);
      rig.failCd = Math.max(0, rig.failCd - dt);
      if (rig.launched) continue;
      rig.holdYaw = rig.trailerYaw;
      rig.holdTruck = rig.yaw;
      const act = rig.isPlayer ? actions : this.ai(rig, dt);
      this.integrate(rig, act, dt);
    }

    for (let n = 0; n < 2; n++) {
      for (const rig of this.rigs) {
        if (rig.launched) continue;
        this.collideRig(rig);
        this.solveTrailer(rig, dt, false);
      }
      this.separate();
      for (const rig of this.rigs) {
        if (!rig.launched) this.solveTrailer(rig, dt, false);
      }
    }
    for (const rig of this.rigs) {
      if (!rig.launched) this.solveTrailer(rig, dt, true);
    }

    for (const rig of this.rigs) {
      if (rig.launched) continue;
      const pr = project(this.track, rig.x, rig.z, rig.progress);
      rig.progress = pr.dist;
      this.tryLaunch(rig, pr.lateral);
    }
    this.rank();

    if (this.outro > 0) {
      this.outro -= dt;
      if (this.outro <= 0) this.finished = true;
    }

    if (mode === "attract" && this.finished) {
      this.loadAttract();
      this.dirty = true;
    }
  }

  private ai(rig: Rig, dt: number): Actions {
    const ang = rig.jack;
    const remain = this.track.total - rig.progress;
    const lot = this.track.lot;
    let dx: number;
    let dz: number;
    if (rig.progress >= lot.start - 2) {
      const gate = this.track.sample(Math.min(this.track.total - 0.4, Math.max(lot.ramp - 1, rig.progress + 8)));
      const rx = gate.dz;
      const rz = -gate.dx;
      const lane = ((rig.seed % 7) - 3) * 3.4;
      const spread = remain < 18 ? 0 : lane * (0.45 + (1 - rig.skill) * 0.35);
      dx = gate.x + rx * spread - rig.x;
      dz = gate.z + rz * spread - rig.z;
    } else {
      const look = 12 + rig.skill * 6;
      const ahead = this.track.sample(Math.min(lot.start, rig.progress + look));
      // On the dirt they aim the boat, not the truck: the trailer leads when backing.
      dx = ahead.x - rig.axleX;
      dz = ahead.z - rig.axleZ;
    }
    const dirt = rig.progress < lot.start - 2;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    let desired = Math.atan2(dx, dz);
    desired += Math.sin(this.time * (1.6 + rig.seed) + rig.seed) * (1 - rig.skill) * 0.28;

    // On the dirt the bend is capped short of a fold, so a big bend is a turn, not a fold.
    if (!dirt && Math.abs(ang) > 1.02) rig.recover = Math.max(rig.recover, 0.65);
    // Pinned on a bale or a wall: the dirt assist means the hinge never trips the
    // recover above, so a stall is the other reason to pull forward and re-aim.
    // Progress, not speed, is the test: a rig grinding along a wall still shows speed.
    if (rig.progress > rig.stuckMark + 1.5 || rig.recover > 0 || this.time < 4) {
      rig.stuck = 0;
      rig.stuckMark = rig.progress;
    } else rig.stuck += dt;
    if (rig.stuck > 1.1) {
      rig.stuck = 0;
      rig.recover = 0.9;
    }
    // Spun around on the dirt (a shove, a bad recover): drive forward and swing the
    // nose toward the course until the boat points down the track again.
    const lost = dirt && Math.abs(wrapAngle(desired - rig.trailerYaw)) > 1.3;
    if (lost) rig.recover = Math.max(rig.recover, 0.3);
    if (rig.recover > 0) {
      rig.recover -= dt;
      // In the lot, straighten. On the dirt, swing the nose so the boat will back
      // toward the course when they reverse again, not back into the same wall.
      if (!lost && !dirt) desired = rig.trailerYaw;
    }

    const reverse = rig.speed >= 0 ? 1 : -1;
    let err: number;
    let steer: number;
    if (dirt && rig.recover <= 0) {
      // Steer the boat's heading. With the dirt assist this is the same hands a player uses.
      err = wrapAngle(desired - rig.trailerYaw);
      // Still rolling forward from a pull: reverse steering would turn the wrong way.
      steer = rig.speed > 0.2 ? 0 : clamp(-err * 2.5, -1, 1);
    } else {
      err = wrapAngle(desired - rig.yaw);
      steer = clamp(err * 1.7 * reverse, -1, 1);
    }

    // Nudge off a rig that's ahead and close.
    for (const other of this.rigs) {
      if (other === rig || other.progress < rig.progress) continue;
      const ox = other.x - rig.x;
      const oz = other.z - rig.z;
      const d = Math.hypot(ox, oz);
      if (d < 7 && d > 0.01) {
        const rx = dz;
        const rz = -dx;
        const side = Math.sign(ox * rx + oz * rz) || 1;
        steer += -side * (1 - d / 7) * 0.85 * reverse;
      }
    }
    steer = clamp(steer, -1, 1);

    let throttle = -0.86 - rig.skill * 0.14;
    const corner = Math.min(1, Math.abs(err) / 0.7);
    throttle += corner * 0.45;
    if (dirt) {
      // Brake for the bend that is coming, not only the one they are already in.
      const a = this.track.sample(rig.progress + 6);
      const b = this.track.sample(Math.min(lot.start, rig.progress + 24));
      const bend = Math.abs(wrapAngle(Math.atan2(b.dx, b.dz) - Math.atan2(a.dx, a.dz)));
      throttle += clamp(bend * 0.9, 0, 0.55) * (1.15 - rig.nerve * 0.3);
    }
    if (rig.recover > 0) throttle = 1;
    if (remain < 28) {
      const aim = Math.abs(wrapAngle(rig.trailerYaw - Math.atan2(dx, dz)));
      const commit = 0.35 + rig.nerve * 0.55;
      throttle = aim < rig.skill * 0.55 + 0.2 ? -commit : -0.18;
      if (Math.abs(ang) > 0.75) throttle = 0.85;
    }
    if (remain < 8 && Math.abs(ang) < 0.45) throttle = -0.55 - rig.nerve * 0.35;
    return { throttle: clamp(throttle, -1, 1), steer };
  }

  private integrate(rig: Rig, act: Actions, dt: number) {
    const st = statsFor(rig.engine, rig.turn, rig.boat);
    rig.steerCmd = act.steer;
    const pr = project(this.track, rig.x, rig.z, rig.progress);
    let inMud = false;
    for (const m of this.track.muds) {
      if ((rig.x - m.x) ** 2 + (rig.z - m.z) ** 2 < m.r * m.r) inMud = true;
    }
    const off = Math.abs(pr.lateral) > this.track.halfAt(pr.dist) - 0.2;
    let drag = act.throttle === 0 ? 1.35 : 0.42;
    if (inMud) drag += 2.4;
    if (off) drag += 1.5;
    const accel = act.throttle >= 0 ? st.fwdAccel : st.revAccel;
    rig.speed += (act.throttle * accel * dt) / st.mass;
    rig.speed *= Math.exp(-drag * dt);
    rig.speed = clamp(rig.speed, -st.revMax, st.fwdMax);

    // A = steer +1 increases yaw while moving forward (nose left on the race cam).
    const speedFactor = clamp(Math.abs(rig.speed) / 6.2, 0.45, 1);
    const reverse = rig.speed >= 0 ? 1 : -1;
    rig.yaw += act.steer * st.turnRate * speedFactor * reverse * dt;

    const fx = -Math.sin(rig.yaw);
    const fz = -Math.cos(rig.yaw);
    const tx = fx * rig.speed;
    const tz = fz * rig.speed;
    const grip = inMud ? 3.5 : 8.5;
    const k = 1 - Math.exp(-grip * dt);
    rig.vx += (tx - rig.vx) * k;
    rig.vz += (tz - rig.vz) * k;
    rig.x += rig.vx * dt;
    rig.z += rig.vz * dt;
    this.solveTrailer(rig, dt, false);

    const aj = Math.abs(rig.jack);
    if (aj > 1.2) {
      rig.damage = Math.min(100, rig.damage + (aj - 1.2) * 26 * st.fragility * dt);
      rig.speed *= Math.exp(-2.2 * dt);
    }
    if (aj > 1.55 && rig.jackCd <= 0) {
      rig.damage = Math.min(100, rig.damage + 9 * st.fragility);
      rig.speed *= 0.4;
      rig.jackCd = 0.85;
      this.events.jack += 1;
      this.events.hits += 1;
    }
  }

  private solveTrailer(rig: Rig, dt: number, damp: boolean) {
    const st = statsFor(rig.engine, rig.turn, rig.boat);
    const fx = -Math.sin(rig.yaw);
    const fz = -Math.cos(rig.yaw);
    const hitchX = rig.x - fx * HITCH;
    const hitchZ = rig.z - fz * HITCH;
    let dx = hitchX - rig.axleX;
    let dz = hitchZ - rig.axleZ;
    let dist = Math.hypot(dx, dz);
    if (dist < 1e-4) {
      dx = fx;
      dz = fz;
      dist = 1;
    }
    const nx = dx / dist;
    const nz = dz / dist;
    rig.axleX = hitchX - nx * TONGUE;
    rig.axleZ = hitchZ - nz * TONGUE;
    rig.trailerYaw = Math.atan2(-nx, -nz);
    if (damp) {
      if (rig.speed < -0.05) {
        const inLot = rig.progress >= this.track.lot.start - 3;
        const prevJack = wrapAngle(rig.holdTruck - rig.holdYaw);
        const kinJack = wrapAngle(rig.yaw - rig.trailerYaw);
        const steer = Math.min(1, Math.abs(rig.steerCmd));
        const delta = wrapAngle(kinJack - prevJack);
        if (inLot) {
          // The lot keeps the raw hinge: it walks out and folds if you let it.
          const maxRate = 0.22 + steer * 1.05;
          const jack = prevJack + clamp(delta, -maxRate * dt, maxRate * dt);
          rig.trailerYaw = wrapAngle(rig.yaw - jack);
        } else {
          // The dirt gets trailer assist. Steering still swings the boat off the ball,
          // but the bend is capped short of a fold, and easing off the wheel lets the
          // truck swing in behind the boat. The boat keeps the heading you gave it.
          const maxRate = DIRT_JACK_BASE + steer * DIRT_JACK_STEER;
          let jack = prevJack + clamp(delta, -maxRate * dt, maxRate * dt);
          jack = clamp(jack, -DIRT_JACK_CAP, DIRT_JACK_CAP);
          const follow = (rig.isPlayer ? DIRT_FOLLOW : DIRT_FOLLOW_AI) * (1 - steer) * clamp(Math.abs(rig.speed) / 6, 0.4, 1.4);
          const ease = jack * (1 - Math.exp(-follow * dt));
          jack -= ease;
          rig.yaw = wrapAngle(rig.yaw - ease);
          rig.trailerYaw = wrapAngle(rig.yaw - jack);
        }
      } else if (rig.speed > 0.2) {
        const err = wrapAngle(rig.yaw - rig.trailerYaw);
        const pull = Math.max(1.6, st.stability);
        rig.trailerYaw = wrapAngle(rig.trailerYaw + clamp(err, -pull * dt, pull * dt));
      }
      const hx = rig.x + Math.sin(rig.yaw) * HITCH;
      const hz = rig.z + Math.cos(rig.yaw) * HITCH;
      const tfx = -Math.sin(rig.trailerYaw);
      const tfz = -Math.cos(rig.trailerYaw);
      rig.axleX = hx - tfx * TONGUE;
      rig.axleZ = hz - tfz * TONGUE;
    }
    rig.jack = wrapAngle(rig.yaw - rig.trailerYaw);
  }

  private collideRig(rig: Rig) {
    const fx = -Math.sin(rig.yaw);
    const fz = -Math.cos(rig.yaw);
    const circles = [
      { x: rig.x + fx * 1.2, z: rig.z + fz * 1.2, r: 0.78 },
      { x: rig.x - fx * 1.05, z: rig.z - fz * 1.05, r: 0.78 },
      { x: rig.axleX, z: rig.axleZ, r: 0.82 },
    ];
    let hit = false;
    let px = 0;
    let pz = 0;
    for (const c of circles) {
      const push = this.pushCircle(c.x, c.z, c.r);
      if (push.hit) {
        hit = true;
        px += push.x;
        pz += push.z;
      }
    }
    if (!hit) return;
    rig.x += px;
    rig.z += pz;
    rig.axleX += px;
    rig.axleZ += pz;
    const impact = Math.abs(rig.speed);
    rig.speed *= 0.9;
    if (impact > 3.2 && rig.hitCd <= 0) {
      const st = statsFor(rig.engine, rig.turn, rig.boat);
      const soft = rig.progress < this.track.lot.start - 3 ? DIRT_WALL_DAMAGE : 1;
      rig.damage = Math.min(100, rig.damage + impact * 0.85 * st.fragility * soft);
      rig.hitCd = 0.22;
      this.events.hits += 1;
    }
  }

  private pushCircle(cx: number, cz: number, radius: number) {
    let x = 0;
    let z = 0;
    let hit = false;
    let ccx = cx;
    let ccz = cz;
    for (const w of this.track.walls) {
      const abx = w.bx - w.ax;
      const abz = w.bz - w.az;
      const ab2 = abx * abx + abz * abz || 1;
      const t = clamp(((ccx - w.ax) * abx + (ccz - w.az) * abz) / ab2, 0, 1);
      const qx = w.ax + abx * t;
      const qz = w.az + abz * t;
      let dx = ccx - qx;
      let dz = ccz - qz;
      let d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d < 1e-4) {
          dx = -abz;
          dz = abx;
          d = Math.hypot(dx, dz) || 1;
        }
        const pen = radius - d + 0.02;
        const nx = dx / d;
        const nz = dz / d;
        x += nx * pen;
        z += nz * pen;
        ccx += nx * pen;
        ccz += nz * pen;
        hit = true;
      }
    }
    for (const b of this.track.bales) {
      let dx = ccx - b.x;
      let dz = ccz - b.z;
      let d = Math.hypot(dx, dz);
      const min = radius + b.r;
      if (d < min) {
        if (d < 1e-4) {
          dx = 1;
          dz = 0;
          d = 1;
        }
        const pen = min - d;
        const nx = dx / d;
        const nz = dz / d;
        x += nx * pen;
        z += nz * pen;
        ccx += nx * pen;
        ccz += nz * pen;
        hit = true;
      }
    }
    return { x, z, hit };
  }

  private separate() {
    const bodies: { rig: Rig; x: number; z: number; r: number }[] = [];
    for (const rig of this.rigs) {
      if (rig.launched) continue;
      bodies.push({ rig, x: rig.x, z: rig.z, r: 1.05 });
      bodies.push({ rig, x: rig.axleX, z: rig.axleZ, r: 0.95 });
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.rig === b.rig) continue;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.r + b.r;
        if (d >= min || d < 1e-4) continue;
        const pen = (min - d) / 2;
        dx /= d;
        dz /= d;
        a.rig.x -= dx * pen;
        a.rig.z -= dz * pen;
        b.rig.x += dx * pen;
        b.rig.z += dz * pen;
        a.x -= dx * pen;
        a.z -= dz * pen;
        b.x += dx * pen;
        b.z += dz * pen;
        // Closing speed, not the sum of both speedometers: two rigs side by side at
        // full reverse are not crashing into each other.
        const rel = Math.hypot(a.rig.vx - b.rig.vx, a.rig.vz - b.rig.vz);
        if (rel > 8 && a.rig.hitCd <= 0 && b.rig.hitCd <= 0) {
          const bump = rel * 0.22;
          a.rig.damage = Math.min(100, a.rig.damage + bump * statsFor(a.rig.engine, a.rig.turn, a.rig.boat).fragility);
          b.rig.damage = Math.min(100, b.rig.damage + bump * statsFor(b.rig.engine, b.rig.turn, b.rig.boat).fragility);
          a.rig.hitCd = 0.2;
          b.rig.hitCd = 0.2;
          a.rig.speed *= 0.92;
          b.rig.speed *= 0.92;
          this.events.hits += 1;
        }
      }
    }
  }

  private tryLaunch(rig: Rig, _lateral: number) {
    if (rig.launched || rig.damage >= 100) return;
    if (rig.progress < this.track.total - 14) return;
    const end = this.track.sample(this.track.total);
    const fx = -Math.sin(rig.yaw);
    const fz = -Math.cos(rig.yaw);
    const hitchX = rig.x - fx * HITCH;
    const hitchZ = rig.z - fz * HITCH;
    const bx = (hitchX + rig.axleX) / 2;
    const bz = (hitchZ + rig.axleZ) / 2;
    const vx = bx - end.x;
    const vz = bz - end.z;
    const along = vx * end.dx + vz * end.dz;
    const lat = vx * end.dz + vz * -end.dx;
    const ideal = Math.atan2(end.dx, end.dz);
    const aligned = Math.abs(wrapAngle(rig.trailerYaw - ideal));
    const st = statsFor(rig.engine, rig.turn, rig.boat);
    const centered = Math.abs(lat) < RAMP_HALF - st.halfWidth + 0.08;
    const committed = rig.speed < -2.1 && rig.speed > -13.5;
    if (along > 0.35 && centered && aligned < st.angleTol && committed) {
      rig.launched = true;
      rig.speed = 0;
      rig.vx = 0;
      rig.vz = 0;
      this.events.splash += 1;
      if (this.outro <= 0) this.outro = 2.15;
      return;
    }
    if (along > 0.55 && rig.failCd <= 0) {
      rig.failCd = 0.55;
      rig.damage = Math.min(100, rig.damage + 8 * st.fragility);
      rig.x -= end.dx * (along + 1.1);
      rig.z -= end.dz * (along + 1.1);
      rig.speed = 4.2;
      this.events.hits += 1;
    }
  }

  private rank() {
    const list = this.rigs.slice().sort((a, b) => {
      if (a.launched !== b.launched) return a.launched ? -1 : 1;
      if (Math.abs(a.progress - b.progress) > 0.35) return b.progress - a.progress;
      if (a.damage !== b.damage) return a.damage - b.damage;
      return a.name.localeCompare(b.name);
    });
    list.forEach((rig, i) => {
      rig.place = i + 1;
    });
  }
}
