// Rescue Riders — FINAL v5: Žiadne orezanie (aj s prikazovým riadkom) + spustenie po nicku

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

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
  scene: { key: 'main', preload, create, update, init }
};

let game = null;

// KLÚČOVÁ FUNKCIA: Dynamický resize pre mobil/desktop s prikazovým riadkom
function resizeGame() {
  if (!game || !game.scale) return;

  const wrapper = document.getElementById('phaser-wrapper');
  if (!wrapper) return;

  // Používame visualViewport (mobil s address bar) alebo innerHeight
  const height = window.visualViewport?.height || window.innerHeight;
  const width = window.visualViewport?.width || window.innerWidth;

  wrapper.style.height = height + 'px';
  wrapper.style.width = width + 'px';

  // Phaser FIT automaticky prispôsobí canvas
  game.scale.refresh();
}

// Spustenie hry – volá sa z index.html po nicku
window.startRescueRiders = function () {
  if (game) return;

  game = new Phaser.Game(config);

  // Počkáme, kým sa canvas vytvorí a potom refreshneme
  setTimeout(() => {
    game.scene.start('main', { isIntro: true });
    resizeGame(); // Prvý resize
  }, 300);
};

// Resize listener – reaguje na address bar, otáčanie, DevTools
window.addEventListener('resize', () => {
  clearTimeout(window.resizeTimeout);
  window.resizeTimeout = setTimeout(resizeGame, 100); // debounce
});
window.addEventListener('orientationchange', () => {
  setTimeout(resizeGame, 200);
});

// visualViewport (Chrome mobile address bar)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeGame);
}

/* === Zvyšok hry (bez zmien – funguje ako predtým) === */
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
   'swimmer_m','swimmer_f','crook','crook_left','splash',
   'shark','shark_right'
  ].forEach(k => this.load.image(k, `assets/${k}.png`));

  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete',
   'jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'
  ].forEach(a => {
    const ext = a.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(a, `assets/audio/${a}.${ext}`);
  });
}

function create() {
  ensureAudio(this);
  resizeGame(); // Dôležité: refresh aj v create()

  this.keys = this.input.keyboard.addKeys({
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    r: Phaser.Input.Keyboard.KeyCodes.R
  });

  if (this.isIntro) {
    const bg = document.getElementById('bg-cover');
    if (bg) bg.src = 'assets/hero_screen_1280x720.png';

    const hero = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'hero16').setOrigin(0.5);
    const scale = Math.min(GAME_WIDTH/hero.width, GAME_HEIGHT/hero.height);
    hero.setScale(scale);

    const press = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-60,
      'Press SPACE / ENTER or CLICK to start',
      {fontSize:'26px', color:'#fff', backgroundColor:'#000'}).setOrigin(0.5);
    this.tweens.add({targets:press, alpha:0.2, yoyo:true, repeat:-1, duration:800});

    this.sound.stopAll();
    playLoop(this, 'intro_theme', {loop:true, volume:0.7});

    const start = () => this.scene.restart({currentMission:0, isIntro:false});
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);
    return;
  }

  // === Normálna hra (zvyšok kódu je rovnaký ako predtým) ===
  this.sound.stopAll();
  playLoop(this, 'mission_theme', {loop:true, volume:0.7});

  const bg = document.getElementById('bg-cover');
  if (bg) bg.src = `assets/bg${this.currentMission+1}_1280x720.png`;

  this.jetskiSound = this.sound.add('jetski_loop', { loop: true, volume: 0 });
  try { this.jetskiSound.play(); } catch(e) {}

  this.isFemale = Math.random() > 0.5;
  const tex = this.isFemale ? 'jetski_f' : 'jetski_m';
  this.player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT/2, tex)
    .setCollideWorldBounds(false).setSize(100,100);

  this.cursors = this.input.keyboard.createCursorKeys();

  const m = MISSIONS[this.currentMission];
  this.swimmers = this.physics.add.group();
  this.crooks = this.physics.add.group();
  this.time.addEvent({delay: m.swimmerDelay, callback: spawnSwimmer, callbackScope: this, loop: true});
  this.time.addEvent({delay: m.crookDelay, callback: spawnCrook, callbackScope: this, loop: true});

  if (this.currentMission >= 3) {
    this.sharks = this.physics.add.group();
    this.time.addEvent({delay: 6000, callback: () => spawnShark.call(this, 'right'), loop: true});
    if (this.currentMission >= 4)
      this.time.addEvent({delay: 7000, callback: () => spawnShark.call(this, 'left'), loop: true});
    this.physics.add.overlap(this.player, this.sharks, hitShark, null, this);
  }
  this.physics.add.overlap(this.player, this.swimmers, rescueSwimmer, null, this);
  this.physics.add.collider(this.player, this.crooks, catchCrook, null, this);

  const txt = {fontSize:'22px', color:'#fff', fontStyle:'bold', fontFamily:'Arial',
               shadow:{offsetX:1, offsetY:1, color:'#000', blur:3}};
  this.missionLabel = this.add.text(30, 22, `MISSION ${this.currentMission+1}`, txt);
  this.scoreLabel = this.add.text(GAME_WIDTH/2-60, 22, `SCORE 0`, txt);
  this.timerLabel = this.add.text(GAME_WIDTH-150, 22, `${m.time}s`, txt);
  this.goalLabel = this.add.text(25, 65, `Rescue ${m.rescued} + Catch ${m.caught}`,
    {fontSize:'18px', color:'#003366', fontStyle:'bold', fontFamily:'Arial'});

  this.timeLeft = m.time;
  this.timerEvent = this.time.addEvent({
    delay: 1000, loop: true, callback: () => {
      this.timeLeft--;
      this.timerLabel.setText(`${this.timeLeft}s`);
      if (this.timeLeft <= 0) failMission.call(this);
    }
  });

  this.score = 0; this.rescued = 0; this.caught = 0;

  const onHard = (e) => { if (!e.repeat) hardReset(this); };
  this.keys.r.on('down', onHard);
  this.keys.esc.on('down', onHard);
}

