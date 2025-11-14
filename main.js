// Rescue Riders — FIXED: no crop + starts after nick

const GAME_WIDTH = 1280, GAME_HEIGHT = 720;
const MainScene = { key: 'main', preload, create, update, init };

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  audio: { noAudio: false, disableWebAudio: false },
  scene: [MainScene]
};

let game = null;
window.startRescueRiders = function() {
  if (game) return;
  game = new Phaser.Game(config);
  game.scene.start('main', { isIntro: true });
};

// Resize listeners
const resize = () => { if (game && game.scale) game.scale.refresh(); };
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));

/* === Helpers (bez zmien) === */
function ensureAudio(scene) {
  if (ensureAudio._done) return;
  const resume = () => {
    try { scene.sound.unlock(); } catch(e){}
    try { const ctx = scene.sound.context; if (ctx && ctx.state !== 'running') ctx.resume(); } catch(e){}
    ensureAudio._done = true;
  };
  ['pointerdown','touchstart','click','keydown'].forEach(ev => {
    document.addEventListener(ev, resume, {once: true});
  });
  scene.input.once('pointerdown', resume);
  scene.input.keyboard.once('keydown', resume);
}
function playLoop(scene, key, cfg) { ensureAudio(scene); try { scene.sound.play(key, cfg); } catch(e) {} }
function hardReset(sceneCtx) {
  try { sceneCtx.sound.stopAll(); if (sceneCtx.jetskiSound) sceneCtx.jetskiSound.stop(); } catch(e) {}
  setTimeout(() => { try { game.destroy(true); } catch(e) {}; game = null; window.startRescueRiders(); }, 40);
}

/* === Data (bez zmien) === */
const MISSIONS = [
  { rescued:10, caught:3,  time:60, swimmerDelay:1500, crookDelay:7000 },
  { rescued:12, caught:5,  time:55, swimmerDelay:1400, crookDelay:6000 },
  { rescued:15, caught:8,  time:50, swimmerDelay:1200, crookDelay:4000 },
  { rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
  { rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];

/* === Scene === */
function init(d) { 
  this.currentMission = d?.currentMission ?? 0; 
  this.isIntro = d?.isIntro ?? false; 
}

function preload() {
  this.load.image('hero16', 'assets/hero_screen_1280x720.png');
  this.load.image('fail16', 'assets/fail_1280x720.png');
  for (let i = 1; i <= 5; i++) this.load.image(`reward16_${i}`, `assets/reward${i}_1280x720.png`);

  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
   'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
   'swimmer_m','swimmer_f','crook','
