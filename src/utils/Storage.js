/**
 * Local-only storage for device identity, the username, local best,
 * audio settings, onboarding state, and controls preferences.
 */
const DEVICE_KEY = 'neon-highway:device-id';
const NAME_KEY = 'neon-highway:username';
const REG_KEY = 'neon-highway:registered';
const BEST_KEY = 'neon-highway:best';
const SETTINGS_KEY = 'neon-highway:settings';
const ONBOARD_KEY = 'neon-highway:onboarded';
const MUTED_KEY = 'neon-highway:muted';
const VOLUME_KEY = 'neon-highway:volume';

const DEFAULT_SETTINGS = { controlMode: 'arrows', tiltSensitivity: 1.5, tiltInvert: false, cameraMode: 'split' };

function uuid() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateDefaultName() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Racer_${num}`;
}

export const GameStorage = {
  _g(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } },
  _s(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  _gs(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : v; } catch { return fb; } },
  _ss(k, v) { try { localStorage.setItem(k, v); } catch {} },

  /** Stable unique id for this device (generated once, kept forever). */
  getDeviceId() {
    let id = this._gs(DEVICE_KEY);
    if (!id) { id = uuid(); this._ss(DEVICE_KEY, id); }
    return id;
  },

  getUserName() {
    let name = this._gs(NAME_KEY, '');
    if (!name) {
      name = generateDefaultName();
    }
    return name;
  },

  setUserName(name) {
    const trimmed = (name || '').trim() || generateDefaultName();
    this._ss(NAME_KEY, trimmed);
    this._ss(REG_KEY, '1');
    return trimmed;
  },

  isRegistered() { return this._gs(REG_KEY) === '1'; },

  /** Onboarding completion state */
  hasCompletedOnboarding() { return this._gs(ONBOARD_KEY) === '1'; },
  setOnboarded(completed = true) { this._ss(ONBOARD_KEY, completed ? '1' : '0'); },

  /** Audio preferences */
  isMuted() { return this._gs(MUTED_KEY) === '1'; },
  setMuted(muted) { this._ss(MUTED_KEY, muted ? '1' : '0'); },
  getVolume() { return this._g(VOLUME_KEY, 0.8); },
  setVolume(vol) { this._s(VOLUME_KEY, Math.max(0, Math.min(1, vol))); },

  /** Local best score storage. */
  getBest() {
    const b = this._g(BEST_KEY, null);
    if (b && typeof b.score === 'number') {
      return { score: b.score, distance: b.distance || 0, km: (b.distance || 0) / 1000, level: b.level || 1 };
    }
    return { score: 0, distance: 0, km: 0, level: 1 };
  },

  saveBest(rec) {
    const c = this.getBest();
    const score = Math.max(c.score, Math.floor(rec.score || 0));
    const distance = Math.max(c.distance, Math.round(rec.distance || 0));
    const level = Math.max(c.level, Math.round(rec.level || 1));
    this._s(BEST_KEY, { score, distance, level });
    return { score, distance, level };
  },

  getSettings() { return { ...DEFAULT_SETTINGS, ...this._g(SETTINGS_KEY, {}) }; },
  saveSettings(p) { const s = { ...this.getSettings(), ...p }; this._s(SETTINGS_KEY, s); return s; },
};
