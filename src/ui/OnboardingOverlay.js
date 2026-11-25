import { GameStorage } from '../utils/Storage.js';

export class OnboardingOverlay {
  constructor(parent = document.body, { onComplete, isTouch = false } = {}) {
    this.parent = parent;
    this.onComplete = onComplete;
    this.isTouch = isTouch;
    this.active = false;
    this.currentStep = 0; // 0: steer, 1: speed, 2: nitro, 3: done
    this.stepProgress = { steer: false, accel: false, brake: false, nitro: false };

    this.root = document.createElement('div');
    this.root.id = 'onboarding-overlay';
    this.root.className = 'onboarding-overlay hidden';

    this.root.innerHTML = `
      <div class="onboard-card glass">
        <div class="onboard-top">
          <span class="onboard-badge">TUTORIAL</span>
          <button type="button" class="onboard-skip-btn" data-k="skip">SKIP ⏭</button>
        </div>

        <div class="onboard-instruction">
          <h2 class="onboard-title" data-k="title">STEER YOUR CAR</h2>
          <p class="onboard-sub" data-k="sub">Use Left / Right keys to switch lanes and dodge cars</p>
        </div>

        <!-- Desktop visual keyboard overlay -->
        <div class="kb-diagram" data-k="kbDiagram">
          <div class="kb-row">
            <div class="key-cap" data-act="accel">
              <span class="key-main">W</span>
              <span class="key-alt">Z / ↑</span>
              <span class="key-label">GAS</span>
            </div>
          </div>
          <div class="kb-row">
            <div class="key-cap" data-act="left">
              <span class="key-main">A</span>
              <span class="key-alt">Q / ←</span>
              <span class="key-label">LEFT</span>
            </div>
            <div class="key-cap" data-act="brake">
              <span class="key-main">S</span>
              <span class="key-alt">↓</span>
              <span class="key-label">BRAKE</span>
            </div>
            <div class="key-cap" data-act="right">
              <span class="key-main">D</span>
              <span class="key-alt">→</span>
              <span class="key-label">RIGHT</span>
            </div>
          </div>
          <div class="kb-row space-row">
            <div class="key-cap space-cap" data-act="nitro">
              <span class="key-main">SPACEBAR</span>
              <span class="key-label">⚡ NITRO BOOST</span>
            </div>
          </div>
          <div class="kb-shortcuts">
            <span><b>[P]</b> PAUSE</span> · <span><b>[H]</b> HORN</span> · <span><b>[M]</b> MUTE</span>
          </div>
        </div>

        <!-- Mobile touch gesture prompts -->
        <div class="touch-diagram hidden" data-k="touchDiagram">
          <div class="touch-prompts">
            <div class="touch-box" data-act="left">
              <div class="touch-icon">◀</div>
              <span>STEER LEFT</span>
            </div>
            <div class="touch-box" data-act="right">
              <div class="touch-icon">▶</div>
              <span>STEER RIGHT</span>
            </div>
            <div class="touch-box" data-act="accel">
              <div class="touch-icon">▲</div>
              <span>GAS</span>
            </div>
            <div class="touch-box" data-act="nitro">
              <div class="touch-icon">⚡</div>
              <span>BOOST</span>
            </div>
          </div>
        </div>

        <div class="onboard-dots">
          <span class="dot active" data-step="0"></span>
          <span class="dot" data-step="1"></span>
          <span class="dot" data-step="2"></span>
        </div>
      </div>
    `;

    this.el = {};
    this.root.querySelectorAll('[data-k]').forEach((n) => { this.el[n.dataset.k] = n; });
    this.caps = this.root.querySelectorAll('[data-act]');
    this.dots = this.root.querySelectorAll('.dot');

    this.el.skip.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.finish(true);
    });

    parent.appendChild(this.root);
  }

  setTouch(isTouch) {
    this.isTouch = isTouch;
    this.el.kbDiagram.classList.toggle('hidden', isTouch);
    this.el.touchDiagram.classList.toggle('hidden', !isTouch);
  }

  start() {
    this.active = true;
    this.currentStep = 0;
    this.stepProgress = { steer: false, accel: false, brake: false, nitro: false };
    this.setTouch(this.isTouch);
    this._renderStep();
    this.root.classList.remove('hidden');
  }

  handleAction(action, isDown) {
    // Light up key cap
    this.caps.forEach((cap) => {
      if (cap.dataset.act === action) {
        cap.classList.toggle('pressed', isDown);
      }
    });

    if (!this.active || !isDown) return;

    if (this.currentStep === 0) {
      if (action === 'left' || action === 'right') {
        this.stepProgress.steer = true;
        this._nextStep();
      }
    } else if (this.currentStep === 1) {
      if (action === 'accel' || action === 'brake') {
        this.stepProgress.accel = true;
        this._nextStep();
      }
    } else if (this.currentStep === 2) {
      if (action === 'nitro') {
        this.stepProgress.nitro = true;
        this._nextStep();
      }
    }
  }

  _nextStep() {
    this.currentStep++;
    if (this.currentStep > 2) {
      this._showSuccess();
    } else {
      this._renderStep();
    }
  }

  _renderStep() {
    this.dots.forEach((d, i) => d.classList.toggle('active', i === this.currentStep));
    this.caps.forEach((cap) => cap.classList.remove('pulse'));

    if (this.currentStep === 0) {
      this.el.title.textContent = '1. STEER YOUR CAR';
      this.el.sub.textContent = this.isTouch
        ? 'Tap the left and right arrows to dodge oncoming traffic'
        : 'Press [A] [D] or [←] [→] (or [Q] [D] on AZERTY) to change lanes';
      this._pulseCaps(['left', 'right']);
    } else if (this.currentStep === 1) {
      this.el.title.textContent = '2. GAS & BRAKE';
      this.el.sub.textContent = this.isTouch
        ? 'Hold GAS to speed up, or tap BRAKE to slow down'
        : 'Hold [W] or [↑] (or [Z] on AZERTY) to accelerate, [S] or [↓] to brake';
      this._pulseCaps(['accel', 'brake']);
    } else if (this.currentStep === 2) {
      this.el.title.textContent = '3. HIT NITRO BOOST';
      this.el.sub.textContent = this.isTouch
        ? 'Tap BOOST for maximum supersonic speed!'
        : 'Press [SPACEBAR] to unleash nitro boost and blaze past rivals!';
      this._pulseCaps(['nitro']);
    }
  }

  _pulseCaps(actions) {
    this.caps.forEach((cap) => {
      if (actions.includes(cap.dataset.act)) {
        cap.classList.add('pulse');
      }
    });
  }

  _showSuccess() {
    this.el.title.textContent = 'GREAT JOB!';
    this.el.sub.textContent = 'Dodge traffic across 4 lanes and outscore your rival!';
    this.dots.forEach((d) => d.classList.add('active'));
    setTimeout(() => {
      this.finish(false);
    }, 1200);
  }

  finish(skipped = false) {
    if (!this.active) return;
    this.active = false;
    GameStorage.setOnboarded(true);
    this.root.classList.add('hidden');
    if (this.onComplete) this.onComplete(skipped);
  }

  hide() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  dispose() {
    this.root.remove();
  }
}
