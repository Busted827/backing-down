import type { TrackDef } from "@/game/content";
import { clamp } from "@/game/math";

export const RAMP_LEN = 16;
export const TAPER = 12;
export const RAMP_HALF = 2.72;
export const LOT_DEPTH = 46;
export const LOT_HALF = 26;

export type Vec = { x: number; z: number };
export type Wall = { ax: number; az: number; bx: number; bz: number };
export type Circle = { x: number; z: number; r: number };

export type Lot = {
  start: number;
  ramp: number;
  dx: number;
  dz: number;
  mouthX: number;
  mouthZ: number;
  half: number;
  depth: number;
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookZ: number;
  poleX: number;
  poleZ: number;
  poleH: number;
};

export type BuiltTrack = {
  id: string;
  name: string;
  blurb: string;
  baseWidth: number;
  pts: Vec[];
  cum: number[];
  total: number;
  walls: Wall[];
  muds: Circle[];
  bales: Circle[];
  lot: Lot;
  halfAt: (dist: number) => number;
  sample: (dist: number) => { x: number; z: number; dx: number; dz: number };
};

function resample(points: Vec[], spacing: number): Vec[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const out: Vec[] = [{ ...points[0] }];
  let i = 0;
  let cx = points[0].x;
  let cz = points[0].z;
  let acc = 0;
  while (i < points.length - 1) {
    const nx = points[i + 1].x;
    const nz = points[i + 1].z;
    const dx = nx - cx;
    const dz = nz - cz;
    const seg = Math.hypot(dx, dz);
    if (seg < 1e-5) {
      i += 1;
      continue;
    }
    if (acc + seg >= spacing) {
      const t = (spacing - acc) / seg;
      cx += dx * t;
      cz += dz * t;
      out.push({ x: cx, z: cz });
      acc = 0;
    } else {
      acc += seg;
      cx = nx;
      cz = nz;
      i += 1;
    }
  }
  const last = points[points.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last.x - prev.x, last.z - prev.z) > 0.4) out.push({ ...last });
  else out[out.length - 1] = { ...last };
  return out;
}

function hash(s: string) {
  let h = 216613626;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h) % 2147483646 || 1;
}

