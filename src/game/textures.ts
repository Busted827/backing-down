import * as THREE from "three";

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  return { c, g };
}

function texOf(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function makeGrass() {
  // Seeded scatter, not a stride pattern: a stride tiles into stripes at the dirt camera's height.
  const { c, g } = canvas(256);
  let seed = 9091;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = "#4a7247";
  g.fillRect(0, 0, 256, 256);
  const tufts = ["#41683f", "#52804d", "#5b8b54", "#3a5e3a", "#66945c"];
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.18 + rnd() * 0.22;
    g.fillStyle = tufts[Math.floor(rnd() * tufts.length)];
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 6 + rnd() * 22;
    for (const ox of [-256, 0, 256]) {
      for (const oy of [-256, 0, 256]) {
        g.beginPath();
        g.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = tufts[Math.floor(rnd() * tufts.length)];
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 2 + rnd() * 3);
  }
  return texOf(c);
}

export function makeDirt() {
  const { c, g } = canvas(256);
  g.fillStyle = "#c4a06a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2800; i++) {
    const x = (i * 47) % 256;
    const y = (i * 83) % 256;
    const n = i % 7;
    g.fillStyle = n === 0 ? "#8d6840" : n === 1 ? "#ddc08a" : n < 4 ? "#b08958" : "#6d5034";
    g.fillRect(x, y, 1 + (i % 3), 1 + ((i >> 2) % 3));
  }
  return texOf(c);
}

export function makeConcrete() {
  const { c, g } = canvas(256);
  g.fillStyle = "#c8c4ba";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = i % 2 ? "#b7b3a8" : "#d4d0c6";
    g.fillRect((i * 19) % 256, (i * 67) % 256, 2, 2);
  }
  g.strokeStyle = "#8e8a80";
  g.lineWidth = 3;
  for (const x of [28, 78, 128, 178, 228]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  return texOf(c);
}

export function makeAsphalt() {
  const { c, g } = canvas(256);
  g.fillStyle = "#3c4144";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const n = i % 4;
    g.fillStyle = n === 0 ? "#2e3336" : n === 1 ? "#4a5154" : "#353a3d";
    g.fillRect((i * 47) % 256, (i * 91) % 256, 2, 2);
  }
  return texOf(c);
}

export function makeWater() {
  const { c, g } = canvas(256);
  g.fillStyle = "#176e78";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(190, 236, 230, 0.35)";
  g.lineWidth = 2;
  for (let k = 0; k < 8; k++) {
    g.beginPath();
    const y = 16 + k * 30;
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + k) * 5);
    g.stroke();
  }
  return texOf(c);
}

export function makeSand() {
  const { c, g } = canvas(128);
  g.fillStyle = "#d2c09a";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = i % 2 ? "#c2ae84" : "#e4d4b0";
    g.fillRect((i * 17) % 128, (i * 43) % 128, 2, 2);
  }
  return texOf(c);
}
