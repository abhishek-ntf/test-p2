const PREVENT_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab',
]);

function makePlayerPad() {
  return {
    state: { accel: false, brake: false, nitro: false, steer: 0 },
    laneQueue: [],
    hornPulse: false,
    _l: false,
    _r: false,
    _sync() {
      this.state.steer = (this._r ? 1 : 0) - (this._l ? 1 : 0);
    },
    _push(d) {
      if (this.laneQueue.length < 3) this.laneQueue.push(d);
    },
    consumeLane() {
      return this.laneQueue.shift() || 0;
    },
    consumeHorn() {
      const h = this.hornPulse;
      this.hornPulse = false;
      return h;
    },
    reset() {
      this.state.accel = this.state.brake = this.state.nitro = false;
      this.state.steer = 0;
      this._l = this._r = false;
      this.laneQueue.length = 0;
      this.hornPulse = false;
    },
  };
}

/**
 * Two-player desktop keyboard input:
 * - Player 1: W / A / S / D (Left Shift / E for nitro, Q for horn)
 * - Player 2: ArrowUp / ArrowLeft / ArrowDown / ArrowRight (Right Shift / Space for nitro, Slash for horn)
 * - Global: P / Esc pause, M mute, F fullscreen, Enter / R start or restart
 */
export class KeyboardControls {
  constructor() {
    this.p1 = makePlayerPad();
    this.p2 = makePlayerPad();

    this.onPause = null;
    this.onAction = null;     // Enter / R (start, restart)
    this.onMute = null;       // M key
    this.onFullscreen = null; // F key
    this.onKeyActivity = null;

    this._p1Left = (c) => c === 'KeyA';
    this._p1Right = (c) => c === 'KeyD';
    this._p1Accel = (c) => c === 'KeyW';
    this._p1Brake = (c) => c === 'KeyS';
    this._p1Nitro = (c) => c === 'ShiftLeft' || c === 'KeyE';
    this._p1Horn = (c) => c === 'KeyQ';

    this._p2Left = (c) => c === 'ArrowLeft';
    this._p2Right = (c) => c === 'ArrowRight';
    this._p2Accel = (c) => c === 'ArrowUp';
    this._p2Brake = (c) => c === 'ArrowDown';
    this._p2Nitro = (c) => c === 'ShiftRight' || c === 'Space';
    this._p2Horn = (c) => c === 'Slash' || c === 'Numpad0';

    this._isPause = (c) => c === 'KeyP' || c === 'Escape';
    this._isAction = (c) => c === 'Enter' || c === 'KeyR';
    this._isMute = (c) => c === 'KeyM';
    this._isFs = (c) => c === 'KeyF';

    this._down = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (PREVENT_KEYS.has(e.code) || e.key === ' ') {
        e.preventDefault();
      }

      const c = e.code;

      // Player 1 (WASD)
      if (this._p1Left(c)) {
        if (!e.repeat) this.p1._push(-1);
        this.p1._l = true;
      }
      if (this._p1Right(c)) {
        if (!e.repeat) this.p1._push(1);
        this.p1._r = true;
      }
      if (this._p1Accel(c)) this.p1.state.accel = true;
      if (this._p1Brake(c)) this.p1.state.brake = true;
      if (this._p1Nitro(c)) this.p1.state.nitro = true;
      if (this._p1Horn(c) && !e.repeat) this.p1.hornPulse = true;

      // Player 2 (Arrow keys)
      if (this._p2Left(c)) {
        if (!e.repeat) this.p2._push(-1);
        this.p2._l = true;
      }
      if (this._p2Right(c)) {
        if (!e.repeat) this.p2._push(1);
        this.p2._r = true;
      }
      if (this._p2Accel(c)) this.p2.state.accel = true;
      if (this._p2Brake(c)) this.p2.state.brake = true;
      if (this._p2Nitro(c)) this.p2.state.nitro = true;
      if (this._p2Horn(c) && !e.repeat) this.p2.hornPulse = true;

      // Global actions
      if (this._isPause(c) && !e.repeat && this.onPause) this.onPause();
      if (this._isAction(c) && !e.repeat && this.onAction) this.onAction(c);
      if (this._isMute(c) && !e.repeat && this.onMute) this.onMute();
      if (this._isFs(c) && !e.repeat && this.onFullscreen) this.onFullscreen();

      this.p1._sync();
      this.p2._sync();
    };

    this._up = (e) => {
      const c = e.code;

      if (this._p1Left(c)) this.p1._l = false;
      if (this._p1Right(c)) this.p1._r = false;
      if (this._p1Accel(c)) this.p1.state.accel = false;
      if (this._p1Brake(c)) this.p1.state.brake = false;
      if (this._p1Nitro(c)) this.p1.state.nitro = false;

      if (this._p2Left(c)) this.p2._l = false;
      if (this._p2Right(c)) this.p2._r = false;
      if (this._p2Accel(c)) this.p2.state.accel = false;
      if (this._p2Brake(c)) this.p2.state.brake = false;
      if (this._p2Nitro(c)) this.p2.state.nitro = false;

      this.p1._sync();
      this.p2._sync();
    };

    this._blur = () => this.reset();
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  reset() {
    this.p1.reset();
    this.p2.reset();
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
  }
}
