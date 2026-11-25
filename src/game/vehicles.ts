import * as THREE from "three";
import { BOATS, type BoatId } from "@/game/content";
import { HITCH, TONGUE } from "@/game/sim";

export type Own = {
  geo: (g: THREE.BufferGeometry) => THREE.BufferGeometry;
  mat: <T extends THREE.Material>(m: T) => T;
  tex: (t: THREE.Texture) => THREE.Texture;
  box: THREE.BoxGeometry;
  wheel: THREE.CylinderGeometry;
  blob: THREE.CircleGeometry;
};

const NUMBERS: Record<string, string> = {
  You: "1",
  Crawdad: "2",
  "June Bug": "3",
  "Ramp Rat": "4",
};

export type RigMeshes = {
  truck: THREE.Group;
  pivot: THREE.Group;
  trailer: THREE.Group;
  boat: THREE.Group;
  boatBase: THREE.Vector3;
  wheels: THREE.Object3D[];
  paints: THREE.MeshStandardMaterial[];
};

function part(
  own: Own,
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(own.box, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function hullGeometry(length: number, beam: number, depth: number) {
  const rings = 8;
  const around = 5;
  const pos: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const z = -length * 0.46 + length * t;
    const bow = Math.pow(Math.max(0, (0.42 - t) / 0.42), 0.8);
    const stern = t > 0.9 ? 0.92 : 1;
    const half = (beam / 2) * (1 - bow * 0.86) * stern;
    const keel = depth * (0.55 + 0.45 * (1 - bow));
    pos.push(0, -keel * 0.15, z, -half * 0.62, -keel, z, -half, depth * 0.28, z, half, depth * 0.28, z, half * 0.62, -keel, z);
  }
  const idx: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < around; k++) {
      const a = i * around + k;
      const b = i * around + ((k + 1) % around);
      const c = (i + 1) * around + k;
      const d = (i + 1) * around + ((k + 1) % around);
      idx.push(a, b, c, b, d, c);
    }
  }
  const bowI = 0;
  const sternI = rings * around;
  for (let k = 1; k < around - 1; k++) {
    idx.push(bowI, bowI + k + 1, bowI + k);
    idx.push(sternI, sternI + k, sternI + k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function roofNumber(own: Own, name: string, paint: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  const tex = own.tex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  if (g) {
    const r = (paint >> 16) & 255;
    const gg = (paint >> 8) & 255;
    const b = paint & 255;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, 0, 128, 128);
    const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
    g.fillStyle = lum > 150 ? "#171c19" : "#f4efe4";
    g.font = "700 96px Impact, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(NUMBERS[name] ?? "1", 64, 70);
  }
  const plate = new THREE.Mesh(own.geo(new THREE.PlaneGeometry(1.2, 1.2)), own.mat(new THREE.MeshBasicMaterial({ map: tex })));
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, 1.56, -0.72);
  return plate;
}

function addWheels(own: Own, parent: THREE.Object3D, spots: ReadonlyArray<readonly [number, number]>, wheels: THREE.Object3D[]) {
  const tire = own.mat(new THREE.MeshStandardMaterial({ color: 0x1a1c1b, roughness: 0.85 }));
  const hub = own.mat(new THREE.MeshStandardMaterial({ color: 0xc5c8c2, roughness: 0.35, metalness: 0.6 }));
  for (const [x, z] of spots) {
    const w = new THREE.Group();
    const tireMesh = new THREE.Mesh(own.wheel, tire);
    const cap = new THREE.Mesh(own.box, hub);
    cap.scale.set(0.18, 0.28, 0.28);
    cap.position.x = Math.sign(x) * 0.12;
    w.add(tireMesh, cap);
    w.position.set(x, 0.4, z);
    parent.add(w);
    wheels.push(w);
  }
}

