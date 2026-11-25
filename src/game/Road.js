import * as THREE from 'three';
import {
  LANE_WIDTH, LANE_COUNT, ROAD_WIDTH, ROAD_HALF, SEGMENT_LENGTH, SEGMENT_COUNT, WORLD_SPAN, RECYCLE_Z,
} from '../utils/Constants.js';

function createRoadTexture(renderer) {
  const ppu = 40; // pixels per world unit
  const w = Math.round(ROAD_WIDTH * ppu), h = SEGMENT_LENGTH * ppu;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const X = (wx) => (wx + ROAD_HALF) * ppu;

  ctx.fillStyle = '#34353b'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { // asphalt grain
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  // rumble strips (curbs), alternate every 2 units – tiles seamlessly
  for (let y = 0, i = 0; y < h; y += 2 * ppu, i++) {
    ctx.fillStyle = i % 2 ? '#e8e8e8' : '#d6203a';
    ctx.fillRect(X(-ROAD_HALF), y, 0.6 * ppu, 2 * ppu);
    ctx.fillRect(X(ROAD_HALF - 0.6), y, 0.6 * ppu, 2 * ppu);
  }
  // solid edge lines
  ctx.fillStyle = '#f4f4f4';
  const edge = (LANE_WIDTH * LANE_COUNT) / 2 - 0.15;
  ctx.fillRect(X(-edge) - 0.09 * ppu, 0, 0.18 * ppu, h);
  ctx.fillRect(X(edge) - 0.09 * ppu, 0, 0.18 * ppu, h);
  // dashed lane dividers: 4u dash / 6u gap, period 10u
  ctx.fillStyle = '#ffd84a';
  for (let y = 0; y < h; y += 10 * ppu) {
    for (let i = 1; i < LANE_COUNT; i++) {
      const lx = (i - LANE_COUNT / 2) * LANE_WIDTH;
      ctx.fillRect(X(lx) - 0.09 * ppu, y, 0.18 * ppu, 4 * ppu);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export class Road {
  constructor(scene, renderer) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.segments = [];

    this.texture = createRoadTexture(renderer);
    this.roadMat = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.92, metalness: 0.0 });
    this.railMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.8, roughness: 0.35 });
    this.roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH).rotateX(-Math.PI / 2);
    this.railGeo = new THREE.BoxGeometry(0.12, 0.45, SEGMENT_LENGTH);

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = new THREE.Group();
      const road = new THREE.Mesh(this.roadGeo, this.roadMat);
      road.receiveShadow = true;
      seg.add(road);
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(this.railGeo, this.railMat);
        rail.position.set(side * (ROAD_HALF + 0.25), 0.55, 0);
        seg.add(rail);
      }
      seg.position.z = 20 - i * SEGMENT_LENGTH;
      this.group.add(seg);
      this.segments.push(seg);
    }
    scene.add(this.group);
  }

  setTheme(theme) { this.roadMat.color.set(theme.road); }

  update(dt, speed) {
    const dz = speed * dt;
    for (const seg of this.segments) {
      seg.position.z += dz;
      if (seg.position.z > RECYCLE_Z) seg.position.z -= WORLD_SPAN;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.texture.dispose(); this.roadMat.dispose(); this.railMat.dispose();
    this.roadGeo.dispose(); this.railGeo.dispose();
  }
}
