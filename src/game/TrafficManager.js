import * as THREE from 'three';
import { LANE_X, RECYCLE_Z, TRAFFIC_POOL, stepTrafficLateral } from '../utils/Constants.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const BODY_COLORS = [0xe8e8ec, 0x1d1f27, 0x2a6df4, 0x2fa84f, 0x8a8f99, 0xff8a00, 0x7a3fd1, 0xc7ccd6];
const TRAILER_COLORS = [0xe9ecef, 0xb0b7c3, 0x3a6ea5, 0xd9822b];

// parts: [kind, width, height, length, y, z]   (car faces -z)
const TYPES = {
  sedan: { hw: 0.9, hl: 2.1, axles: [-1.3, 1.3], axleW: 1.95, parts: [
    ['body', 1.8, 0.62, 4.2, 0.62, 0], ['glass', 1.5, 0.5, 2.1, 1.18, 0.3], ['body', 1.46, 0.06, 1.9, 1.46, 0.3]] },
  taxi: { hw: 0.9, hl: 2.1, axles: [-1.3, 1.3], axleW: 1.95, parts: [
    ['body', 1.8, 0.62, 4.2, 0.62, 0], ['glass', 1.5, 0.5, 2.1, 1.18, 0.3], ['body', 1.46, 0.06, 1.9, 1.46, 0.3]] },
  hatch: { hw: 0.85, hl: 1.85, axles: [-1.15, 1.15], axleW: 1.85, parts: [
    ['body', 1.7, 0.6, 3.7, 0.6, 0], ['glass', 1.45, 0.55, 2.2, 1.15, 0.35], ['body', 1.42, 0.06, 2.0, 1.45, 0.35]] },
  suv: { hw: 1.0, hl: 2.25, axles: [-1.4, 1.4], axleW: 2.15, parts: [
    ['body', 2.0, 0.85, 4.5, 0.78, 0], ['glass', 1.8, 0.6, 2.7, 1.5, 0.3], ['body', 1.76, 0.06, 2.5, 1.82, 0.3]] },
  van: { hw: 1.0, hl: 2.45, axles: [-1.6, 1.6], axleW: 2.15, parts: [
    ['body', 2.0, 1.5, 4.9, 1.1, 0], ['glass', 2.02, 0.55, 1.1, 1.55, -1.75]] },
  truck: { hw: 1.18, hl: 4.15, axles: [-3.3, 1.9, 3.2], axleW: 2.4, parts: [
    ['body', 2.2, 1.5, 1.9, 1.1, -3.2], ['glass', 2.22, 0.55, 0.8, 1.65, -3.55], ['trailer', 2.35, 2.5, 6.3, 1.9, 0.95]] },
};
const POOL_TYPES = ['sedan', 'sedan', 'sedan', 'sedan', 'suv', 'suv', 'suv', 'hatch', 'hatch', 'van', 'van', 'truck', 'truck', 'taxi'];
const MAX_LANE = LANE_X.length - 1;
const LANE_FACTORS = [0.76, 0.62, 0.50, 0.40]; // left lane is fastest
const TYPE_SPEED = {
  truck: [0.30, 0.44],
  van: [0.40, 0.56],
  suv: [0.48, 0.66],
  hatch: [0.55, 0.74],
  sedan: [0.58, 0.82],
  taxi: [0.62, 0.86],
};

