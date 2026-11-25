import type { BoatId, PaintId } from "@/game/content";

export type Season = {
  round: number;
  racesRun: number;
  points: Record<string, number>;
  engine: 0 | 1 | 2;
  turn: 0 | 1 | 2;
  boat: BoatId;
  ownedBoats: BoatId[];
  paint: PaintId;
  ownedPaints: PaintId[];
};

export type SaveData = {
  version: 1;
  championships: number;
  best: number;
  muted: boolean;
  season: Season | null;
};

const KEY = "backing-down-save-v1";

export const emptySave = (): SaveData => ({
  version: 1,
  championships: 0,
  best: 0,
  muted: false,
  season: null,
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== 1) return emptySave();
    return data;
  } catch {
    return emptySave();
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

export function freshSeason(): Season {
  return {
    round: 0,
    racesRun: 0,
    points: { You: 0, Crawdad: 0, "June Bug": 0, "Ramp Rat": 0 },
    engine: 0,
    turn: 0,
    boat: "jon",
    ownedBoats: ["jon"],
    paint: "bone",
    ownedPaints: ["bone"],
  };
}
