/**
 * Official Playgama Bridge SDK wrapper.
 * Handles SDK initialization, lifecycle messages (game_ready, gameplay_started, gameplay_stopped),
 * interstitial advertisements, and safe local development fallbacks.
 */
export class PlaygamaBridge {
  static isInitialized = false;
  static initPromise = null;
  static listeners = new Map();

  /**
   * Initializes the official Playgama Bridge SDK.
   * Returns a promise that always resolves (never throws) so game startup is never blocked.
   */
  static async initialize() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise(async (resolve) => {
      // 1. If an initialization promise was already started in index.html, await it
      if (typeof window !== 'undefined' && window.bridgeInitPromise) {
        try {
          const res = await window.bridgeInitPromise;
          this.isInitialized = !!res;
          this._setupListeners();
          resolve(res);
          return;
        } catch (err) {
          console.error('[Playgama Bridge] Initialization promise error:', err);
          this.isInitialized = false;
          resolve(null);
          return;
        }
      }

      // 2. Otherwise, check if window.bridge is available
      const tryInit = async () => {
        if (typeof window !== 'undefined' && typeof window.bridge !== 'undefined') {
          if (typeof window.bridge.initialize === 'function') {
            try {
              console.log('[Playgama Bridge] Initializing bridge.initialize()...');
              await window.bridge.initialize();
              console.log('[Playgama Bridge] Initialized successfully!');
              this.isInitialized = true;
              this._setupListeners();
              resolve(window.bridge);
              return true;
            } catch (err) {
              console.error('[Playgama Bridge] bridge.initialize() failed:', err);
              this.isInitialized = false;
              resolve(null);
              return true;
            }
          }
        }
        return false;
      };

      if (await tryInit()) return;

      // 3. If bridge script is still loading, wait up to 2 seconds
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts++;
        if (await tryInit()) {
          clearInterval(timer);
        } else if (attempts >= 20) {
          clearInterval(timer);
          console.warn('[Playgama Bridge] SDK not found on window (standalone / local dev mode).');
          this.isInitialized = false;
          resolve(null);
        }
      }, 100);
    });

    return this.initPromise;
  }

  static _setupListeners() {
    if (!this.isInitialized || !window.bridge) return;

    // Listen to interstitial state changes to coordinate audio/game pause
    try {
      if (window.bridge.advertisement && typeof window.bridge.advertisement.on === 'function') {
        window.bridge.advertisement.on('interstitial_state_changed', (state) => {
          console.log('[Playgama Bridge] Interstitial state:', state);
          this._emit('interstitial_state_changed', state);
        });
      }
    } catch (e) {
      console.warn('[Playgama Bridge] Could not attach ad listeners:', e);
    }
  }

  static on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  static off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  static _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try { cb(data); } catch (err) { console.error(err); }
      });
    }
  }

  /**
   * Sends platform lifecycle messages:
   * - 'game_ready': Sent when the first playable screen is ready and rendered.
   * - 'gameplay_started': Sent when a race starts.
   * - 'gameplay_stopped': Sent when race pauses or game over.
   */
  static sendMessage(message, options) {
    if (!this.isInitialized || !window.bridge) return;

    try {
      if (window.bridge.platform && typeof window.bridge.platform.sendMessage === 'function') {
        window.bridge.platform.sendMessage(message, options);
        console.log(`[Playgama Bridge] Sent message: ${message}`);
      }
    } catch (err) {
      console.warn(`[Playgama Bridge] Error sending message '${message}':`, err);
    }
  }

  static sendGameReady() {
    this.sendMessage('game_ready');
  }

  static sendGameplayStarted() {
    this.sendMessage('gameplay_started');
  }

  static sendGameplayStopped() {
    this.sendMessage('gameplay_stopped');
  }

  /**
   * Request an interstitial advertisement during natural game breaks.
   * Playgama Bridge v2 showInterstitial() takes no placement argument —
   * calling it with an unrecognised string ('game_over') silently fails on some adapters.
   */
  static showInterstitial() {
    if (!this.isInitialized || !window.bridge) return;

    try {
      const ad = window.bridge.advertisement;
      if (ad && ad.isInterstitialSupported && typeof ad.showInterstitial === 'function') {
        ad.showInterstitial();
      }
    } catch (err) {
      console.warn('[Playgama Bridge] showInterstitial error:', err);
    }
  }

  /**
   * Returns player name from the platform if available.
   */
  static getPlayerName() {
    try {
      if (this.isInitialized && window.bridge?.player?.name) {
        return window.bridge.player.name;
      }
    } catch {}
    return null;
  }
}
