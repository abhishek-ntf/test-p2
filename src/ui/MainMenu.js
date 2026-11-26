/**
 * Start screen for 2-Player Neon Highway:
 * - PLAY tab: quick start, 2-player control preview, and camera mode option
 * - CONTROLS tab: detailed P1 (WASD) & P2 (Arrow keys) guide
 * - SETTINGS tab: camera mode, audio toggle, fullscreen, mobile steering mode
 */
export class MainMenu {
  constructor(parent = document.body, { onStart, onSettingsChange, onCalibrate, onToggleMute, onToggleFullscreen } = {}) {
    this.onStart = onStart;
    this.onSettingsChange = onSettingsChange;
    this.onCalibrate = onCalibrate;
    this.onToggleMute = onToggleMute;
    this.onToggleFullscreen = onToggleFullscreen;

    this.root = document.createElement('div');
    this.root.className = 'overlay hidden';
    this.root.innerHTML = `
      <div class="panel glass menu-panel">
        <div class="menu-tabs">
          <button type="button" class="tab active" data-tab="play">PLAY</button>
          <button type="button" class="tab" data-tab="controls">CONTROLS</button>
          <button type="button" class="tab" data-tab="settings">SETTINGS</button>
        </div>

        <!-- PLAY TAB -->
        <div class="tab-body" data-body="play">
          <h1 class="title small">NEON<br>HIGHWAY</h1>
          <p class="sub">2-Player Arcade Racer · 4-Lane Endless Highway</p>

          <div class="p2-cards">
            <div class="p2-card p1">
              <span class="p2-badge">PLAYER 1 · RED</span>
              <div class="p2-keys"><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></div>
              <small>Shift / E: Nitro</small>
            </div>
            <div class="p2-card p2">
              <span class="p2-badge">PLAYER 2 · BLUE</span>
              <div class="p2-keys"><kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd></div>
              <small>R-Shift / Space: Nitro</small>
            </div>
          </div>

          <div class="cam-option-wrap">
            <small>CAMERA MODE</small>
            <div class="cam-pick" data-k="camPickPlay">
              <button type="button" data-cam="split">◫ SPLIT SCREEN</button>
              <button type="button" data-cam="shared">▢ SHARED</button>
            </div>
          </div>

          <button type="button" class="btn" data-k="start">START RACE</button>
          <p class="hint" data-k="hint">Press ENTER to race · C camera · P pause</p>
        </div>

        <!-- CONTROLS TAB -->
        <div class="tab-body hidden" data-body="controls">
          <h2 class="tab-title">2-PLAYER CONTROLS</h2>
          <div class="controls-guide">
            <div class="ctrl-grid">
              <div class="ctrl-card p1">
                <b>PLAYER 1 (RED CAR)</b>
                <p><kbd>W</kbd> Accelerate<br><kbd>S</kbd> Brake<br><kbd>A</kbd> / <kbd>D</kbd> Steer<br><kbd>L-Shift</kbd> / <kbd>E</kbd> Nitro · <kbd>Q</kbd> Horn</p>
              </div>
              <div class="ctrl-card p2">
                <b>PLAYER 2 (BLUE CAR)</b>
                <p><kbd>↑</kbd> Accelerate<br><kbd>↓</kbd> Brake<br><kbd>←</kbd> / <kbd>→</kbd> Steer<br><kbd>R-Shift</kbd> / <kbd>Space</kbd> Nitro · <kbd>/</kbd> Horn</p>
              </div>
            </div>
            <p class="hint">Press <kbd>C</kbd> anytime to switch between Split Screen and Shared Camera.</p>
          </div>
        </div>

        <!-- SETTINGS TAB -->
        <div class="tab-body hidden" data-body="settings">
          <h2 class="tab-title">SETTINGS</h2>

          <div class="set-group">
            <small>CAMERA MODE</small>
            <div class="mode-pick" data-k="camPickSet">
              <button type="button" data-cam="split">◫ SPLIT SCREEN</button>
              <button type="button" data-cam="shared">▢ SHARED CAMERA</button>
            </div>
          </div>

          <div class="set-group">
            <small>AUDIO &amp; DISPLAY</small>
            <div class="pause-row-btns">
              <button type="button" class="btn small" data-k="audioBtn">🔊 SOUND: ON</button>
              <button type="button" class="btn small" data-k="fsBtn">⛶ FULLSCREEN</button>
            </div>
          </div>

          <div class="set-group">
            <small>MOBILE STEERING CONTROL (P1)</small>
            <div class="mode-pick" data-k="modes">
              <button type="button" data-mode="arrows">ARROWS</button>
              <button type="button" data-mode="wheel">WHEEL</button>
              <button type="button" data-mode="motion">TILT / MOTION</button>
            </div>
          </div>

          <div class="set-group tilt-only">
            <small>TILT SENSITIVITY · <span data-k="sensVal">1.5</span></small>
            <input type="range" min="0.5" max="3" step="0.1" data-k="sens" />
          </div>

          <div class="set-group tilt-only">
            <label class="check"><input type="checkbox" data-k="invert" /> INVERT TILT</label>
            <button type="button" class="btn small" data-k="calib">CALIBRATE TILT SENSOR</button>
          </div>

          <p class="hint" data-k="setHint"></p>
        </div>
      </div>
    `;

    this.el = {};
    this.root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });

    this.root.querySelectorAll('.tab').forEach((t) => {
      t.addEventListener('click', () => this._switchTab(t.dataset.tab));
    });

    this.el.start.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (this.onStart) this.onStart();
    });

    const wireCamPick = (wrap) => {
      wrap.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.currentTarget.blur();
          this.setCameraMode(b.dataset.cam);
          if (this.onSettingsChange) this.onSettingsChange({ cameraMode: b.dataset.cam });
        });
      });
    };
    wireCamPick(this.el.camPickPlay);
    wireCamPick(this.el.camPickSet);

    this.el.audioBtn.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (this.onToggleMute) {
        const isMuted = this.onToggleMute();
        this.setMuted(isMuted);
      }
    });

    this.el.fsBtn.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (this.onToggleFullscreen) this.onToggleFullscreen();
    });

    this.el.modes.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.currentTarget.blur();
        this._applyMode(b.dataset.mode);
        if (this.onSettingsChange) this.onSettingsChange({ controlMode: b.dataset.mode });
      });
    });

    this.el.sens.addEventListener('input', () => {
      const v = Number(this.el.sens.value);
      this.el.sensVal.textContent = v.toFixed(1);
      if (this.onSettingsChange) this.onSettingsChange({ tiltSensitivity: v });
    });

    this.el.invert.addEventListener('change', () => {
      if (this.onSettingsChange) this.onSettingsChange({ tiltInvert: this.el.invert.checked });
    });

    this.el.calib.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (this.onCalibrate) this.onCalibrate();
    });

    parent.appendChild(this.root);
  }

  _switchTab(tab) {
    this.root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    this.root.querySelectorAll('.tab-body').forEach((b) => b.classList.toggle('hidden', b.dataset.body !== tab));
  }

  _applyMode(mode) {
    this.el.modes.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    this.root.classList.toggle('mode-tilt', mode === 'motion');
  }

  setCameraMode(camMode) {
    for (const wrap of [this.el.camPickPlay, this.el.camPickSet]) {
      wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.cam === camMode));
    }
  }

  setMuted(muted) {
    this.el.audioBtn.textContent = muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
  }

  show({ isTouch, settings, isMuted = false }) {
    this.setMuted(isMuted);
    this.setCameraMode(settings.cameraMode || 'split');

    const mode = settings.controlMode || 'arrows';
    this._applyMode(mode);
    this.el.sens.value = settings.tiltSensitivity ?? 1.5;
    this.el.sensVal.textContent = Number(settings.tiltSensitivity ?? 1.5).toFixed(1);
    this.el.invert.checked = !!settings.tiltInvert;

    this.el.setHint.textContent = isTouch
      ? 'Tilt needs permission on iOS — tap CALIBRATE TILT SENSOR while holding phone level.'
      : 'Split Screen gives each player half the screen with its own camera.';

    this.el.hint.textContent = isTouch
      ? 'Tap START RACE to begin!'
      : 'P1: W A S D · P2: ↑ ← ↓ → · C camera · ENTER to start';

    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  dispose() {
    this.root.remove();
  }
}
