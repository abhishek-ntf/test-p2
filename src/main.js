import './styles/style.css';
import { Game } from './game/Game.js';
import { PlaygamaBridge } from './utils/PlaygamaBridge.js';

let game = null;

async function bootstrap() {
  const canvas = document.getElementById('game');

  // 1. Initialize official Playgama Bridge SDK before starting the game
  try {
    await PlaygamaBridge.initialize();
  } catch (err) {
    console.error('[Playgama] Bridge initialization error:', err);
  }

  // 2. Start the Three.js game
  game = new Game(canvas);
  game.run();

  // 3. Send mandatory game_ready signal once the game is rendered and playable
  requestAnimationFrame(() => {
    PlaygamaBridge.sendGameReady();
  });
}

bootstrap();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (game) game.dispose();
  });
}
