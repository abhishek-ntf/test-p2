export class GameOver {
  constructor(parent = document.body, { onRestart, onMenu } = {}) {
    this.onRestart = onRestart; this.onMenu = onMenu;
    this.root = document.createElement('div');
    this.root.className = 'overlay hidden';
    this.root.innerHTML = `
      <div class="panel glass gameover-panel">
        <div class="go-header">
          <h1 class="title small go-title">GAME OVER</h1>
          <div class="winner-badge" data-k="winner">PLAYER 1 WINS!</div>
          <div class="go-duel-scores">
            <div class="duel-box p1" data-k="p1Box">
              <small>PLAYER 1</small>
              <b data-k="p1Score">0</b>
            </div>
            <div class="duel-box p2" data-k="p2Box">
              <small>PLAYER 2</small>
              <b data-k="p2Score">0</b>
            </div>
          </div>
        </div>
        <div class="go-footer">
          <div class="go-actions">
            <button type="button" class="btn" data-k="restart">RESTART</button>
            <button type="button" class="btn ghost" data-k="menu">MENU</button>
          </div>
          <p class="hint go-hint">ENTER / R to restart</p>
        </div>
      </div>`;
    this.el = {};
    this.root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });
    this.el.restart.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onRestart) this.onRestart(); });
    this.el.menu.addEventListener('click', (e) => { e.currentTarget.blur(); if (this.onMenu) this.onMenu(); });
    parent.appendChild(this.root);
  }

  show({ p1Score, p2Score }) {
    const s1 = Math.floor(p1Score || 0);
    const s2 = Math.floor(p2Score || 0);
    this.el.p1Score.textContent = s1.toLocaleString();
    this.el.p2Score.textContent = s2.toLocaleString();

    this.el.p1Box.classList.toggle('win', s1 > s2);
    this.el.p2Box.classList.toggle('win', s2 > s1);

    if (s1 > s2) {
      this.el.winner.textContent = '🏆 PLAYER 1 WINS!';
      this.el.winner.className = 'winner-badge p1';
    } else if (s2 > s1) {
      this.el.winner.textContent = '🏆 PLAYER 2 WINS!';
      this.el.winner.className = 'winner-badge p2';
    } else {
      this.el.winner.textContent = "🤝 IT'S A TIE!";
      this.el.winner.className = 'winner-badge tie';
    }

    this.root.classList.remove('hidden');
  }

  hide() { this.root.classList.add('hidden'); }
}
