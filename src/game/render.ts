import * as THREE from "three";
import { HITCH, type Rig, type Sim } from "@/game/sim";
import { LOT_DEPTH, LOT_HALF, RAMP_HALF, RAMP_LEN, type BuiltTrack } from "@/game/track";
import { makeAsphalt, makeConcrete, makeDirt, makeGrass, makeSand, makeWater } from "@/game/textures";
import { assembleRig, type Own } from "@/game/vehicles";

type RigView = {
  truck: THREE.Group;
  pivot: THREE.Group;
  boat: THREE.Object3D;
  boatBase: THREE.Vector3;
  wheels: THREE.Object3D[];
  paints: THREE.MeshStandardMaterial[];
  launchedAt: number;
};

type Mote = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number };

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private trackRoot = new THREE.Group();
  private rigRoot = new THREE.Group();
  private scratch: THREE.BufferGeometry[] = [];
  private scratchMat: THREE.Material[] = [];
  private scratchTex: THREE.Texture[] = [];
  private views = new Map<string, RigView>();
  private dust: Mote[] = [];
  private dustPos: Float32Array;
  private dustPoints: THREE.Points;
  private camPos = new THREE.Vector3(0, 24, 18);
  private look = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();
  private lib: { wheel: THREE.CylinderGeometry; box: THREE.BoxGeometry; blob: THREE.CircleGeometry };
  private dirtTex: THREE.Texture;
  private asphaltTex: THREE.Texture;
  private concreteTex: THREE.Texture;
  private waterTex: THREE.Texture;
  private grassTex: THREE.Texture;
  private sandTex: THREE.Texture;
  private shadowMat: THREE.MeshBasicMaterial;
  shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x9eb8c4, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.3, 420);
    this.scene.fog = new THREE.Fog(0x9eb8c4, 95, 220);
    this.scene.add(this.trackRoot, this.rigRoot);
    this.scene.add(new THREE.HemisphereLight(0xd5e6ef, 0x3d5a40, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
    sun.position.set(40, 60, 20);
    this.scene.add(sun);

    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const tune = (t: THREE.Texture) => {
      t.anisotropy = aniso;
      return t;
    };
    this.grassTex = tune(makeGrass());
    this.dirtTex = tune(makeDirt());
    this.asphaltTex = tune(makeAsphalt());
    this.concreteTex = tune(makeConcrete());
    this.waterTex = tune(makeWater());
    this.sandTex = tune(makeSand());
    this.grassTex.repeat.set(28, 28);
    this.dirtTex.repeat.set(1, 1);
    this.asphaltTex.repeat.set(8, 7);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(640, 640),
      new THREE.MeshStandardMaterial({ map: this.grassTex, roughness: 1, metalness: 0 }),
    );
    grass.rotation.x = -Math.PI / 2;
    this.scene.add(grass);

    const wheel = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12);
    wheel.rotateZ(Math.PI / 2);
    const blob = new THREE.CircleGeometry(1.35, 16);
    blob.rotateX(-Math.PI / 2);
    this.lib = { wheel, box: new THREE.BoxGeometry(1, 1, 1), blob };
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x101412, transparent: true, opacity: 0.28, depthWrite: false });

    this.dust = Array.from({ length: 90 }, () => ({ x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
    this.dustPos = new Float32Array(this.dust.length * 3);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(this.dustPos, 3));
    this.dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xc4a574, size: 0.42, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.scene.add(this.dustPoints);
    this.resize();
  }

  resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (w < 2 || h < 2) return;
    const pr = Math.min(window.devicePixelRatio || 1, 1.6);
    const bw = Math.floor(w * pr);
    const bh = Math.floor(h * pr);
    if (canvas.width === bw && canvas.height === bh) return;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  build(sim: Sim) {
    this.clearDynamic();
    this.views.clear();
    this.buildCourse(sim.track);
    for (const rig of sim.rigs) this.buildRig(rig);
    const focus = sim.player ?? sim.rigs[0];
    if (focus) this.placeCamera(focus, sim, true);
  }

  setPaint(id: string, color: number) {
    const view = this.views.get(id);
    if (!view) return;
    for (const m of view.paints) m.color.setHex(color);
  }

  draw(sim: Sim, dt: number) {
    const focus = sim.player && !sim.frozen ? sim.player : this.leader(sim);
    for (const rig of sim.rigs) {
      const view = this.views.get(rig.id);
      if (!view) continue;
      const gy = this.groundY(sim, rig.progress);
      const fx = -Math.sin(rig.yaw);
      const fz = -Math.cos(rig.yaw);
      view.truck.position.set(rig.x, gy, rig.z);
      view.truck.rotation.set(0, rig.yaw, 0);
      view.pivot.position.set(rig.x - fx * HITCH, gy, rig.z - fz * HITCH);
      view.pivot.rotation.set(0, rig.trailerYaw, 0);
      const spin = rig.speed * dt * 1.5;
      for (const w of view.wheels) w.rotateX(spin);
      if (rig.launched) {
        if (!view.launchedAt) view.launchedAt = performance.now();
        const t = Math.min(1, (performance.now() - view.launchedAt) / 900);
        view.boat.position.set(view.boatBase.x, view.boatBase.y - t * 1.2, view.boatBase.z + t * 2.6);
      }
      if (Math.abs(rig.speed) > 2.6 && !rig.launched) this.puff(rig.x, 0.3, rig.z, fx, fz);
    }
    this.stepDust(dt);
    this.waterTex.offset.x += dt * 0.04;

    if (focus) this.placeCamera(focus, sim, false, dt);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-3.4 * dt);
    }
    this.camera.lookAt(this.look);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.clearDynamic();
    this.lib.wheel.dispose();
    this.lib.box.dispose();
    this.lib.blob.dispose();
    this.shadowMat.dispose();
    this.dirtTex.dispose();
    this.asphaltTex.dispose();
    this.concreteTex.dispose();
    this.waterTex.dispose();
    this.grassTex.dispose();
    this.sandTex.dispose();
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
    this.renderer.dispose();
  }

  private placeCamera(focus: Rig, sim: Sim, snap: boolean, dt = 0.016) {
    const lot = sim.track.lot;
    const inLot = focus.progress >= lot.start - 1;
    if (inLot) {
      this.desiredPos.set(lot.camX, lot.camY, lot.camZ);
      this.desiredLook.set(lot.lookX, 0.2, lot.lookZ);
    } else {
      const f = forward(focus.yaw);
      const rx = f.z;
      const rz = -f.x;
      this.desiredPos.set(focus.x + rx * 12 + f.x * 2, 44, focus.z + rz * 12 + f.z * 2);
      this.desiredLook.set(focus.x - f.x * 16, 0.2, focus.z - f.z * 16);
    }
    const fov = inLot ? 58 : 46;
    if (snap) {
      this.camPos.copy(this.desiredPos);
      this.look.copy(this.desiredLook);
      this.camera.fov = fov;
    } else {
      const k = 1 - Math.exp((inLot ? -2.4 : -4) * dt);
      this.camPos.lerp(this.desiredPos, k);
      this.look.lerp(this.desiredLook, k);
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    }
    this.camera.updateProjectionMatrix();
  }

  private groundY(sim: Sim, progress: number) {
    const ramp = sim.track.lot.ramp;
    if (progress < ramp) return 0.12;
    const t = Math.min(1, (progress - ramp) / RAMP_LEN);
    return 0.12 + (0.05 - 0.12) * t;
  }

  private own: Own = {
    geo: (g) => {
      this.scratch.push(g);
      return g;
    },
    mat: (m) => {
      this.scratchMat.push(m);
      return m;
    },
    tex: (t) => {
      this.scratchTex.push(t);
      return t;
    },
    box: null as unknown as THREE.BoxGeometry,
    wheel: null as unknown as THREE.CylinderGeometry,
    blob: null as unknown as THREE.CircleGeometry,
  };

  private buildRig(rig: Rig) {
    this.own.box = this.lib.box;
    this.own.wheel = this.lib.wheel;
    this.own.blob = this.lib.blob;
    const built = assembleRig(rig, this.own, this.shadowMat);
    const label = makeLabel(rig.isPlayer ? "YOU" : rig.name.toUpperCase(), rig.isPlayer ? "#ef7b2a" : "#f4efe4");
    label.position.set(0, 2.5, -0.2);
    built.truck.add(label);
    this.rigRoot.add(built.truck, built.pivot);
    this.views.set(rig.id, {
      truck: built.truck,
      pivot: built.pivot,
      boat: built.boat,
      boatBase: built.boatBase,
      wheels: built.wheels,
      paints: built.paints,
      launchedAt: 0,
    });
  }

  private buildCourse(track: BuiltTrack) {
    const end = track.lot.start;
    const shoulder = this.own.mat(
      new THREE.MeshStandardMaterial({ map: this.dirtTex, color: 0x8a6844, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    );
    const dirt = this.own.mat(
      new THREE.MeshStandardMaterial({ map: this.dirtTex, color: 0xd7b07a, roughness: 0.94, metalness: 0, side: THREE.DoubleSide }),
    );
    const curb = this.own.mat(new THREE.MeshStandardMaterial({ color: 0xc5c1b6, roughness: 0.78, side: THREE.DoubleSide }));
    const paint = this.own.mat(new THREE.MeshBasicMaterial({ color: 0xf4efe4, side: THREE.DoubleSide }));
    this.addBand(track, 0, end, (d) => track.halfAt(d) - 0.2, (d) => track.halfAt(d) + 2.8, 0.06, shoulder);
    this.addStrip(track, 0, end, (d) => track.halfAt(d), 0.11, dirt);
    this.addBand(track, 2, end - 1, (d) => track.halfAt(d) + 0.05, (d) => track.halfAt(d) + 0.55, 0.2, curb);
    this.addBand(track, 6, end - 4, (d) => track.halfAt(d) - 0.95, (d) => track.halfAt(d) - 0.5, 0.16, paint);
    this.centerDashes(track, end, paint);
    this.startLine(track);
    this.coursePoles(track, end);
    this.grandstand(track);

    const chev = this.chevronGeo();
    const chevMat = this.own.mat(new THREE.MeshBasicMaterial({ color: 0xef7b2a, side: THREE.DoubleSide }));
    for (let d = 20; d < end - 10; d += 18) {
      const s = track.sample(d);
      const m = new THREE.Mesh(chev, chevMat);
      m.position.set(s.x, 0.18, s.z);
      m.rotation.y = Math.atan2(s.dx, s.dz);
      this.trackRoot.add(m);
    }

    const gate = this.banner(track.name.toUpperCase());
    const gs = track.sample(5);
    gate.position.set(gs.x, 3.3, gs.z);
    gate.rotation.y = Math.atan2(gs.dx, gs.dz);
    this.trackRoot.add(gate);

    this.buildLot(track);
    this.buildProps(track);
  }

  private centerDashes(track: BuiltTrack, end: number, paint: THREE.Material) {
    for (let d = 10; d < end - 8; d += 9) {
      const s = track.sample(d);
      const dash = new THREE.Mesh(this.lib.box, paint);
      dash.scale.set(0.34, 0.04, 3.1);
      dash.position.set(s.x, 0.17, s.z);
      dash.rotation.y = Math.atan2(s.dx, s.dz);
      this.trackRoot.add(dash);
    }
  }

  private startLine(track: BuiltTrack) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 32;
    const g = canvas.getContext("2d");
    const tex = this.own.tex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    if (g) {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? "#101412" : "#f4efe4";
        g.fillRect(i * 16, 0, 16, 32);
      }
    }
    const s = track.sample(9);
    const group = new THREE.Group();
    group.position.set(s.x, 0.17, s.z);
    group.rotation.y = Math.atan2(s.dx, s.dz);
    const plane = new THREE.Mesh(
      this.own.geo(new THREE.PlaneGeometry(1, 1)),
      this.own.mat(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.scale.set(track.halfAt(9) * 1.7, 1.5, 1);
    group.add(plane);
    this.trackRoot.add(group);
  }

  private coursePoles(track: BuiltTrack, end: number) {
    const poleMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0x2a302c, roughness: 0.5, metalness: 0.4 }));
    const lampMat = this.own.mat(
      new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffd27a, emissiveIntensity: 0.85 }),
    );
    const flagMat = this.own.mat(new THREE.MeshBasicMaterial({ color: 0xef7b2a, side: THREE.DoubleSide }));
    let n = 0;
    for (let d = 18; d < end - 12; d += 30) {
      const s = track.sample(d);
      const yaw = Math.atan2(s.dx, s.dz);
      for (const side of [-1, 1]) {
        const h = track.halfAt(d) + 2.4;
        const x = s.x + s.dz * h * side;
        const z = s.z - s.dx * h * side;
        const mast = new THREE.Mesh(this.lib.box, poleMat);
        mast.scale.set(0.22, 9.5, 0.22);
        mast.position.set(x, 4.75, z);
        const arm = new THREE.Mesh(this.lib.box, poleMat);
        arm.scale.set(1.4, 0.1, 0.1);
        arm.position.set(x - s.dz * side * 0.55, 9.4, z + s.dx * side * 0.55);
        const lamp = new THREE.Mesh(this.lib.box, lampMat);
        lamp.scale.set(0.62, 0.14, 0.32);
        lamp.position.set(x - s.dz * side * 1.05, 9.28, z + s.dx * side * 1.05);
        const flag = new THREE.Mesh(this.own.geo(new THREE.PlaneGeometry(1.1, 0.7)), flagMat);
        flag.position.set(x, 7.2, z);
        flag.rotation.y = yaw;
        if (n % 2) flag.scale.set(1, 1, 1);
        this.trackRoot.add(mast, arm, lamp, flag);
        n += 1;
      }
    }
  }

  private grandstand(track: BuiltTrack) {
    const s = track.sample(24);
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = Math.atan2(s.dx, s.dz);
    const half = track.halfAt(24);
    const stepMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.75 }));
    for (let i = 0; i < 4; i++) {
      const h = 0.38 + i * 0.32;
      const step = new THREE.Mesh(this.lib.box, stepMat);
      step.scale.set(1.15, h, 18);
      step.position.set(half + 3.4 + i * 1.2, h / 2, 0);
      g.add(step);
    }
    const colors = [0xef7b2a, 0xf4efe4, 0x1f8f86, 0xc44536, 0x3d4540, 0xd7c4a1];
    const people = new THREE.InstancedMesh(
      this.lib.box,
      this.own.mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })),
      36,
    );
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 9; k++) {
        const top = 0.38 + row * 0.32;
        dummy.position.set(half + 3.4 + row * 1.2, top + 0.38, -7.2 + k * 1.8);
        dummy.scale.set(0.38, 0.7, 0.38);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        people.setMatrixAt(n, dummy.matrix);
        people.setColorAt(n, new THREE.Color(colors[n % colors.length]));
        n += 1;
      }
    }
    if (people.instanceColor) people.instanceColor.needsUpdate = true;
    g.add(people);
    this.trackRoot.add(g);
  }

  private buildLot(track: BuiltTrack) {
    const lot = track.lot;
    const g = new THREE.Group();
    g.position.set(lot.mouthX, 0, lot.mouthZ);
    g.rotation.y = Math.atan2(lot.dx, lot.dz);

    const asphalt = new THREE.Mesh(
      this.own.geo(new THREE.PlaneGeometry(LOT_HALF * 2, LOT_DEPTH)),
      this.own.mat(new THREE.MeshStandardMaterial({ map: this.asphaltTex, color: 0xb7bcc0, roughness: 0.92 })),
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0.11, LOT_DEPTH / 2);
    g.add(asphalt);

    const line = this.own.mat(new THREE.MeshBasicMaterial({ color: 0xf4efe4 }));
    for (let x = -LOT_HALF + 5; x <= LOT_HALF - 5; x += 4.8) {
      if (Math.abs(x) < RAMP_HALF + 1.2) continue;
      const mark = new THREE.Mesh(this.lib.box, line);
      mark.scale.set(0.12, 0.02, 7.5);
      mark.position.set(x, 0.16, LOT_DEPTH * 0.48);
      g.add(mark);
    }

    const concrete = this.own.mat(
      new THREE.MeshStandardMaterial({ map: this.concreteTex, color: 0xd9d4ca, roughness: 0.86 }),
    );
    const ramp = new THREE.Mesh(this.lib.box, concrete);
    ramp.scale.set(RAMP_HALF * 2.05, 0.16, RAMP_LEN + 4);
    ramp.position.set(0, 0.1, LOT_DEPTH + RAMP_LEN * 0.35);
    ramp.rotation.x = 0.07;
    g.add(ramp);

    const curb = this.own.mat(new THREE.MeshStandardMaterial({ color: 0xc5c1b6, roughness: 0.8 }));
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(this.lib.box, curb);
      edge.scale.set(0.45, 0.38, LOT_DEPTH);
      edge.position.set(side * (LOT_HALF + 0.15), 0.24, LOT_DEPTH / 2);
      g.add(edge);
      const span = LOT_HALF - RAMP_HALF - 0.8;
      const waterCurb = new THREE.Mesh(this.lib.box, curb);
      waterCurb.scale.set(span, 0.38, 0.5);
      waterCurb.position.set(side * (RAMP_HALF + 0.8 + span / 2), 0.24, LOT_DEPTH);
      g.add(waterCurb);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(this.lib.box, this.own.mat(new THREE.MeshStandardMaterial({ color: 0xef7b2a, roughness: 0.45 })));
      rail.scale.set(0.22, 0.55, RAMP_LEN + 2);
      rail.position.set(side * (RAMP_HALF + 0.15), 0.4, LOT_DEPTH + RAMP_LEN * 0.35);
      g.add(rail);
    }

    const sand = new THREE.Mesh(
      this.own.geo(new THREE.PlaneGeometry(96, 78)),
      this.own.mat(new THREE.MeshStandardMaterial({ map: this.sandTex, roughness: 1 })),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, LOT_DEPTH + 28);
    const water = new THREE.Mesh(
      this.own.geo(new THREE.PlaneGeometry(84, 64)),
      this.own.mat(
        new THREE.MeshStandardMaterial({
          map: this.waterTex,
          color: 0x8fd0d4,
          roughness: 0.18,
          metalness: 0.08,
          transparent: true,
          opacity: 0.94,
        }),
      ),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.055, LOT_DEPTH + 30);
    g.add(sand, water);

    const poleMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0x2a302c, roughness: 0.5, metalness: 0.4 }));
    const lampMat = this.own.mat(
      new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffd27a, emissiveIntensity: 0.85 }),
    );
    const corners: Array<[number, number, number]> = [
      [-LOT_HALF + 1.4, 2, 11],
      [LOT_HALF - 1.4, 2, 11],
      [-LOT_HALF + 1.4, LOT_DEPTH - 1.2, 11],
      [LOT_HALF - 1.2, LOT_DEPTH - 1.2, lot.poleH],
    ];
    for (const [x, z, h] of corners) {
      const mast = new THREE.Mesh(this.lib.box, poleMat);
      mast.scale.set(0.28, h, 0.28);
      mast.position.set(x, h / 2, z);
      const arm = new THREE.Mesh(this.lib.box, poleMat);
      arm.scale.set(1.6, 0.12, 0.12);
      arm.position.set(x - Math.sign(x) * 0.6, h, z);
      const lamp = new THREE.Mesh(this.lib.box, lampMat);
      lamp.scale.set(0.7, 0.16, 0.35);
      lamp.position.set(x - Math.sign(x) * 1.2, h - 0.05, z);
      g.add(mast, arm, lamp);
    }

    const sign = this.banner("ONE RAMP");
    sign.position.set(0, 2.4, LOT_DEPTH - 1.2);
    g.add(sign);

    const lotMarks = this.chevronGeo();
    const lotMarkMat = this.own.mat(new THREE.MeshBasicMaterial({ color: 0xef7b2a, side: THREE.DoubleSide }));
    for (let i = 0; i < 3; i++) {
      const mark = new THREE.Mesh(lotMarks, lotMarkMat);
      mark.position.set(0, 0.18, LOT_DEPTH - 8 - i * 6);
      g.add(mark);
    }

    this.trackRoot.add(g);
  }

  private chevronGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.15);
    s.lineTo(1.35, 1.85);
    s.lineTo(0.82, 1.85);
    s.lineTo(0, 0.72);
    s.lineTo(-0.82, 1.85);
    s.lineTo(-1.35, 1.85);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    geo.rotateX(-Math.PI / 2);
    this.scratch.push(geo);
    return geo;
  }

  private buildProps(track: BuiltTrack) {
    const baleMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0xc6a15a, roughness: 0.85 }));
    const bandMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0x8a6232, roughness: 0.7 }));
    for (const b of track.bales) {
      const bale = new THREE.Mesh(this.own.geo(new THREE.CylinderGeometry(b.r, b.r, 0.9, 10)), baleMat);
      bale.position.set(b.x, 0.5, b.z);
      const band = new THREE.Mesh(this.own.geo(new THREE.CylinderGeometry(b.r + 0.03, b.r + 0.03, 0.12, 10)), bandMat);
      band.position.set(b.x, 0.5, b.z);
      this.trackRoot.add(bale, band);
    }

    let trees = 0;
    for (let d = 10; d < track.lot.start - 16; d += 16) trees += 2;
    if (trees < 1) return;
    const trunkMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.9 }));
    const crownMat = this.own.mat(new THREE.MeshStandardMaterial({ color: 0x2f6a46, roughness: 0.85 }));
    const trunks = new THREE.InstancedMesh(this.own.geo(new THREE.CylinderGeometry(0.2, 0.28, 1.2, 6)), trunkMat, trees);
    const crowns = new THREE.InstancedMesh(this.own.geo(new THREE.SphereGeometry(1.15, 7, 6)), crownMat, trees);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let d = 10; d < track.lot.start - 16; d += 16) {
      const s = track.sample(d);
      for (const side of [-1, 1]) {
        const h = track.halfAt(d) + 5 + (n % 3);
        dummy.position.set(s.x + s.dz * h * side, 0.6, s.z - s.dx * h * side);
        dummy.scale.set(1, 0.85 + (n % 4) * 0.1, 1);
        dummy.rotation.set(0, n, 0);
        dummy.updateMatrix();
        trunks.setMatrixAt(n, dummy.matrix);
        dummy.position.y = 2.15;
        dummy.scale.set(1.1, 0.9, 1.1);
        dummy.updateMatrix();
        crowns.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
    }
    this.trackRoot.add(trunks, crowns);
  }

  private addBand(
    track: BuiltTrack,
    from: number,
    to: number,
    innerAt: (d: number) => number,
    outerAt: (d: number) => number,
    y: number,
    material: THREE.Material,
  ) {
    if (to - from < 1) return;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const dists: number[] = [];
    for (let d = from; d < to - 0.25; d += 3) dists.push(d);
    dists.push(to);
    for (let i = 0; i < dists.length - 1; i++) {
      const da = dists[i];
      const db = dists[i + 1];
      const sa = track.sample(da);
      const sb = track.sample(db);
      for (const side of [-1, 1]) {
        const base = pos.length / 3;
        const push = (s: { x: number; z: number; dx: number; dz: number }, radius: number, dist: number, u: number) => {
          pos.push(s.x + s.dz * radius, y, s.z - s.dx * radius);
          uv.push(u, dist / 4);
        };
        push(sa, innerAt(da) * side, da, 0);
        push(sa, outerAt(da) * side, da, 1);
        push(sb, innerAt(db) * side, db, 0);
        push(sb, outerAt(db) * side, db, 1);
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.scratch.push(geo);
    this.trackRoot.add(new THREE.Mesh(geo, material));
  }

  private addStrip(
    track: BuiltTrack,
    from: number,
    to: number,
    halfOf: (d: number) => number,
    y: number,
    material: THREE.Material,
  ) {
    if (to - from < 1) return;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const dists: number[] = [];
    for (let d = from; d < to - 0.25; d += 3) dists.push(d);
    dists.push(to);
    for (let i = 0; i < dists.length - 1; i++) {
      const da = dists[i];
      const db = dists[i + 1];
      const sa = track.sample(da);
      const sb = track.sample(db);
      const ha = halfOf(da);
      const hb = halfOf(db);
      const base = pos.length / 3;
      const push = (s: { x: number; z: number; dx: number; dz: number }, h: number, side: number, dist: number) => {
        pos.push(s.x + s.dz * h * side, y, s.z - s.dx * h * side);
        uv.push(side < 0 ? 0 : (h * 2) / 4, dist / 4);
      };
      push(sa, ha, -1, da);
      push(sa, ha, 1, da);
      push(sb, hb, -1, db);
      push(sb, hb, 1, db);
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.scratch.push(geo);
    this.trackRoot.add(new THREE.Mesh(geo, material));
  }

  private banner(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const g = canvas.getContext("2d");
    const tex = this.own.tex(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    if (g) {
      g.fillStyle = "#101412";
      g.fillRect(0, 0, 512, 128);
      g.fillStyle = "#ef7b2a";
      g.fillRect(0, 0, 512, 12);
      g.fillRect(0, 116, 512, 12);
      g.fillStyle = "#f4efe4";
      g.font = "700 64px Impact, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 256, 68);
    }
    const board = new THREE.Mesh(
      this.own.geo(new THREE.PlaneGeometry(8, 2)),
      this.own.mat(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })),
    );
    const group = new THREE.Group();
    group.add(board);
    return group;
  }

  private clearDynamic() {
    for (const g of this.scratch) g.dispose();
    for (const m of this.scratchMat) m.dispose();
    for (const t of this.scratchTex) t.dispose();
    this.scratch = [];
    this.scratchMat = [];
    this.scratchTex = [];
    this.trackRoot.clear();
    this.rigRoot.clear();
  }

  private leader(sim: Sim) {
    let best: Rig | null = null;
    for (const rig of sim.rigs) {
      if (!best || rig.progress > best.progress) best = rig;
    }
    return best;
  }

  private puff(x: number, y: number, z: number, fx: number, fz: number) {
    const slot = this.dust.find((d) => d.life <= 0);
    if (!slot) return;
    slot.x = x - fx * 1.2 + (Math.random() - 0.5);
    slot.y = y;
    slot.z = z - fz * 1.2 + (Math.random() - 0.5);
    slot.vx = -fx * 0.3;
    slot.vy = 1.2;
    slot.vz = -fz * 0.3;
    slot.life = 0.45;
  }

  private stepDust(dt: number) {
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      if (d.life <= 0) {
        this.dustPos[i * 3 + 1] = -20;
        continue;
      }
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      this.dustPos[i * 3] = d.x;
      this.dustPos[i * 3 + 1] = d.y;
      this.dustPos[i * 3 + 2] = d.z;
    }
    (this.dustPoints.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }
}

function forward(yaw: number) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

function makeLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (g) {
    g.font = "700 40px Impact, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 8;
    g.strokeStyle = "#101412";
    g.strokeText(text, 128, 34);
    g.fillStyle = color;
    g.fillText(text, 128, 34);
  }
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 0.7, 1);
  return sprite;
}
