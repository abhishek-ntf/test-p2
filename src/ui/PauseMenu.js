export class PauseMenu {
  constructor(parent = document.body, { onResume, onRestart, onMenu, onToggleMute, onToggleFullscreen, onToggleCamera } = {}) {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onMenu = onMenu;
    this.onToggleMute = onToggleMute;
    this.onToggleFullscreen = onToggleFullscreen;
    this.onToggleCamera = onToggleCamera;

    this.root = document.createElement('div');
    this.root.id = 'pause-overlay';
    this.root.className = 'overlay hidden';
    this.root.innerHTML = `
      <div class="panel glass pause-panel">
        <h1 class="title small">PAUSED</h1>
        <p class="sub">Game paused · Take a breath</p>

        <div class="pause-actions">
          <button type="button" class="btn" data-k="resume">RESUME RACE</button>
          <button type="button" class="btn ghost" data-k="restart">RESTART</button>
          <div class="pause-row-btns">
            <button type="button" class="btn small" data-k="audio">🔊 SOUND: ON</button>
            <button type="button" class="btn small" data-k="fs">⛶ FULLSCREEN</button>
          </div>
          <button type="button" class="btn small ghost" data-k="cam">◫ CAMERA: SPLIT SCREEN</button>
          <button type="button" class="btn small ghost danger" data-k="menu">MAIN MENU</button>
        </div>

        <div class="pause-shortcuts">
          <div><kbd>W A S D</kbd> Player 1</div>
          <div><kbd>↑ ← ↓ →</kbd> Player 2</div>
          <div><kbd>C</kbd> Camera · <kbd>P</kbd> Pause</div>
        </div>
      </div>
    `;

    this.el = {};
    this.root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });

    this.el.resume.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onResume) this.onResume(); });
    this.el.restart.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onRestart) this.onRestart(); });
    this.el.menu.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onMenu) this.onMenu(); });
    this.el.audio.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onToggleMute) this.onToggleMute(); });
    this.el.fs.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onToggleFullscreen) this.onToggleFullscreen(); });
    this.el.cam.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onToggleCamera) this.onToggleCamera(); });

    parent.appendChild(this.root);
  }

  setCameraMode(mode) {
    this.el.cam.textContent = mode === 'split' ? '◫ CAMERA: SPLIT SCREEN' : '▢ CAMERA: SHARED';
  }

  setMuted(muted) {
    this.el.audio.textContent = muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
  }

  show(isMuted = false, camMode = 'split') {
    this.setMuted(isMuted);
    this.setCameraMode(camMode);
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  dispose() {
    this.root.remove();
  }
}
