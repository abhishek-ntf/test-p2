/**
 * In-game HUD:
 * Displays ONLY both players' scores (plus minimal utility icon buttons).
 */
export class GameHUD {
  constructor(parent = document.body, { onPause, onTheme, onToggleMute, onToggleFullscreen } = {}) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="hud-col hud-left">
        <div class="p-score-card p1" data-k="p1Card">
          <small>PLAYER 1</small>
          <b data-k="p1Score">0</b>
        </div>
      </div>

      <div class="hud-col hud-center">
        <div class="btns">
          <button type="button" data-k="audio" title="Mute / Unmute [M]" aria-label="Mute / Unmute">🔊</button>
          <button type="button" data-k="fs" title="Toggle Fullscreen [F]" aria-label="Fullscreen">⛶</button>
          <button type="button" data-k="theme" title="Day / Night" aria-label="Day / night">☾</button>
          <button type="button" data-k="pause" title="Pause Game [P]" aria-label="Pause">❚❚</button>
        </div>
      </div>

      <div class="hud-col hud-right">
        <div class="p-score-card p2" data-k="p2Card">
          <small>PLAYER 2</small>
          <b data-k="p2Score">0</b>
        </div>
      </div>

      <div class="flash" data-k="flash"></div>
      <div class="banner" data-k="banner"></div>
    `;

    this.el = {};
    this.root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });
    this._c = {};

    const wire = (btn, fn) => btn.addEventListener('click', (e) => { e.currentTarget.blur(); if (fn) fn(); });
    wire(this.el.pause, onPause);
    wire(this.el.theme, onTheme);
    wire(this.el.audio, onToggleMute);
    wire(this.el.fs, onToggleFullscreen);

    parent.appendChild(this.root);
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  _txt(k, v) { if (this._c[k] !== v) { this._c[k] = v; this.el[k].textContent = v; } }

  setScores(p1Score, p2Score) {
    this._txt('p1Score', Math.floor(p1Score).toLocaleString());
    this._txt('p2Score', Math.floor(p2Score).toLocaleString());
  }

  setEliminated(playerId, out) {
    const card = playerId === 1 ? this.el.p1Card : this.el.p2Card;
    if (card) card.classList.toggle('out', out);
  }

  setMuted(muted) {
    this.el.audio.textContent = muted ? '🔇' : '🔊';
  }

  setFullscreen(isFs) {
    this.el.fs.textContent = isFs ? '🗗' : '⛶';
  }

  banner(text, kind = 'good') {
    const b = this.el.banner;
    b.textContent = text; b.className = `banner ${kind}`;
    void b.offsetWidth; b.classList.add('show');
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }

  dispose() {
    this.root.remove();
  }
}