export class TrafficManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.cars = [];
    this.geos = new Map();
    this.disposables = [];
    this.enabled = false;
    this.timer = 0;
    this.interval = 1.4;
    this.limit = 6;
    this.laneSpeed = LANE_FACTORS.map((f) => f * 34);

    const std = (o) => { const m = new THREE.MeshStandardMaterial(o); this.disposables.push(m); return m; };
    this.bodyMats = BODY_COLORS.map((c) => std({ color: c, metalness: 0.5, roughness: 0.35 }));
    this.trailerMats = TRAILER_COLORS.map((c) => std({ color: c, metalness: 0.2, roughness: 0.6 }));
    this.taxiMat = std({ color: 0xf2c200, metalness: 0.5, roughness: 0.35 });
    this.glassMat = std({ color: 0x0b1220, metalness: 0.9, roughness: 0.1 });
    this.tireMat = std({ color: 0x0d0d0f, roughness: 0.9 });
    this.headMat = std({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1.5 });
    this.tailMat = std({ color: 0x330000, emissive: 0xff1122, emissiveIntensity: 2.2 });
    this.indMat = new THREE.MeshBasicMaterial({ color: 0xffc400, fog: false, toneMapped: false });
    this.disposables.push(this.indMat);

    for (let i = 0; i < TRAFFIC_POOL; i++) this.cars.push(this._build(POOL_TYPES[i % POOL_TYPES.length]));
    scene.add(this.group);
  }

  _geo(key, make) {
    let g = this.geos.get(key);
    if (!g) { g = make(); this.geos.set(key, g); }
    return g;
  }

  _build(type) {
    const spec = TYPES[type];
    const root = new THREE.Group();
    const tinted = [];
    for (const [kind, w, h, l, y, z] of spec.parts) {
      const geo = this._geo(`b${w}_${h}_${l}`, () => new THREE.BoxGeometry(w, h, l));
      const mat = kind === 'glass' ? this.glassMat : kind === 'trailer' ? this.trailerMats[0] : this.bodyMats[0];
      const m = new THREE.Mesh(geo, mat); m.position.set(0, y, z); root.add(m);
      if (kind !== 'glass') tinted.push({ mesh: m, kind });
    }
    const axGeo = this._geo(`a${spec.axleW}`, () => new THREE.CylinderGeometry(0.4, 0.4, spec.axleW, 12).rotateZ(Math.PI / 2));
    for (const z of spec.axles) { const a = new THREE.Mesh(axGeo, this.tireMat); a.position.set(0, 0.4, z); root.add(a); }
    const hGeo = this._geo(`h${spec.hw}`, () => new THREE.BoxGeometry(spec.hw * 1.6, 0.12, 0.06));
    const tGeo = this._geo(`t${spec.hw}`, () => new THREE.BoxGeometry(spec.hw * 1.7, 0.14, 0.06));
    const head = new THREE.Mesh(hGeo, this.headMat); head.position.set(0, 0.72, -spec.hl - 0.02);
    const tail = new THREE.Mesh(tGeo, this.tailMat); tail.position.set(0, 0.78, spec.hl + 0.02);
    const iGeo = this._geo('ind', () => new THREE.BoxGeometry(0.46, 0.28, 0.2));
    const rear = spec.hl + 0.22, side = spec.hw * 0.98;
    const leftInd = new THREE.Mesh(iGeo, this.indMat);
    const rightInd = new THREE.Mesh(iGeo, this.indMat);
    leftInd.position.set(-side, 0.9, rear);
    rightInd.position.set(side, 0.9, rear);
    leftInd.visible = rightInd.visible = false;
    root.add(head, tail, leftInd, rightInd);
    root.visible = false;
    this.group.add(root);
    return {
      root, type, tinted, leftInd, rightInd, hw: spec.hw * 0.92, hl: spec.hl * 0.95,
      active: false, crashing: false, lane: 1, x: 0, z: 0, v: 0, cvx: 0, spin: 0, ct: 0,
      blink: 0, blinkT: 0, pendingLane: 1, targetLane: 1, moving: false,
      yielding: false, yieldT: 0, nudgeT: 0, lvx: 0, decideIn: 0, phase: 0, yaw: 0,
    };
  }

  setLevel(level, cruise) {
    this.cruise = cruise;
    this.laneSpeed = LANE_FACTORS.map((f) => f * cruise);
    this.limit = Math.min(this.cars.length, 6 + level);
    this.interval = Math.max(0.45, 1.3 - 0.1 * (level - 1));
  }

  /** Clear everything and pre-populate the road ahead. */
  reset(level, cruise) {
    this.clear();
    this.setLevel(level, cruise);
    this.enabled = true;
    this.timer = 0.6;
    for (let z = -80; z > -250; z -= rand(22, 34)) this._trySpawn(z);
  }

  clear() {
    this.enabled = false;
    for (const c of this.cars) this._deactivate(c);
  }

  stopSpawning() { this.enabled = false; }

  _deactivate(c) {
    c.active = false; c.crashing = false; c.root.visible = false;
    c.blink = 0; c.blinkT = 0; c.moving = false; c.yielding = false; c.yieldT = 0; c.nudgeT = 0; c.lvx = 0; c.yaw = 0;
    c.leftInd.visible = false; c.rightInd.visible = false;
    c.root.rotation.set(0, 0, 0);
  }

  /** True when `lane` is taken near this car (including a car already signalling into it). */
  _laneBlocked(car, lane, gap) {
    if (lane < 0 || lane > MAX_LANE) return true;
    for (const o of this.cars) {
      if (o === car || !o.active || o.crashing) continue;
      const there = o.lane === lane || (o.moving && o.targetLane === lane) || (o.blink !== 0 && o.pendingLane === lane);
      if (!there) continue;
      if (Math.abs(o.z - car.z) < car.hl + o.hl + gap) return true;
    }
    return false;
  }

  _openDirs(car, gap) {
    const dirs = [];
    if (!this._laneBlocked(car, car.lane - 1, gap)) dirs.push(-1);
    if (!this._laneBlocked(car, car.lane + 1, gap)) dirs.push(1);
    return dirs;
  }

  /** Side with the most room. 0 if both neighbours are too tight to pull over. */
  _bestYieldDir(car) {
    let best = 0, bestGap = 4;
    for (const dir of [-1, 1]) {
      const lane = car.lane + dir;
      if (lane < 0 || lane > MAX_LANE) continue;
      let gap = 90;
      for (const o of this.cars) {
        if (o === car || !o.active || o.crashing) continue;
        const there = o.lane === lane || (o.moving && o.targetLane === lane) || (o.blink !== 0 && o.pendingLane === lane);
        if (!there) continue;
        gap = Math.min(gap, Math.abs(o.z - car.z) - car.hl - o.hl);
      }
      if (gap > bestGap) { bestGap = gap; best = dir; }
    }
    return best;
  }

  _signal(c, dir, delay) {
    c.blink = dir;
    c.pendingLane = c.lane + dir;
    c.blinkT = delay;
  }

  _commitLane(c) {
    const lane = c.pendingLane;
    const gap = c.yielding ? 5 : 7;
    if (lane !== c.lane && !this._laneBlocked(c, lane, gap)) {
      c.moving = true;
      c.targetLane = lane;
      return;
    }
    if (!c.yielding) {
      const dir = c.lane - c.pendingLane;
      const alt = c.lane + dir;
      if (dir && alt >= 0 && alt <= MAX_LANE && !this._laneBlocked(c, alt, gap)) {
        this._signal(c, dir, 0.45);
        return;
      }
    }
    if (c.yielding && c.yieldT > 0) {
      const dir = this._bestYieldDir(c);
      if (dir) this._signal(c, dir, 0.4);
      else c.blinkT = 0.3;
      return;
    }
    c.blink = 0;
    c.pendingLane = c.lane;
    c.yielding = false;
  }

  /** A faster car is closing from behind in the same lane. */
  _pressured(c) {
    for (const o of this.cars) {
      if (o === c || !o.active || o.crashing) continue;
      if (o.lane !== c.lane && !(o.moving && o.targetLane === c.lane)) continue;
      const behind = o.z - c.z;
      if (behind > 1.2 && behind < c.hl + o.hl + 18 && o.v > c.v + 2) return true;
    }
    return false;
  }

  _giveWay(c) {
    const dir = this._bestYieldDir(c) || (c.lane === 0 ? 1 : c.lane === MAX_LANE ? -1 : (Math.random() < 0.5 ? -1 : 1));
    c.yielding = true;
    c.yieldT = 2.8;
    this._signal(c, dir, rand(0.45, 0.8));
  }

  /** Horn: only the nearest car ahead in the player's path indicates, then moves aside. */
  yieldAhead(px, pz = 0) {
    let best = null;
    for (const c of this.cars) {
      if (!c.active || c.crashing) continue;
      const dz = c.z - pz;
      if (dz > -4 || dz < -48) continue;
      if (Math.abs(c.x - px) > 2.15) continue;
      if (!best || c.z > best.z) best = c;
    }
    if (!best || best.moving) return;
    if (best.yielding && best.blinkT > 0) return;
    best.yielding = true;
    best.yieldT = 3.4;
    const dir = this._bestYieldDir(best) || (best.lane === 0 ? 1 : best.lane === MAX_LANE ? -1 : (Math.random() < 0.5 ? -1 : 1));
    this._signal(best, dir, rand(0.65, 0.95));
  }

  /**
   * Bump from a slower player: indicator stays on and the car accelerates into the next lane.
   * Returns true only the first time, so the horn plays once.
   */
  nudgeAside(car) {
    if (!car || !car.active || car.crashing) return false;
    if (car.moving || car.yielding) return false;
    car.yielding = true;
    car.yieldT = 2.8;
    const dir = this._bestYieldDir(car) || (car.lane === 0 ? 1 : car.lane === MAX_LANE ? -1 : (Math.random() < 0.5 ? -1 : 1));
    const lane = car.lane + dir;
    if (!this._laneBlocked(car, lane, 3)) {
      car.blink = dir;
      car.pendingLane = lane;
      car.targetLane = lane;
      car.moving = true;
      car.blinkT = 0;
    } else this._signal(car, dir, 0.4);
    return true;
  }

  _drive(c, dt, playerXs) {
    if (c.yielding) {
      c.yieldT -= dt;
      if (c.yieldT <= 0 && !c.moving) {
        c.yielding = false;
        if (!c.blinkT) { c.blink = 0; c.pendingLane = c.lane; }
      }
    }
    if (!c.moving && c.blink === 0 && this._pressured(c)) this._giveWay(c);
    if (c.blinkT > 0) {
      c.blinkT -= dt;
      if (c.blinkT <= 0) this._commitLane(c);
    } else if (!c.moving && c.blink === 0 && c.z < 6 && c.z > -260) {
      c.decideIn -= dt;
      if (c.decideIn <= 0) {
        c.decideIn = rand(2.6, 5.8);
        if (Math.random() < 0.72) {
          const xs = Array.isArray(playerXs) ? playerXs : [playerXs];
          const dirs = this._openDirs(c, 10).filter((dir) => {
            const dest = LANE_X[c.lane + dir];
            return !(Math.abs(c.z) < 18 && xs.some((px) => Math.abs(dest - px) < 2));
          });
          if (dirs.length) this._signal(c, pick(dirs), rand(0.9, 1.35));
        }
      }
    }
    if (c.nudgeT > 0) c.nudgeT -= dt;
    const hold = LANE_X[c.moving ? c.targetLane : c.lane];
    [c.x, c.lvx] = stepTrafficLateral(c.x, c.lvx, hold, dt);
    if (c.moving && Math.abs(hold - c.x) < 0.15 && Math.abs(c.lvx) < 0.28) {
      c.x = hold;
      c.lvx = 0;
      c.lane = c.targetLane;
      c.moving = false;
      c.blink = 0;
      c.yielding = false;
      c.pendingLane = c.lane;
      c.decideIn = rand(4, 9);
    }
    // Nose turns toward the new lane before the body has much speed, then the car rolls as it slides.
    const aim = c.moving ? Math.max(-0.62, Math.min(0.62, -(hold - c.x) * 0.2)) : 0;
    const desired = c.moving ? aim : (c.blink ? -c.blink * 0.2 : 0);
    c.yaw += (desired - c.yaw) * Math.min(1, dt * 2.4);
    c.root.rotation.y = c.yaw;
    c.root.rotation.z += (-c.lvx * 0.055 - c.root.rotation.z) * Math.min(1, dt * 4);
    if (c.blink) {
      c.phase += dt;
      const on = (c.phase * 4 | 0) % 2 === 0;
      c.leftInd.visible = c.blink < 0 && on;
      c.rightInd.visible = c.blink > 0 && on;
    } else if (c.leftInd.visible || c.rightInd.visible) {
      c.leftInd.visible = c.rightInd.visible = false;
    }
  }

  _trySpawn(z) {
    const free = this.cars.filter((c) => !c.active);
    if (!free.length) return false;
    const car = pick(free);
    const allLanes = Array.from({ length: LANE_X.length }, (_, i) => i);
    const lanes = car.type === 'truck' ? [MAX_LANE, MAX_LANE - 1, MAX_LANE] : allLanes.sort(() => Math.random() - 0.5);

    for (const lane of lanes) {
      let ok = true, vMin = 0, vMax = Infinity;
      const others = new Set();
      for (const c of this.cars) {
        if (!c.active || c.crashing) continue;
        const dz = Math.abs(c.z - z);
        const occupies = c.lane === lane || (c.moving && c.targetLane === lane) || (c.blink !== 0 && c.pendingLane === lane);
        if (occupies) {
          if (dz < c.hl + car.hl + 14) { ok = false; break; }
          if (c.z > z) vMin = Math.max(vMin, c.v); // closer to player: must not be caught
          else vMax = Math.min(vMax, c.v);          // farther: we must not catch it
        } else if (dz < 20) others.add(c.lane);
      }
      if (!ok || others.size >= 2) continue; // always leave at least 2 lanes clear across the 4-lane road
      const band = TYPE_SPEED[car.type] || [0.5, 0.7];
      const v = Math.max(rand(band[0], band[1]) * (this.cruise || 34), vMin);
      if (v > vMax) continue;

      car.lane = lane; car.x = LANE_X[lane]; car.z = z; car.v = v;
      car.active = true; car.crashing = false; car.ct = 0;
      car.blink = 0; car.blinkT = 0; car.pendingLane = lane; car.targetLane = lane;
      car.moving = false; car.yielding = false; car.yieldT = 0; car.nudgeT = 0; car.lvx = 0; car.yaw = 0;
      car.decideIn = rand(2.5, 6.5); car.phase = Math.random() * 2;
      car.leftInd.visible = false; car.rightInd.visible = false;
      for (const t of car.tinted) {
        t.mesh.material = t.kind === 'trailer' ? pick(this.trailerMats) : car.type === 'taxi' ? this.taxiMat : pick(this.bodyMats);
      }
      car.root.rotation.set(0, 0, 0);
      car.root.position.set(car.x, 0, car.z);
      car.root.visible = true;
      return true;
    }
    return false;
  }

  update(dt, worldSpeed, playerX = 0) {
    let count = 0;
    for (const c of this.cars) {
      if (!c.active) continue;
      count++;
      c.z += (worldSpeed - c.v) * dt;
      if (c.crashing) {
        c.ct += dt;
        c.x += c.cvx * dt;
        c.root.rotation.y += c.spin * dt;
        c.root.rotation.z = Math.max(-1.3, Math.min(1.3, c.root.rotation.z - Math.sign(c.cvx) * 2.2 * dt));
        c.leftInd.visible = c.rightInd.visible = false;
        if (c.ct > 1.6) { this._deactivate(c); continue; }
      } else if (c.z > RECYCLE_Z || c.z < -350) { this._deactivate(c); continue; }
      else this._drive(c, dt, playerX);
      if (c.crashing) c.root.position.set(c.x, 0, c.z);
      else {
        const rear = c.hl * 0.72;
        const yaw = c.root.rotation.y;
        c.root.position.set(c.x - Math.sin(yaw) * rear, 0, c.z + rear * (1 - Math.cos(yaw)));
      }
    }
    if (this.enabled) {
      this.timer -= dt;
      if (this.timer <= 0 && count < this.limit) {
        this.timer = this._trySpawn(-rand(230, 260)) ? this.interval * rand(0.7, 1.3) : 0.15;
      }
    }
  }

  /** Returns the first car overlapping the player box, or null. */
  hit(px, pz, pw, pl) {
    for (const c of this.cars) {
      if (!c.active || c.crashing) continue;
      if (Math.abs(c.z - pz) > c.hl + pl) continue;
      if (Math.abs(c.x - px) < c.hw + pw) return c;
    }
    return null;
  }

  knock(c, dir) {
    c.crashing = true; c.ct = 0;
    c.blink = 0; c.moving = false; c.yielding = false; c.nudgeT = 0; c.lvx = 0;
    c.leftInd.visible = c.rightInd.visible = false;
    c.cvx = dir * 9; c.spin = dir * 5; c.v *= 0.35;
  }

  dispose() {
    this.scene.remove(this.group);
    this.geos.forEach((g) => g.dispose());
    this.disposables.forEach((m) => m.dispose());
  }
}