function update() {
  if (!this.player || !this.cursors) return;

  const moving = this.cursors.left.isDown || this.cursors.right.isDown ||
                 this.cursors.up.isDown || this.cursors.down.isDown;

  if (this.jetskiSound) {
    const target = moving ? 0.55 : 0.0;
    this.jetskiSound.volume += (target - this.jetskiSound.volume) * 0.08;
  }

  let vx = 0, vy = 0;
  if (this.cursors.left.isDown) { vx = -260; this.player.setTexture(this.isFemale ? 'jetski_f_left' : 'jetski_m_left'); }
  else if (this.cursors.right.isDown) { vx = 260; this.player.setTexture(this.isFemale ? 'jetski_f' : 'jetski_m'); }
  if (this.cursors.up.isDown) { vy = -260; this.player.setTexture(this.isFemale ? 'jetski_f_up' : 'jetski_m_up'); }
  else if (this.cursors.down.isDown) { vy = 260; this.player.setTexture(this.isFemale ? 'jetski_f_down' : 'jetski_m_down'); }

  this.player.setVelocity(vx, vy);

  const hw = this.player.displayWidth/2, hh = this.player.displayHeight/2;
  this.player.x = Phaser.Math.Clamp(this.player.x, hw, GAME_WIDTH - hw);
  this.player.y = Phaser.Math.Clamp(this.player.y, hh, GAME_HEIGHT - hh);
}

/* === Všetky ostatné funkcie (spawnSwimmer, rescueSwimmer, missionComplete, atď.) – ZOSTÁVAJÚ ROVNAKÉ === */
// (skopíruj ich z tvojho pôvodného main.js – žiadne zmeny potrebné)

/* === Data === */
const MISSIONS = [
  { rescued:10, caught:3,  time:60, swimmerDelay:1500, crookDelay:7000 },
  { rescued:12, caught:5,  time:55, swimmerDelay:1400, crookDelay:6000 },
  { rescued:15, caught:8,  time:50, swimmerDelay:1200, crookDelay:4000 },
  { rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
  { rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];

/* === Helpers === */
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

// === Tu vlož všetky ostatné funkcie (spawnSwimmer, rescueSwimmer, atď.) z tvojho pôvodného main.js ===
