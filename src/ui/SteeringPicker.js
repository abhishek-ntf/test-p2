/**
 * SteeringPicker — bottom-sheet mode selector.
 * Shown on first mobile launch and when the user taps the floating STEER button.
 *
 * Modes (2 options — touch/button only):
 *   arrows  – left/right arrow buttons (always works)
 *   wheel   – virtual steering wheel drag
 */

const MODES = [
  {
    id: 'arrows',
    icon: `<svg viewBox="0 0 60 30" fill="none">
      <circle cx="12" cy="15" r="12" fill="rgba(30,70,160,.85)"
        stroke="#4fa3ff" stroke-width="2"/>
      <polyline points="16,9 10,15 16,21" stroke="white" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="48" cy="15" r="12" fill="rgba(30,70,160,.85)"
        stroke="#4fa3ff" stroke-width="2"/>
      <polyline points="44,9 50,15 44,21" stroke="white" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    title: 'ARROWS',
    desc: 'Tap & hold the ‹ › buttons on-screen to steer',
  },
  {
    id: 'wheel',
    icon: `<svg viewBox="0 0 50 50" fill="none">
      <circle cx="25" cy="25" r="22" fill="rgba(0,0,0,.3)"
        stroke="#4fa3ff" stroke-width="2.5"/>
      <circle cx="25" cy="25" r="6" fill="#4fa3ff"/>
      <line x1="25" y1="25" x2="25" y2="5"
        stroke="#4fa3ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="25" y1="25" x2="6" y2="36"
        stroke="#4fa3ff" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="25" y1="25" x2="44" y2="36"
        stroke="#4fa3ff" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    title: 'WHEEL',
    desc: 'Drag the virtual steering wheel on the left side',
  },
];

export class SteeringPicker {
  constructor(parent = document.body, { onSelect, onClose } = {}) {
    this.onSelect = onSelect;
    this.onClose  = onClose;

    this.root = document.createElement('div');
    this.root.id = 'steering-picker';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="sp-backdrop"></div>
      <div class="sp-sheet">
        <div class="sp-handle"></div>
        <h2 class="sp-title">CHOOSE STEERING</h2>
        <p class="sp-sub">Select how you want to control your car</p>
        <div class="sp-cards">
          ${MODES.map((m) => `
            <button type="button" class="sp-card" data-mode="${m.id}">
              <div class="sp-icon">${m.icon}</div>
              <div class="sp-info">
                <span class="sp-name">${m.title}</span>
                <span class="sp-desc">${m.desc}</span>
              </div>
              <span class="sp-check">✓</span>
            </button>`).join('')}
        </div>
        <button type="button" class="btn sp-confirm" data-k="confirm">CONFIRM</button>
      </div>`;

    this._selected = null;
    this._cards    = [];

    this.root.querySelectorAll('.sp-card').forEach((card) => {
      this._cards.push(card);
      card.addEventListener('click', () => this._pick(card.dataset.mode));
    });

    this.root.querySelector('[data-k="confirm"]')
      .addEventListener('click', () => this._confirm());

    this.root.querySelector('.sp-backdrop')
      .addEventListener('click', () => this.hide());

    parent.appendChild(this.root);
  }

  show(current) {
    // Map legacy mode names
    const c = (current === 'gesture' || current === 'tilt') ? 'motion' : (current || 'arrows');
    this._pick(c);
    this.root.classList.remove('hidden');
    requestAnimationFrame(() => this.root.classList.add('open'));
  }

  hide() {
    this.root.classList.remove('open');
    setTimeout(() => this.root.classList.add('hidden'), 310);
    if (this.onClose) this.onClose();
  }

  _pick(mode) {
    this._selected = mode;
    this._cards.forEach((c) => c.classList.toggle('active', c.dataset.mode === mode));
  }

  _confirm() {
    if (this._selected && this.onSelect) this.onSelect(this._selected);
    this.hide();
  }

  dispose() { this.root.remove(); }
}