export function assembleRig(
  rig: { name: string; color: number; boat: BoatId; isPlayer: boolean },
  own: Own,
  shadowMat: THREE.Material,
): RigMeshes {
  const paints: THREE.MeshStandardMaterial[] = [];
  const paint = own.mat(new THREE.MeshStandardMaterial({ color: rig.color, roughness: 0.46, metalness: 0.14 }));
  paints.push(paint);
  const dark = own.mat(new THREE.MeshStandardMaterial({ color: 0x242825, roughness: 0.62, metalness: 0.18 }));
  const glass = own.mat(
    new THREE.MeshStandardMaterial({ color: 0xb7e0e4, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.85 }),
  );
  const lamp = own.mat(new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffe1a8, emissiveIntensity: 0.7, roughness: 0.3 }));
  const tail = own.mat(new THREE.MeshStandardMaterial({ color: 0xff4d3a, emissive: 0xaa2218, emissiveIntensity: 0.5, roughness: 0.4 }));

  const truck = new THREE.Group();
  const blob = new THREE.Mesh(own.blob, shadowMat);
  blob.scale.set(1.25, 1, 1.85);
  blob.position.y = 0.02;
  truck.add(blob);

  part(own, truck, paint, 2.05, 0.46, 4.15, 0, 0.62, -0.05);
  part(own, truck, dark, 1.82, 0.14, 1.7, 0, 0.9, 0.95);
  part(own, truck, paint, 0.1, 0.36, 1.62, -0.96, 1.08, 0.95);
  part(own, truck, paint, 0.1, 0.36, 1.62, 0.96, 1.08, 0.95);
  part(own, truck, dark, 1.84, 0.28, 0.08, 0, 0.95, 1.78);
  part(own, truck, paint, 1.92, 0.72, 1.45, 0, 1.16, -0.78);
  part(own, truck, paint, 1.88, 0.12, 0.95, 0, 0.86, -1.72);
  part(own, truck, dark, 2.12, 0.2, 0.16, 0, 0.46, -2.12);
  part(own, truck, dark, 2.05, 0.16, 0.12, 0, 0.5, 1.95);
  const glassPane = part(own, truck, glass, 1.7, 0.48, 0.06, 0, 1.22, -1.42);
  glassPane.rotation.x = -0.42;
  part(own, truck, lamp, 0.28, 0.16, 0.08, -0.62, 0.52, -2.18);
  part(own, truck, lamp, 0.28, 0.16, 0.08, 0.62, 0.52, -2.18);
  part(own, truck, tail, 0.32, 0.14, 0.06, -0.7, 0.7, 2.0);
  part(own, truck, tail, 0.32, 0.14, 0.06, 0.7, 0.7, 2.0);
  part(own, truck, dark, 0.16, 0.12, 0.22, -1.08, 1.15, -0.85);
  part(own, truck, dark, 0.16, 0.12, 0.22, 1.08, 1.15, -0.85);
  truck.add(roofNumber(own, rig.name, rig.color));
  const hitchCup = new THREE.Mesh(own.geo(new THREE.SphereGeometry(0.1, 8, 8)), dark);
  hitchCup.position.set(0, 0.46, HITCH);
  truck.add(hitchCup);

  const wheels: THREE.Object3D[] = [];
  addWheels(
    own,
    truck,
    [
      [-1.18, -1.45],
      [1.18, -1.45],
      [-1.18, 1.35],
      [1.18, 1.35],
    ],
    wheels,
  );

  const pivot = new THREE.Group();
  const trailer = new THREE.Group();
  pivot.add(trailer);
  const tblob = new THREE.Mesh(own.blob, shadowMat);
  tblob.scale.set(0.95, 1, 1.45);
  tblob.position.set(0, 0.02, TONGUE + 0.35);
  trailer.add(tblob);
  const frame = own.mat(new THREE.MeshStandardMaterial({ color: 0x3e4540, roughness: 0.55, metalness: 0.35 }));
  const ball = new THREE.Mesh(own.geo(new THREE.SphereGeometry(0.16, 10, 8)), own.mat(new THREE.MeshStandardMaterial({ color: 0xd7c4a1, metalness: 0.7, roughness: 0.28 })));
  ball.position.set(0, 0.46, 0);
  trailer.add(ball);
  part(own, trailer, frame, 0.12, 0.1, TONGUE - 0.2, 0, 0.4, (TONGUE - 0.2) / 2);
  part(own, trailer, frame, 0.1, 0.1, 2.35, -0.62, 0.48, TONGUE + 0.55);
  part(own, trailer, frame, 0.1, 0.1, 2.35, 0.62, 0.48, TONGUE + 0.55);
  part(own, trailer, frame, 1.34, 0.08, 0.1, 0, 0.5, TONGUE - 0.15);
  part(own, trailer, frame, 1.34, 0.08, 0.1, 0, 0.5, TONGUE + 0.75);
  part(own, trailer, frame, 1.34, 0.08, 0.1, 0, 0.5, TONGUE + 1.6);
  part(own, trailer, frame, 0.62, 0.12, 0.72, -0.88, 0.42, TONGUE);
  part(own, trailer, frame, 0.62, 0.12, 0.72, 0.88, 0.42, TONGUE);
  const bunk = own.mat(new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.8 }));
  part(own, trailer, bunk, 0.16, 0.08, 2.25, -0.42, 0.62, TONGUE + 0.75);
  part(own, trailer, bunk, 0.16, 0.08, 2.25, 0.42, 0.62, TONGUE + 0.75);
  addWheels(
    own,
    trailer,
    [
      [-0.84, TONGUE],
      [0.84, TONGUE],
    ],
    wheels,
  );

  const boat = makeBoat(rig.boat, own);
  boat.position.set(0, 0.12, TONGUE + 0.55);
  const boatBase = boat.position.clone();
  trailer.add(boat);

  return { truck, pivot, trailer, boat, boatBase, wheels, paints };
}

