import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { WHEEL_RADIUS, BASE_SPEED, LANE_X, STEER_LIMIT, RAIL_X, stepLateral } from '../utils/Constants.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MODEL_URL = `${import.meta.env.BASE_URL}models/ferrari.glb`;
const TARGET_LENGTH = 4.15;

export class PlayerCar {
  constructor(scene, color = null, startX = LANE_X[1]) {
    this.scene = scene;
    this.group = new THREE.Group();   // world position (lane x, relative z)
    this.model = new THREE.Group();   // visual bob / lean / pitch / yaw
    this.group.add(this.model);
    this.wheels = [];
    this.flames = [];
    this.disposables = [];
    this.time = 0;
    this.rollRadius = WHEEL_RADIUS;
    this._color = color;
    this._startX = startX;

    // Phase 3 state
    this.group.position.x = startX;
    this.targetX = startX;
    this.invincibleT = 0;
    this.vx = 0;
    this.steer = 0;
    this.slip = 0;
    this.pitch = 0;
    this.nitroOn = false;
    this.braking = false;
    this.flameLevel = 0;

    this._buildEffects();
    this._loadModel();
    scene.add(this.group);
  }

  _t(o) { this.disposables.push(o); return o; }

  _buildEffects() {
    const flameMat = (color, opacity) => this._t(new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    const outerGeo = this._t(new THREE.ConeGeometry(0.16, 1.5, 8).translate(0, 0.75, 0).rotateX(Math.PI / 2));
    const innerGeo = this._t(new THREE.ConeGeometry(0.08, 0.95, 8).translate(0, 0.475, 0).rotateX(Math.PI / 2));
    const outerMat = flameMat(0xff7a1a, 0.8), innerMat = flameMat(0xbfe8ff, 0.95);
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.42, 0.38, 2.15);
      const outer = new THREE.Mesh(outerGeo, outerMat), inner = new THREE.Mesh(innerGeo, innerMat);
      g.add(outer, inner); g.visible = false;
      this.model.add(g);
      this.flames.push({ group: g, outer, inner });
    }

