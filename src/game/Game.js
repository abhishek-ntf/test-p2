import { SceneManager } from './SceneManager.js';
import { Road } from './Road.js';
import { Environment } from './Environment.js';
import { PlayerCar } from './PlayerCar.js';
import { TrafficManager } from './TrafficManager.js';
import { Effects } from './Effects.js';
import { GameLoop } from './GameLoop.js';
import { KeyboardControls } from '../controls/KeyboardControls.js';
import { MobileControls } from '../controls/MobileControls.js';
import { GameHUD } from '../ui/GameHUD.js';
import { MainMenu } from '../ui/MainMenu.js';
import { GameOver } from '../ui/GameOver.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { Orientation } from '../ui/Orientation.js';
import { SteeringPicker } from '../ui/SteeringPicker.js';
import { GameStorage } from '../utils/Storage.js';
import { AudioManager } from '../audio/AudioManager.js';
import { CrazyGamesSDK } from '../utils/CrazyGamesSDK.js';
import { PlaygamaBridge } from '../utils/PlaygamaBridge.js';
import {
  LANE_X, ROAD_HALF, P1_COLOR, P2_COLOR,
  CRUISE_SPEED, MIN_SPEED, NITRO_SPEED, ACCEL, BRAKE_DECEL, COAST_DECEL, NITRO_ACCEL,
  NITRO_MAX, NITRO_DRAIN, NITRO_RECHARGE, NITRO_MIN_START,
  LIVES_MAX, INVINCIBLE_TIME, LEVEL_KM, CRUISE_PER_LEVEL, MAX_CRUISE, CRASH_SPEED,
  PLAYER_HW, PLAYER_HL, RAIL_HIT_X, LAT_SPEED, HOLD_FREE,
} from '../utils/Constants.js';

