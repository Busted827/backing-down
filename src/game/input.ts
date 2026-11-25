export type Actions = { throttle: number; steer: number };

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

function deadzone(x: number, y: number, dz = 0.18) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

export class Input {
  private keys = new Set<string>();
  private override: Set<string> | null = null;
  private steerOverride: number | null = null;
  back = false;
  pull = false;
  left = false;
  right = false;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;

  constructor() {
    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (GAME_KEYS.has(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.onBlur = () => this.keys.clear();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
  }

  /** QA probe: held codes replace the keyboard until the next call. */
  setKeys(codes: string[]) {
    this.override = new Set(codes);
  }

  setSteer(v: number) {
    this.steerOverride = v;
  }

  getActions(): Actions {
    const src = this.override ?? this.keys;
    const down = (c: string) => src.has(c);
    let throttle = 0;
    let steer = 0;
    if (down("KeyW") || down("ArrowUp")) throttle += 1;
    if (down("KeyS") || down("ArrowDown")) throttle -= 1;
    if (down("KeyA") || down("ArrowLeft")) steer += 1;
    if (down("KeyD") || down("ArrowRight")) steer -= 1;

    if (!this.override) {
      if (this.pull) throttle += 1;
      if (this.back) throttle -= 1;
      if (this.left) steer += 1;
      if (this.right) steer -= 1;
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) {
        if (!pad) continue;
        const stick = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        steer += -stick.x;
        throttle += -stick.y;
        if (pad.buttons[7]?.pressed || (pad.buttons[7]?.value ?? 0) > 0.4) throttle -= 1;
        if (pad.buttons[6]?.pressed || (pad.buttons[6]?.value ?? 0) > 0.4) throttle += 1;
        if (pad.buttons[14]?.pressed) steer += 1;
        if (pad.buttons[15]?.pressed) steer -= 1;
      }
    }

    if (this.steerOverride !== null) steer = this.steerOverride;
    return {
      throttle: Math.max(-1, Math.min(1, throttle)),
      steer: Math.max(-1, Math.min(1, steer)),
    };
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
  }
}
