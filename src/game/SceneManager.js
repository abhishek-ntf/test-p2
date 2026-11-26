import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THEMES } from '../utils/Constants.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.themeName = 'day';
    this.cameraMode = 'split'; // 'split' | 'shared'
    this.fovBoost = 0;
    this.fovBoost1 = 0;
    this.fovBoost2 = 0;
    this.baseFov = 62;
    this.splitBaseFov = 68;
    this.listeners = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();

    // Cheap image-based lighting so metallic paint reflects something
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this._envScene = new RoomEnvironment();
    this._envTarget = pmrem.fromScene(this._envScene, 0.04);
    this.scene.environment = this._envTarget.texture;
    pmrem.dispose();

    // Gradient sky drawn to a canvas (redrawn on theme change)
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 256; this.skyCanvas.height = 512;
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTexture;

    this.scene.fog = new THREE.Fog(0xffffff, 45, 200);

    // Shared camera
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 400);
    this.camera.position.set(0, 4.8, 11.8);
    this.camera.lookAt(0, 1.2, -14);

    // Independent split-screen cameras (Left: Player 1, Right: Player 2)
    this.cam1 = new THREE.PerspectiveCamera(68, 1, 0.5, 400);
    this.cam1.position.set(-1.7, 4.3, 9.5);
    this.cam1.lookAt(-1.7, 1.2, -14);

    this.cam2 = new THREE.PerspectiveCamera(68, 1, 0.5, 400);
    this.cam2.position.set(1.7, 4.3, 9.5);
    this.cam2.lookAt(1.7, 1.2, -14);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(8, 18, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const s = this.sun.shadow.camera;
    s.left = -12; s.right = 12; s.top = 26; s.bottom = -26; s.near = 1; s.far = 65;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.ambient, this.sun, this.sun.target);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this.resize();
  }

  onThemeChange(cb) { this.listeners.push(cb); }

  setCameraMode(mode) {
    this.cameraMode = mode === 'shared' ? 'shared' : 'split';
    this.resize();
  }

  setTheme(name) {
    const t = THEMES[name];
    if (!t) return;
    this.themeName = name;
    this._drawSky(t);
    this.scene.fog.color.set(t.skyHorizon);
    this.ambient.color.set(t.ambient); this.ambient.intensity = t.ambientI;
    this.sun.color.set(t.sun); this.sun.intensity = t.sunI;
    this.scene.environmentIntensity = t.envI;
    this.listeners.forEach((cb) => cb(t, name));
  }

  _drawSky(t) {
    const c = this.skyCanvas, ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, t.skyTop);
    g.addColorStop(0.42, t.skyHorizon);
    g.addColorStop(1, t.skyHorizon);
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    if (t.stars) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        ctx.globalAlpha = 0.3 + Math.random() * 0.7;
        ctx.fillRect(Math.random() * c.width, Math.random() * c.height * 0.38, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    this.skyTexture.needsUpdate = true;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);

    // Shared camera projection
    this.camera.aspect = w / h;
    this.baseFov = this.camera.aspect < 0.9 ? 78 : 62;
    this.camera.fov = this.baseFov + this.fovBoost;
    this.camera.updateProjectionMatrix();

    // Split-screen cameras projection (half width each)
    const halfAspect = Math.max(0.25, (w / 2) / h);
    this.splitBaseFov = halfAspect < 0.7 ? 78 : halfAspect < 1.05 ? 70 : 62;

    this.cam1.aspect = halfAspect;
    this.cam1.fov = this.splitBaseFov + this.fovBoost1;
    this.cam1.updateProjectionMatrix();

    this.cam2.aspect = halfAspect;
    this.cam2.fov = this.splitBaseFov + this.fovBoost2;
    this.cam2.updateProjectionMatrix();
  }

  /** Extra field of view (degrees) used for the speed / nitro effect in shared mode. */
  setFovBoost(b) {
    this.fovBoost = b;
    const f = this.baseFov + b;
    if (Math.abs(this.camera.fov - f) > 0.01) {
      this.camera.fov = f;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Extra FOV for split-screen camera 1 or 2. */
  setSplitFovBoost(playerId, b) {
    const cam = playerId === 1 ? this.cam1 : this.cam2;
    if (playerId === 1) this.fovBoost1 = b;
    else this.fovBoost2 = b;
    const f = this.splitBaseFov + b;
    if (Math.abs(cam.fov - f) > 0.01) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }

  render() {
    const w = window.innerWidth, h = window.innerHeight;
    if (this.cameraMode === 'split') {
      const halfW = Math.floor(w / 2);
      const rightW = w - halfW;
      this.renderer.setScissorTest(true);

      // Left half: Player 1 camera
      this.renderer.setViewport(0, 0, halfW, h);
      this.renderer.setScissor(0, 0, halfW, h);
      this.renderer.render(this.scene, this.cam1);

      // Right half: Player 2 camera
      this.renderer.setViewport(halfW, 0, rightW, h);
      this.renderer.setScissor(halfW, 0, rightW, h);
      this.renderer.render(this.scene, this.cam2);

      this.renderer.setScissorTest(false);
    } else {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.skyTexture.dispose();
    this._envTarget.dispose();
    this.renderer.dispose();
  }
}