const MENU = 'menu', PLAYING = 'playing', OVER = 'over';
const NO_INPUT = { accel: false, brake: false, nitro: false, steer: 0 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.cg = CrazyGamesSDK.getInstance();
    this.cg.init();

    this.sm = new SceneManager(canvas);
    this.road = new Road(this.sm.scene, this.sm.renderer);
    this.environment = new Environment(this.sm.scene, this.sm.renderer);

    // Same car model (ferrari.glb) for both players, with distinct colors
    this.p1Car = new PlayerCar(this.sm.scene, P1_COLOR, LANE_X[1]);
    this.p2Car = new PlayerCar(this.sm.scene, P2_COLOR, LANE_X[2]);

    this.traffic = new TrafficManager(this.sm.scene);
    this.effects = new Effects(this.sm.scene);
    this.audio = new AudioManager();

    this.kb = new KeyboardControls();
    this.touch = new MobileControls(document.body, {
      onReset: () => this.startRace(),
      onSteerSwitch: () => this._showSteerPicker(),
    });
    this.orient = new Orientation(document.body);

    this.settings = GameStorage.getSettings();
    this.cameraMode = this.settings.cameraMode || 'split';
    this.sm.setCameraMode(this.cameraMode);
    this._modalPaused = false;
    this._steerPickerDone = null;

    this.players = [
      this._createPlayer(1, 'PLAYER 1', this.p1Car, LANE_X[1], this.kb.p1),
      this._createPlayer(2, 'PLAYER 2', this.p2Car, LANE_X[2], this.kb.p2),
    ];

    this._onAdState = (state) => {
      if (state === 'opened') {
        if (this.audio.ctx && this.audio.ctx.state === 'running') this.audio.ctx.suspend();
      } else if (state === 'closed' || state === 'failed') {
        if (this.audio.ctx && this.audio.ctx.state === 'suspended' && !this.paused) {
          this.audio.ctx.resume();
        }
      }
    };
    PlaygamaBridge.on('interstitial_state_changed', this._onAdState);

    this.pauseMenu = new PauseMenu(document.body, {
      onResume: () => this.togglePause(),
      onRestart: () => this.startRace(),
      onMenu: () => this._enterMenu(),
      onToggleMute: () => this.toggleMute(),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onToggleCamera: () => this.toggleCameraMode(),
    });

    this.hud = new GameHUD(document.body, {
      onPause: () => this.togglePause(),
      onTheme: () => this.toggleTheme(),
      onToggleMute: () => this.toggleMute(),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onToggleCamera: () => this.toggleCameraMode(),
    });
    this.hud.setMuted(this.audio.isMuted);
    this.hud.setCameraMode(this.cameraMode);

    this.menu = new MainMenu(document.body, {
      onStart: () => this.startRace(),
      onSettingsChange: (p) => this._onSettingsChange(p),
      onCalibrate: () => this.touch.calibrate(),
      onToggleMute: () => this.toggleMute(),
      onToggleFullscreen: () => this.toggleFullscreen(),
    });

    this.gameOverUI = new GameOver(document.body, {
      onRestart: () => this.startRace(),
      onMenu: () => this._enterMenu(),
    });

    this.steerPicker = new SteeringPicker(document.body, {
      onSelect: (mode) => this._onSteerModeSelect(mode),
      onClose: () => {
        this.resumeFromModal();
        if (this._steerPickerDone) {
          const cb = this._steerPickerDone;
          this._steerPickerDone = null;
          cb(null);
        }
      },
    });

    this.kb.onPause = () => this.togglePause();
    this.kb.onMute = () => this.toggleMute();
    this.kb.onFullscreen = () => this.toggleFullscreen();
    this.kb.onCamera = () => this.toggleCameraMode();
    this.kb.onAction = (code) => {
      if (this.state === MENU && code === 'Enter') this.startRace();
      else if (this.state === OVER && this.overShown) this.startRace();
      else if (this.paused && (code === 'Enter' || code === 'KeyR')) this.startRace();
    };

    this._onFsChange = () => {
      const isFs = !!document.fullscreenElement;
      this.hud.setFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', this._onFsChange);

    // Run state
    this.state = MENU;
    this.paused = false;
    this.level = 1;
    this.cruise = CRUISE_SPEED;
    this.worldSpeed = CRUISE_SPEED;
    this.shake = 0;
    this.camX = 0;
    this.fovBoost = 0;
    this.goTimer = 0;
    this.overShown = false;
    this.bumpCooldown = 0;

    this.sm.onThemeChange((theme) => {
      this.road.setTheme(theme);
      this.environment.setTheme(theme);
      this.p1Car.setNight(theme.headlights);
      this.p2Car.setNight(theme.headlights);
    });
    this.sm.setTheme('night');

    this._onVis = () => {
      if (document.hidden) {
        if (this.state === PLAYING && !this.paused) this.togglePause();
        if (this.audio.ctx && this.audio.ctx.state === 'running') this.audio.ctx.suspend();
      } else {
        if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', this._onVis);

    this._unlockAudio = () => this.audio.ensure();
    window.addEventListener('pointerdown', this._unlockAudio);
    window.addEventListener('keydown', this._unlockAudio);

    if (this.touch.enabled && !this.settings.controlMode) {
      this._showSteerPicker(() => this._enterMenu());
    } else {
      this._enterMenu();
    }

    this.loop = new GameLoop((dt) => this.update(dt), () => this.sm.render());
  }

  _createPlayer(id, label, car, startX, pad) {
    return {
      id,
      label,
      car,
      startX,
      pad,
      alive: true,
      lives: LIVES_MAX,
      distance: 0,
      score: 0,
      speed: CRUISE_SPEED,
      nitro: NITRO_MAX,
      nitroActive: false,
      kbHold: 0,
      freeSteer: false,
      z: 0,
      camX: startX,
      shake: 0,
      fovBoost: 0,
    };
  }

  _resetPlayers() {
    for (const p of this.players) {
      p.alive = true;
      p.lives = LIVES_MAX;
      p.distance = 0;
      p.score = 0;
      p.speed = CRUISE_SPEED;
      p.nitro = NITRO_MAX;
      p.nitroActive = false;
      p.kbHold = 0;
      p.freeSteer = false;
      p.z = 0;
      p.camX = p.startX;
      p.shake = 0;
      p.fovBoost = 0;
      p.car.reset(p.startX);
      this.hud.setEliminated(p.id, false);
    }
  }

  run() {
    this.loop.start();
  }

  toggleTheme() {
    this.sm.setTheme(this.sm.themeName === 'day' ? 'night' : 'day');
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'shared' ? 'shared' : 'split';
    this.settings = GameStorage.saveSettings({ cameraMode: this.cameraMode });
    this.sm.setCameraMode(this.cameraMode);
    this.hud.setCameraMode(this.cameraMode);
    this.pauseMenu.setCameraMode(this.cameraMode);
    this.menu.setCameraMode(this.cameraMode);
  }

  toggleCameraMode() {
    const next = this.cameraMode === 'split' ? 'shared' : 'split';
    this.setCameraMode(next);
    if (this.state === PLAYING) {
      this.hud.banner(next === 'split' ? 'SPLIT SCREEN' : 'SHARED CAMERA', 'good', 'center');
    }
  }

  toggleMute() {
    const isMuted = this.audio.toggleMute();
    this.hud.setMuted(isMuted);
    this.pauseMenu.setMuted(isMuted);
    this.menu.setMuted(isMuted);
    return isMuted;
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  pauseForModal() {
    if (this.state === PLAYING && !this.paused) {
      this._modalPaused = true;
      this.paused = true;
      this.kb.reset();
      this.touch.reset();
      this.audio.update({ active: false, speed: 0, nitro: false });
      this.cg.gameplayStop();
      PlaygamaBridge.sendGameplayStopped();
    }
  }

  resumeFromModal() {
    if (this._modalPaused && this.state === PLAYING) {
      this._modalPaused = false;
      this.paused = false;
      this.kb.reset();
      this.touch.reset();
      this.cg.gameplayStart();
      PlaygamaBridge.sendGameplayStarted();
    }
  }

  _onSettingsChange(partial) {
    this.settings = GameStorage.saveSettings(partial);
    if (partial.cameraMode) this.setCameraMode(this.settings.cameraMode);
    if (partial.controlMode) this.touch.setMode(this.settings.controlMode);
    if (partial.tiltSensitivity != null) this.touch.setSensitivity(this.settings.tiltSensitivity);
    if (partial.tiltInvert != null) this.touch.setInvert(this.settings.tiltInvert);
  }

  _showSteerPicker(onDone = null) {
    this.pauseForModal();
    this._steerPickerDone = onDone;
    this.steerPicker.show(this.settings.controlMode || 'arrows');
  }

  _onSteerModeSelect(mode) {
    this.touch.setMode(mode);
    this.settings = GameStorage.saveSettings({ controlMode: mode });
    if (mode === 'motion') this.touch.calibrate();
    this.resumeFromModal();
    if (this._steerPickerDone) {
      const cb = this._steerPickerDone;
      this._steerPickerDone = null;
      cb(mode);
    }
  }

  // ---------- State transitions ----------
  _enterMenu() {
    this.state = MENU;
    this.cg.gameplayStop();
    PlaygamaBridge.sendGameplayStopped();
    this.traffic.clear();
    this._resetPlayers();
    this.cruise = CRUISE_SPEED;
    this.worldSpeed = CRUISE_SPEED;
    this.hud.hide();
    this.gameOverUI.hide();
    this.pauseMenu.hide();

    this.settings = GameStorage.getSettings();
    this.menu.show({
      isTouch: this.touch.enabled,
      settings: this.settings,
      isMuted: this.audio.isMuted,
    });
  }

  startRace() {
    this.audio.ensure();
    this.cg.gameplayStart();
    PlaygamaBridge.sendGameplayStarted();
    this.kb.reset();
    this.touch.reset();
    this.paused = false;

    this.level = 1;
    this.cruise = CRUISE_SPEED;
    this.worldSpeed = CRUISE_SPEED;
    this.shake = 0;
    this.overShown = false;
    this.goTimer = 0;
    this.bumpCooldown = 0;

    this._resetPlayers();
    this.traffic.reset(this.level, this.cruise);

    this.menu.hide();
    this.gameOverUI.hide();
    this.pauseMenu.hide();

    this.hud.setScores(0, 0);
    this.hud.show();

    this.state = PLAYING;
    this.orient.requestLandscape();
  }

  togglePause() {
    if (this.state !== PLAYING) return;
    this.paused = !this.paused;
    this.kb.reset();
    this.touch.reset();

    if (this.paused) {
      this.pauseMenu.show(this.audio.isMuted, this.cameraMode);
      this.cg.gameplayStop();
      PlaygamaBridge.sendGameplayStopped();
    } else {
      this.pauseMenu.hide();
      this.cg.gameplayStart();
      PlaygamaBridge.sendGameplayStarted();
    }
  }

  _gameOver() {
    this.state = OVER;
    this.cg.gameplayStop();
    PlaygamaBridge.sendGameplayStopped();
    this.goTimer = 0;
    this.overShown = false;
    this.traffic.stopSpawning();
    for (const p of this.players) p.nitroActive = false;
    this.hud.banner('GAME OVER', 'bad');
    setTimeout(() => { PlaygamaBridge.showInterstitial(); }, 1200);
  }

  // ---------- Per-frame loop ----------
  _readInput(p) {
    const a = p.pad.state;
    if (p.id === 1 && this.touch.enabled) {
      const b = this.touch.state;
      return { accel: a.accel || b.accel, brake: a.brake || b.brake, nitro: a.nitro || b.nitro, steer: a.steer };
    }
    return a;
  }

  _applySteering(p, dt) {
    let d;
    while ((d = p.pad.consumeLane()) !== 0) p.car.moveLane(d);
    if (p.id === 1 && this.touch.enabled) {
      while ((d = this.touch.consumeLane()) !== 0) p.car.moveLane(d);
    }

    let free = false;
    const ks = p.pad.state.steer;
    if (ks !== 0) {
      p.kbHold += dt;
      if (p.kbHold > HOLD_FREE) {
        p.car.steerBy(ks * LAT_SPEED * dt);
        free = true;
      }
    } else {
      p.kbHold = 0;
    }

    if (p.id === 1 && this.touch.steering) {
      const s = this.touch.state.steer;
      p.car.steerBy(Math.sign(s) * Math.pow(Math.abs(s), 1.25) * LAT_SPEED * dt);
      free = true;
    }

    if (!free && p.freeSteer) p.car.snapToLane();
    p.freeSteer = free;
  }

  update(dt) {
    if (this.paused) {
      this.audio.update({ active: false, speed: 0, nitro: false });
      return;
    }

    const playing = this.state === PLAYING;
    if (this.bumpCooldown > 0) this.bumpCooldown -= dt;

    if (playing) {
      const maxSpeed = this.cruise + 22;
      let speedSum = 0;
      let aliveCount = 0;

      for (const p of this.players) {
        if (!p.alive) continue;
        const inp = this._readInput(p);
        this._applySteering(p, dt);

        const horn = p.pad.consumeHorn() || (p.id === 1 && this.touch.consumeHorn());
        if (horn) {
          this.audio.horn();
          this.traffic.yieldAhead(p.car.x, p.z);
        }

        // Nitro
        p.nitroActive = inp.nitro && !inp.brake && (p.nitroActive ? p.nitro > 0 : p.nitro >= NITRO_MIN_START);
        p.nitro = p.nitroActive
          ? Math.max(0, p.nitro - NITRO_DRAIN * dt)
          : Math.min(NITRO_MAX, p.nitro + NITRO_RECHARGE * dt);

        // Speed model
        let target, rate;
        if (p.nitroActive) { target = NITRO_SPEED; rate = NITRO_ACCEL; }
        else if (inp.brake) { target = MIN_SPEED; rate = BRAKE_DECEL; }
        else if (inp.accel) { target = maxSpeed; rate = p.speed > maxSpeed ? COAST_DECEL : ACCEL; }
        else { target = this.cruise; rate = p.speed > this.cruise ? COAST_DECEL : ACCEL; }
        p.speed = approach(p.speed, target, rate * dt);

        p.car.setControlState(p.nitroActive, inp.brake);
        speedSum += p.speed;
        aliveCount++;
      }

      this.worldSpeed = aliveCount > 0 ? speedSum / aliveCount : 0;

      const minZ = this.cameraMode === 'split' ? -22 : -6.5;
      const maxZ = this.cameraMode === 'split' ? 10 : 3.2;

      for (const p of this.players) {
        if (p.alive) {
          p.z = clamp(p.z + (this.worldSpeed - p.speed) * dt, minZ, maxZ);
          if (aliveCount === 1) {
            p.z += (0 - p.z) * Math.min(1, dt * 2.5);
          }
          p.car.group.position.z = p.z;
          p.distance += p.speed * dt;
          p.score = Math.floor(p.distance);
        } else {
          p.z += this.worldSpeed * dt;
          p.car.group.position.z = p.z;
          if (p.z > 24) p.car.group.visible = false;
        }
      }
    } else if (this.state === OVER) {
      this.worldSpeed = approach(this.worldSpeed, 0, 30 * dt);
      for (const p of this.players) {
        p.car.setControlState(false, false);
      }
    } else {
      this.worldSpeed = CRUISE_SPEED;
      for (const p of this.players) {
        p.car.setControlState(false, false);
      }
    }

    // World updates
    this.road.update(dt, this.worldSpeed);
    this.environment.update(dt, this.worldSpeed);
    for (const p of this.players) {
      if (p.car.group.visible) p.car.update(dt, p.alive ? p.speed : 0);
    }
    const aliveXs = this.players.filter((p) => p.alive).map((p) => p.car.x);
    this.traffic.update(dt, this.worldSpeed, aliveXs.length ? aliveXs : [0]);
    this.effects.update(dt);

    const anyNitro = playing && this.players.some((p) => p.alive && p.nitroActive);
    this.audio.update({
      active: this.state !== MENU && !this.paused,
      speed: this.worldSpeed,
      nitro: anyNitro,
    });

    if (playing) {
      this._updateProgress();
      this._checkCollisions();
    } else if (this.state === OVER) {
      this._updateOver(dt);
    }

    this._updateCamera(dt);
    if (this.state !== MENU) this._updateHud();
  }

  _updateProgress() {
    const maxDist = Math.max(this.players[0].distance, this.players[1].distance);
    const lvl = 1 + Math.floor((maxDist / 1000) / LEVEL_KM);
    if (lvl > this.level) {
      this.level = lvl;
      this.cruise = Math.min(CRUISE_SPEED + (lvl - 1) * CRUISE_PER_LEVEL, MAX_CRUISE);
      this.traffic.setLevel(lvl, this.cruise);
    }
  }

  _checkCollisions() {
    // Player vs Traffic and Railings
    for (const p of this.players) {
      if (!p.alive || p.car.invincibleT > 0) continue;

      const car = this.traffic.hit(p.car.x, p.z, PLAYER_HW, PLAYER_HL);
      if (car) {
        if (p.speed < car.v || car.nudgeT > 0) {
          if (this.traffic.nudgeAside(car)) {
            this.audio.horn();
            car.nudgeT = 1.4;
          }
          continue;
        }
        this._foul(p, 'car', car);
        continue;
      }

      if (Math.abs(p.car.x) > RAIL_HIT_X) {
        this._foul(p, 'rail', null);
      }
    }

    // Player 1 vs Player 2 soft lateral bump (no life lost)
    const [p1, p2] = this.players;
    if (p1.alive && p2.alive && p1.car.invincibleT <= 0 && p2.car.invincibleT <= 0) {
      const dx = p1.car.x - p2.car.x;
      const dz = Math.abs(p1.z - p2.z);
      if (Math.abs(dx) < PLAYER_HW * 1.9 && dz < PLAYER_HL * 1.85) {
        const sign = dx === 0 ? -1 : Math.sign(dx);
        p1.car.group.position.x += sign * 0.16;
        p2.car.group.position.x -= sign * 0.16;
        p1.car.vx += sign * 6.5;
        p2.car.vx -= sign * 6.5;
        p1.car.targetX = clamp(p1.car.group.position.x + sign * 0.5, -RAIL_HIT_X, RAIL_HIT_X);
        p2.car.targetX = clamp(p2.car.group.position.x - sign * 0.5, -RAIL_HIT_X, RAIL_HIT_X);
        this.effects.burst((p1.car.x + p2.car.x) / 2, 0.7, (p1.z + p2.z) / 2, 10, 0, 7);
        if (this.bumpCooldown <= 0) {
          this.audio.impact(false);
          this.bumpCooldown = 0.28;
        }
      }
    }
  }

  _foul(p, kind, car) {
    p.lives--;
    const isSplit = this.cameraMode === 'split';
    const side = isSplit ? (p.id === 1 ? 'p1' : 'p2') : 'both';
    const bannerSide = isSplit ? (p.id === 1 ? 'p1' : 'p2') : 'center';

    this.hud.flash(side);
    this.shake = 0.8;
    p.shake = 0.8;
    p.car.setInvincible(INVINCIBLE_TIME);

    this.audio.impact(kind === 'car');
    if (kind === 'car') {
      const dir = Math.sign(car.x - p.car.x) || (Math.random() < 0.5 ? -1 : 1);
      this.traffic.knock(car, dir);
      this.effects.burst((car.x + p.car.x) / 2, 0.8, car.z, 26, dir, 10);
      p.car.vx += -dir * 3;
      p.speed = Math.min(p.speed, CRASH_SPEED);
    } else {
      const dir = Math.sign(p.car.x);
      this.effects.burst(dir * ROAD_HALF, 0.5, p.z, 22, -dir, 8);
      p.car.bounce(dir);
      p.speed *= 0.75;
    }

    if (p.lives <= 0) {
      p.alive = false;
      p.speed = 0;
      p.nitroActive = false;
      this.hud.setEliminated(p.id, true);
      if (this.players.some((pl) => pl.alive)) {
        this.hud.banner(`${p.label} OUT!`, 'bad', bannerSide);
      } else {
        this._gameOver();
      }
    } else {
      const tag = kind === 'car' ? 'CRASH!' : 'RAIL FOUL!';
      this.hud.banner(`${p.label} ${tag} (${p.lives} LEFT)`, 'bad', bannerSide);
    }
  }

  _updateOver(dt) {
    this.goTimer += dt;
    if (!this.overShown && this.goTimer > 1.1) {
      this.overShown = true;
      this.gameOverUI.show({
        p1Score: this.players[0].score,
        p2Score: this.players[1].score,
      });
    }
  }

  _updateHud() {
    this.hud.setScores(this.players[0].score, this.players[1].score);
  }

  _updateCamera(dt) {
    if (this.cameraMode === 'split') {
      const cams = [this.sm.cam1, this.sm.cam2];
      for (let i = 0; i < 2; i++) {
        const p = this.players[i];
        const cam = cams[i];
        const lvl = p.alive ? p.car.flameLevel : 0;
        p.shake = Math.max(0, p.shake - dt * 1.6);
        const sh = p.shake * 0.28;

        const targetX = p.alive ? p.car.x * 0.65 : p.camX;
        p.camX += (targetX - p.camX) * Math.min(1, dt * 12);
        const z = p.alive ? clamp(p.z, -22, 10) : clamp(p.z, -22, 14);

        cam.position.x = p.camX + (Math.random() - 0.5) * (0.04 * lvl + sh);
        cam.position.y = 4.3 + (Math.random() - 0.5) * (0.04 * lvl + sh);
        cam.position.z = z + 9.5 + lvl * 0.85;
        cam.lookAt(p.camX * 0.85, 1.2, z - 14);

        const targetBoost = p.alive
          ? clamp((p.speed - this.cruise) / (NITRO_SPEED - this.cruise), 0, 1) * 10
          : 0;
        p.fovBoost += (targetBoost - p.fovBoost) * Math.min(1, dt * 5);
        this.sm.setSplitFovBoost(p.id, p.fovBoost);
      }
      return;
    }

    const cam = this.sm.camera;
    const alive = this.players.filter((p) => p.alive);
    const focusX = alive.length
      ? alive.reduce((s, p) => s + p.car.x, 0) / alive.length
      : 0;
    const lvl = alive.length ? Math.max(...alive.map((p) => p.car.flameLevel)) : 0;

    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * 0.28;

    this.camX += (focusX * 0.35 - this.camX) * Math.min(1, dt * 12);
    cam.position.x = this.camX + (Math.random() - 0.5) * (0.05 * lvl + sh);
    cam.position.y = 4.8 + (Math.random() - 0.5) * (0.05 * lvl + sh);
    cam.position.z = 11.8 + lvl * 0.8;
    cam.lookAt(this.camX * 0.5, 1.2, -14);

    const targetBoost = clamp((this.worldSpeed - this.cruise) / (NITRO_SPEED - this.cruise), 0, 1) * 10;
    this.fovBoost += (targetBoost - this.fovBoost) * Math.min(1, dt * 5);
    this.sm.setFovBoost(this.fovBoost);
  }

  dispose() {
    document.removeEventListener('visibilitychange', this._onVis);
    document.removeEventListener('fullscreenchange', this._onFsChange);
    window.removeEventListener('pointerdown', this._unlockAudio);
    window.removeEventListener('keydown', this._unlockAudio);
    if (this._onAdState) PlaygamaBridge.off('interstitial_state_changed', this._onAdState);

    this.audio.dispose();
    this.loop.dispose();
    this.kb.dispose();
    this.touch.dispose();
    this.orient.dispose();
    this.steerPicker.dispose();
    this.pauseMenu.dispose();
    this.effects.dispose();
    this.traffic.dispose();
    this.p1Car.dispose();
    this.p2Car.dispose();
    this.environment.dispose();
    this.road.dispose();
    this.sm.dispose();
  }
}