    this.headlight = new THREE.SpotLight(0xfff0cc, 0, 80, 0.55, 0.6, 1.2);
    this.headlight.position.set(0, 0.55, -2.15);
    this.headlight.target.position.set(0, 0, -25);
    this.group.add(this.headlight, this.headlight.target);
  }

  _loadModel() {
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    this.draco = draco;
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(MODEL_URL, (gltf) => this._mount(gltf.scene), undefined, (err) => {
      console.error('Ferrari model failed to load', err);
    });
  }

  _mount(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.name === 'body';
      o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) this._tuneMaterial(m);
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = TARGET_LENGTH / Math.max(size.z, 0.001);
    root.scale.setScalar(scale);
    box.setFromObject(root);
    root.position.y -= box.min.y;
    this.model.add(root);
    this.carRoot = root;
    this.rollRadius = 0.36 * scale;
    this.rearZ = 1.35;
    this.group.updateMatrixWorld(true);

    const found = [];
    root.traverse((o) => {
      if (o.name === 'wheel_fl' || o.name === 'wheel_fr' || o.name === 'wheel_rl' || o.name === 'wheel_rr') found.push(o);
    });
    for (const wheel of found) {
      const pivot = new THREE.Group();
      this.model.add(pivot);
      const pos = new THREE.Vector3();
      wheel.getWorldPosition(pos);
      this.model.worldToLocal(pos);
      pivot.position.copy(pos);
      pivot.attach(wheel);
      this.wheels.push({ pivot, spin: wheel, front: wheel.name === 'wheel_fl' || wheel.name === 'wheel_fr' });
    }
    const rears = this.wheels.filter((w) => !w.front);
    if (rears.length) this.rearZ = rears.reduce((s, w) => s + w.pivot.position.z, 0) / rears.length;
    if (this._color != null && this.bodyMat) this.bodyMat.color.set(this._color);
  }

  _tuneMaterial(m) {
    if (!m || m.userData._tuned) return;
    m.userData._tuned = true;
    switch (m.name) {
      case 'Body_Color':
        m.metalness = 0.55; m.roughness = 0.32;
        this.bodyMat = m;
        break;
      case 'Glass_Gray':
        m.transparent = true; m.opacity = 0.35; m.roughness = 0.05; m.metalness = 0.1; m.depthWrite = false;
        break;
      case 'Taillight_Glass':
        m.transparent = true; m.opacity = 0.8;
        m.emissive = new THREE.Color(0xff2218);
        m.emissiveIntensity = 0.7;
        this.tailMat = m;
        break;
      case 'Projector_Glass':
        m.transparent = true; m.opacity = 0.55; m.roughness = 0.08;
        m.emissive = new THREE.Color(0xfff4d2);
        m.emissiveIntensity = 0.35;
        break;
      case 'metal_chrome':
      case 'metal_gray':
        m.metalness = 0.9; m.roughness = 0.22;
        break;
      case 'Tires':
        m.metalness = 0; m.roughness = 0.95;
        break;
      default: break;
    }
  }

  // ---- public API ----
  setColor(hex) {
    this._color = hex;
    if (this.bodyMat) this.bodyMat.color.set(hex);
  }
  setNight(on) { this.headlight.intensity = on ? 120 : 0; }
  setControlState(nitroOn, braking) { this.nitroOn = nitroOn; this.braking = braking; }

  /** dir = -1 (left) or +1 (right). Returns true if the lane actually changed. */
  moveLane(dir) {
    const cur = this.nearestLane(this.targetX);
    const n = clamp(cur + dir, 0, LANE_X.length - 1);
    this.targetX = LANE_X[n];
    return n !== cur;
  }

  nearestLane(x = this.group.position.x) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < LANE_X.length; i++) {
      const d = Math.abs(x - LANE_X[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Free steering (wheel / held key): moves the lane target directly. The body catches up on its own. */
  steerBy(dx) { this.targetX = clamp(this.targetX + dx, -STEER_LIMIT, STEER_LIMIT); }

  /** Lane assist: glide to the closest lane centre. */
  snapToLane() { this.targetX = LANE_X[this.nearestLane(this.targetX)]; }

  /** Called after a railing foul: bounce away from the rail and return to a lane. */
  bounce(dir) { this.vx = -dir * 7; this.snapToLane(); }

  setInvincible(t) { this.invincibleT = t; }

  reset(startX = this._startX) {
    this._startX = startX;
    this.group.position.set(startX, 0, 0);
    this.group.visible = true;
    this.targetX = startX; this.vx = 0; this.steer = 0; this.slip = 0; this.pitch = 0;
    this.model.position.set(0, 0, 0);
    this.flameLevel = 0; this.nitroOn = false; this.braking = false; this.invincibleT = 0;
    this.model.visible = true;
  }

  get x() { return this.group.position.x; }
  get laneIndex() { return this.nearestLane(); }

  update(dt, speed) {
    this.time += dt;
    const pos = this.group.position;

    [pos.x, this.vx] = stepLateral(pos.x, this.vx, this.targetX, dt);
    if (pos.x > RAIL_X) { pos.x = RAIL_X; if (this.vx > 0) this.vx *= -0.2; }
    else if (pos.x < -RAIL_X) { pos.x = -RAIL_X; if (this.vx < 0) this.vx *= -0.2; }

    // Nose leads the turn: yaw is around the rear axle, so the front enters the lane before the tail.
    const yawT = clamp(-(this.targetX - pos.x) * 0.16, -0.26, 0.26);
    this.steer += (yawT - this.steer) * Math.min(1, dt * 10);
    const rear = this.rearZ || 1.35;
    this.model.rotation.y = this.steer;
    this.model.position.x = -Math.sin(this.steer) * rear;
    this.model.position.z = rear * (1 - Math.cos(this.steer));
    this.model.position.y = Math.sin(this.time * 9) * 0.008 * (speed / BASE_SPEED);
    const wheel = clamp(this.steer * 1.45, -0.5, 0.5);
    for (const w of this.wheels) if (w.front) w.pivot.rotation.y = wheel;

    const targetPitch = this.braking ? -0.03 : this.nitroOn ? 0.025 : 0;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 8);
    this.model.rotation.x = this.pitch;
    this.model.rotation.z = clamp(-this.vx * 0.01, -0.1, 0.1) + Math.sin(this.time * 0.8) * 0.006;

    const spin = (speed / this.rollRadius) * dt;
    for (const w of this.wheels) w.spin.rotateX(-spin);

    if (this.tailMat) this.tailMat.emissiveIntensity = this.braking ? 5 : 0.7;

    this.flameLevel += ((this.nitroOn ? 1 : 0) - this.flameLevel) * Math.min(1, dt * 10);
    const visible = this.flameLevel > 0.03;
    for (const f of this.flames) {
      f.group.visible = visible;
      if (!visible) continue;
      const s = this.flameLevel;
      f.outer.scale.set(s, s, s * (0.8 + Math.random() * 0.4));
      f.inner.scale.set(s, s, s * (0.7 + Math.random() * 0.5));
    }

    if (this.invincibleT > 0) {
      this.invincibleT -= dt;
      this.model.visible = this.invincibleT <= 0 || Math.floor(this.time * 14) % 2 === 0;
    } else if (!this.model.visible) this.model.visible = true;
  }

  dispose() {
    this.scene.remove(this.group);
    const mats = new Set();
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => { if (m) mats.add(m); });
    });
    mats.forEach((m) => m.dispose());
    this.disposables.forEach((d) => d.dispose());
    if (this.draco) this.draco.dispose();
  }
}