function makeBoat(id: BoatId, own: Own) {
  const def = BOATS[id];
  const group = new THREE.Group();
  const hullMat = own.mat(
    new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.42, metalness: 0.16, side: THREE.DoubleSide }),
  );
  const trim = own.mat(new THREE.MeshStandardMaterial({ color: 0x232826, roughness: 0.5, metalness: 0.2 }));
  const motor = own.mat(new THREE.MeshStandardMaterial({ color: 0x1a1c1b, roughness: 0.4, metalness: 0.4 }));

  if (id === "pontoon") {
    for (const x of [-0.95, 0.95]) {
      const tube = new THREE.Mesh(own.geo(new THREE.CapsuleGeometry(0.26, 2.25, 4, 8)), hullMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(x, 0.42, 0.15);
      group.add(tube);
    }
    part(own, group, trim, 1.55, 0.1, 2.15, 0, 0.72, 0.1);
    part(own, group, hullMat, 1.35, 0.08, 1.15, 0, 1.15, -0.1);
    return group;
  }

  const beam = id === "ski" ? 1.5 : id === "bass" ? 1.22 : 1.12;
  const length = id === "bass" ? 2.9 : 2.65;
  const depth = id === "jon" ? 0.28 : 0.42;
  const hull = new THREE.Mesh(own.geo(hullGeometry(length, beam, depth)), hullMat);
  hull.position.y = 0.55;
  group.add(hull);
  part(own, group, trim, beam * 0.72, 0.06, length * 0.62, 0, 0.7, 0.05);
  part(own, group, motor, 0.28, 0.32, 0.36, 0, 0.62, length * 0.42);
  if (id === "bass") part(own, group, trim, 0.55, 0.32, 0.42, 0, 0.95, 0.15);
  else if (id === "ski") {
    const winGlass = own.mat(
      new THREE.MeshStandardMaterial({ color: 0xd5eef2, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.8 }),
    );
    const win = part(own, group, winGlass, 0.9, 0.28, 0.06, 0, 0.95, -0.35);
    win.rotation.x = -0.5;
  } else {
    part(own, group, trim, 0.7, 0.08, 0.35, 0, 0.78, -0.15);
    part(own, group, trim, 0.7, 0.08, 0.35, 0, 0.78, 0.45);
  }
  return group;
}
