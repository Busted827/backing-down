export type BoatId = "jon" | "bass" | "ski" | "pontoon";
export type PaintId = "bone" | "ember" | "lake" | "night";

export type BoatDef = {
  id: BoatId;
  name: string;
  price: number;
  blurb: string;
  fragility: number;
  mass: number;
  halfWidth: number;
  angleTol: number;
  color: number;
};

export const BOATS: Record<BoatId, BoatDef> = {
  jon: {
    id: "jon",
    name: "Jon",
    price: 0,
    blurb: "Narrow aluminum. The honest way down the rails.",
    fragility: 1,
    mass: 1,
    halfWidth: 0.82,
    angleTol: 0.48,
    color: 0xc5c9bc,
  },
  bass: {
    id: "bass",
    name: "Bass",
    price: 110,
    blurb: "Light and quick. A hard bump folds the hull.",
    fragility: 1.42,
    mass: 0.84,
    halfWidth: 0.76,
    angleTol: 0.42,
    color: 0x1e6b45,
  },
  ski: {
    id: "ski",
    name: "Ski",
    price: 140,
    blurb: "Thick glass. Shrugs off hay. Wider in the chute.",
    fragility: 0.7,
    mass: 1.12,
    halfWidth: 1.02,
    angleTol: 0.36,
    color: 0xf3efe6,
  },
  pontoon: {
    id: "pontoon",
    name: "Pontoon",
    price: 100,
    blurb: "Barely dents. The ramp has to be dead straight.",
    fragility: 0.52,
    mass: 1.26,
    halfWidth: 1.32,
    angleTol: 0.28,
    color: 0xd8d3c8,
  },
};

export const PAINTS: Record<PaintId, { id: PaintId; name: string; price: number; color: number }> = {
  bone: { id: "bone", name: "Bone", price: 0, color: 0xe4d2b0 },
  ember: { id: "ember", name: "Ember", price: 40, color: 0xef7b2a },
  lake: { id: "lake", name: "Lake", price: 40, color: 0x1f8f86 },
  night: { id: "night", name: "Night", price: 40, color: 0x3d4540 },
};

export const ENGINE_COST = [60, 150];
export const TURN_COST = [60, 150];

export const AI = [
  { name: "Crawdad", color: 0xc44536, skill: 0.58, nerve: 0.42, boat: "bass" as BoatId },
  { name: "June Bug", color: 0xd7c4a1, skill: 0.46, nerve: 0.28, boat: "ski" as BoatId },
  { name: "Ramp Rat", color: 0x2f9e8f, skill: 0.82, nerve: 0.74, boat: "jon" as BoatId },
];

export type TrackDef = {
  id: string;
  name: string;
  blurb: string;
  width: number;
  points: { x: number; z: number }[];
  mud: number[];
  bales: number;
};

export const TRACKS: TrackDef[] = [
  {
    id: "parish",
    name: "Parish Fair",
    blurb: "Wide dirt and a gentle S. Learn the trailer before the lake does.",
    width: 16,
    points: [
      { x: 0, z: 88 },
      { x: 0, z: 52 },
      { x: 22, z: 30 },
      { x: 30, z: 2 },
      { x: 10, z: -20 },
      { x: -16, z: -36 },
      { x: -18, z: -66 },
      { x: 0, z: -92 },
    ],
    mud: [],
    bales: 2,
  },
  {
    id: "catfish",
    name: "Catfish Cut",
    blurb: "Mud in the bends. Straighten early or you'll arrive sideways.",
    width: 13.5,
    points: [
      { x: 0, z: 78 },
      { x: -22, z: 56 },
      { x: -36, z: 28 },
      { x: -14, z: 6 },
      { x: 12, z: -8 },
      { x: 26, z: -34 },
      { x: 8, z: -58 },
      { x: 8, z: -88 },
    ],
    mud: [0.38, 0.55],
    bales: 3,
  },
  {
    id: "levee",
    name: "Levee Switch",
    blurb: "The hairpins fold a trailer. Pull forward. Then commit.",
    width: 12.8,
    points: [
      { x: -8, z: 86 },
      { x: 22, z: 72 },
      { x: 38, z: 48 },
      { x: 16, z: 30 },
      { x: -12, z: 16 },
      { x: -32, z: -6 },
      { x: -8, z: -26 },
      { x: 18, z: -46 },
      { x: 18, z: -80 },
    ],
    mud: [0.48],
    bales: 4,
  },
  {
    id: "only",
    name: "The Only Ramp",
    blurb: "A long run, then the chute squeezes. Somebody will try to take it from you.",
    width: 15,
    points: [
      { x: 0, z: 108 },
      { x: 0, z: 70 },
      { x: 4, z: 36 },
      { x: 22, z: 14 },
      { x: 32, z: -12 },
      { x: 12, z: -32 },
      { x: 0, z: -52 },
      { x: 0, z: -86 },
    ],
    mud: [0.62],
    bales: 3,
  },
];

export function payout(place: number, damage: number, launched: boolean) {
  const base = [100, 62, 36, 18][place - 1] ?? 0;
  const pen = Math.round(base * Math.min(0.4, damage / 200));
  const bonus = launched && place === 1 ? 25 : 0;
  return Math.max(0, base - pen + bonus);
}

export function placeWord(place: number) {
  return ["", "1st", "2nd", "3rd", "4th"][place] ?? `${place}th`;
}
