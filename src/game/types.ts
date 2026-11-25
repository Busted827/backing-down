export type Phase = "title" | "race" | "results" | "garage" | "champion";

export type HudRig = {
  name: string;
  place: number;
  progress: number;
  damage: number;
  launched: boolean;
  isPlayer: boolean;
  color: string;
};

export type Standing = { name: string; points: number; isPlayer: boolean };

export type ResultRow = {
  name: string;
  place: number;
  launched: boolean;
  feet: number;
  damage: number;
  earned: number;
  isPlayer: boolean;
  color: string;
};

export type Snap = {
  phase: Phase;
  ready: boolean;
  paused: boolean;
  muted: boolean;
  hasSeason: boolean;
  championships: number;
  best: number;
  heatName: string;
  heatBlurb: string;
  heatIndex: number;
  heatCount: number;
  timeLeft: number;
  trailerAngle: number;
  jackknife: boolean;
  speed: number;
  playerPlace: number;
  damage: number;
  feetLeft: number;
  rigs: HudRig[];
  points: number;
  standings: Standing[];
  engine: number;
  turn: number;
  boat: string;
  paint: string;
  ownedBoats: string[];
  ownedPaints: string[];
  results: ResultRow[];
  headline: string;
  detail: string;
  seasonWon: boolean;
};

export const HEAT_COUNT = 4;