function smooth(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function withLot(points: Vec[]) {
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const far = { x: b.x + ux * LOT_DEPTH, z: b.z + uz * LOT_DEPTH };
  const water = { x: far.x + ux * RAMP_LEN, z: far.z + uz * RAMP_LEN };
  return { points: [...points, far, water], ux, uz, mouth: { ...b } };
}

export function buildTrack(def: TrackDef): BuiltTrack {
  const laid = withLot(def.points);
  const pts = resample(laid.points, 4);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  }
  const total = cum[cum.length - 1];
  const mouth = total - LOT_DEPTH - RAMP_LEN;
  const ramp = total - RAMP_LEN;
  const road = def.width / 2;
  const halfAt = (dist: number) => {
    const d = clamp(dist, 0, total);
    const flare0 = mouth - 14;
    if (d <= flare0) return road;
    if (d < mouth) return road * (1 - smooth((d - flare0) / 14)) + LOT_HALF * smooth((d - flare0) / 14);
    const squeeze0 = ramp - TAPER;
    if (d < squeeze0) return LOT_HALF;
    if (d < ramp) return LOT_HALF * (1 - smooth((d - squeeze0) / TAPER)) + RAMP_HALF * smooth((d - squeeze0) / TAPER);
    return RAMP_HALF;
  };
  const sample = (dist: number) => {
    const d = clamp(dist, 0, total);
    let i = 0;
    while (i < pts.length - 2 && cum[i + 1] < d) i += 1;
    const span = cum[i + 1] - cum[i] || 1;
    const t = (d - cum[i]) / span;
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: a.x + dx * t, z: a.z + dz * t, dx: dx / len, dz: dz / len };
  };

  const walls: Wall[] = [];
  const push = (ax: number, az: number, bx: number, bz: number, extend = 0.85) => {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    walls.push({
      ax: ax - ux * extend,
      az: az - uz * extend,
      bx: bx + ux * extend,
      bz: bz + uz * extend,
    });
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const rx = dz / len;
    const rz = -dx / len;
    const ha = halfAt(cum[i]);
    const hb = halfAt(cum[i + 1]);
    push(a.x - rx * ha, a.z - rz * ha, b.x - rx * hb, b.z - rz * hb);
    push(a.x + rx * ha, a.z + rz * ha, b.x + rx * hb, b.z + rz * hb);
  }

  const start = sample(0);
  const srx = start.dz;
  const srz = -start.dx;
  const sh = halfAt(0) + 1.2;
  push(start.x - srx * sh, start.z - srz * sh, start.x + srx * sh, start.z + srz * sh, 0.3);

  const end = sample(total);
  const extra = 5;
  const ex = end.x + end.dx * extra;
  const ez = end.z + end.dz * extra;
  const erx = end.dz;
  const erz = -end.dx;
  push(end.x - erx * RAMP_HALF, end.z - erz * RAMP_HALF, ex - erx * RAMP_HALF, ez - erz * RAMP_HALF, 0.2);
  push(end.x + erx * RAMP_HALF, end.z + erz * RAMP_HALF, ex + erx * RAMP_HALF, ez + erz * RAMP_HALF, 0.2);

  const ux = laid.ux;
  const uz = laid.uz;
  const rx = uz;
  const rz = -ux;
  const farX = laid.mouth.x + ux * LOT_DEPTH;
  const farZ = laid.mouth.z + uz * LOT_DEPTH;
  const cx = laid.mouth.x + ux * (LOT_DEPTH * 0.5);
  const cz = laid.mouth.z + uz * (LOT_DEPTH * 0.5);
  const poleX = farX + rx * LOT_HALF;
  const poleZ = farZ + rz * LOT_HALF;
  let vx = poleX - cx;
  let vz = poleZ - cz;
  const vlen = Math.hypot(vx, vz) || 1;
  vx /= vlen;
  vz /= vlen;
  const poleH = 16;
  const lot: Lot = {
    start: mouth,
    ramp,
    dx: ux,
    dz: uz,
    mouthX: laid.mouth.x,
    mouthZ: laid.mouth.z,
    half: LOT_HALF,
    depth: LOT_DEPTH,
    camX: poleX + vx * (vlen * 0.5),
    camY: poleH + poleH * 0.5,
    camZ: poleZ + vz * (vlen * 0.5),
    lookX: laid.mouth.x + ux * (LOT_DEPTH * 0.62),
    lookZ: laid.mouth.z + uz * (LOT_DEPTH * 0.62),
    poleX,
    poleZ,
    poleH,
  };

  const muds: Circle[] = def.mud.map((f) => {
    const s = sample(mouth * f);
    return { x: s.x, z: s.z, r: 7.5 };
  });

  let seed = hash(def.id);
  const rand = () => {
    seed = (seed * 16807 + 3) % 2147483647;
    return seed / 2147483647;
  };
  const bales: Circle[] = [];
  for (let k = 0; k < def.bales; k++) {
    const dist = mouth * (0.22 + 0.62 * ((k + 0.5) / def.bales));
    const s = sample(dist);
    const side = rand() > 0.5 ? 1 : -1;
    const h = halfAt(dist);
    const inset = 1.7 + rand() * 0.5;
    const brx = s.dz;
    const brz = -s.dx;
    bales.push({
      x: s.x + brx * side * Math.max(1.2, h - inset),
      z: s.z + brz * side * Math.max(1.2, h - inset),
      r: 0.85,
    });
  }

  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    baseWidth: def.width,
    pts,
    cum,
    total,
    walls,
    muds,
    bales,
    lot,
    halfAt,
    sample,
  };
}

export function project(track: BuiltTrack, x: number, z: number, hint: number) {
  const search = (minD: number, maxD: number) => {
    let bestD2 = Infinity;
    let bestDist = hint;
    let bestLat = 0;
    let bestDx = 0;
    let bestDz = 1;
    for (let i = 0; i < track.pts.length - 1; i++) {
      if (track.cum[i + 1] < minD || track.cum[i] > maxD) continue;
      const a = track.pts[i];
      const b = track.pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1;
      let t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const ddx = x - px;
      const ddz = z - pz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < bestD2) {
        bestD2 = d2;
        const len = Math.sqrt(len2);
        bestDist = track.cum[i] + t * (track.cum[i + 1] - track.cum[i]);
        bestDx = abx / len;
        bestDz = abz / len;
        bestLat = ddx * bestDz + ddz * -bestDx;
      }
    }
    return { bestD2, bestDist, bestLat, bestDx, bestDz };
  };
  let r = search(Math.max(0, hint - 30), Math.min(track.total, hint + 24));
  if (r.bestD2 > 49) r = search(0, track.total);
  return { dist: r.bestDist, lateral: r.bestLat, dx: r.bestDx, dz: r.bestDz };
}

export function spawnPose(track: BuiltTrack, dist: number, lateral: number) {
  const s = track.sample(dist);
  const rx = s.dz;
  const rz = -s.dx;
  return {
    x: s.x + rx * lateral,
    z: s.z + rz * lateral,
    yaw: Math.atan2(s.dx, s.dz),
    dist,
  };
}
