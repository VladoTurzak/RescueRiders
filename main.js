// Rescue Riders — FIXED scaling + joystick

const GAME_WIDTH = 1280, GAME_HEIGHT = 720;
const MainScene = { key:'main', preload, create, update, init };

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    addAsGameObject: false  // Joystick mimo Phaser stacking
  },
  physics: { default:'arcade', arcade:{ debug:false } },
  audio: { noAudio:false, disableWebAudio:false },
  scene: [MainScene]
};

let game = null;
window.startRescueRiders = function(){
  if (game) return;
  game = new Phaser.Game(config);
  game.scene.start('main', { isIntro:true });

  // Resize + orientation (mobil otočenie)
  const resize = () => { if (game && game.scale) game.scale.refresh(); };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
};

/* === Helpers (rovnaké) === */
function ensureAudio(scene) {
  if (ensureAudio._done) return;
  const resume = () => {
    try { scene.sound.unlock(); } catch(e){}
    try { const ctx = scene.sound.context; if (ctx && ctx.state !== 'running') ctx.resume(); } catch(e){}
    ensureAudio._done = true;
  };
  ['pointerdown','touchstart','click','keydown'].forEach(ev=>{
    document.addEventListener(ev,resume,{once:true});
  });
  scene.input.once('pointerdown',resume);
  scene.input.keyboard.once('keydown',resume);
}
function playLoop(scene,key,cfg){ ensureAudio(scene); try{ scene.sound.play(key,cfg); }catch(e){} }
function hardReset(sceneCtx){
  try{ sceneCtx.sound.stopAll(); if(sceneCtx.jetskiSound) sceneCtx.jetskiSound.stop(); }catch(e){}
  setTimeout(()=>{ try{game.destroy(true);}catch(e){}; game=null; window.startRescueRiders(); },40);
}

/* === Data (rovnaké) === */
const MISSIONS = [
  { rescued:10, caught:3,  time:60, swimmerDelay:1500, crookDelay:7000 },
  { rescued:12, caught:5,  time:55, swimmerDelay:1400, crookDelay:6000 },
  { rescued:15, caught:8,  time:50, swimmerDelay:1200, crookDelay:4000 },
  { rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
  { rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];

/* === Scene (rovnaké ako predtým – žiadne zmeny v logike) === */
function init(d){ this.currentMission = d?.currentMission ?? 0; this.isIntro = d?.isIntro ?? false; }

function preload(){
  this.load.image('hero16', 'assets/hero_screen_1280x720.png');
  this.load.image('fail16', 'assets/fail_1280x720.png');
  for (let i=1;i<=5;i++) this.load.image(`reward16_${i}`, `assets/reward${i}_1280x720.png`);

  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
   'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
   'swimmer_m','swimmer_f','crook','crook_left','splash',
   'shark','shark_right'
  ].forEach(k=>this.load.image(k,`assets/${k}.png`));

  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete',
   'jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'
  ].forEach(a=>{
    const ext = a.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(a, `assets/audio/${a}.${ext}`);
  });
}

function create(){
  ensureAudio(this);

  this.keys = this.input.keyboard.addKeys({
    space:Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter:Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc:Phaser.Input.Keyboard.KeyCodes.ESC,
    r:Phaser.Input.Keyboard.KeyCodes.R
  });

  if (this.isIntro){
    const bg = document.getElementById('bg-cover');
    if (bg) bg.src = 'assets/hero_screen_1280x720.png';

    const hero = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'hero16').setOrigin(0.5);
    const scale = Math.min(GAME_WIDTH/hero.width, GAME_HEIGHT/hero.height); hero.setScale(scale);

    const press = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-60,
      'Press SPACE / ENTER or CLICK to start',
      {fontSize:'26px', color:'#fff', backgroundColor:'#000'}).setOrigin(0.5);
    this.tweens.add({targets:press, alpha:0.2, yoyo:true, repeat:-1, duration:800});

    this.sound.stopAll(); playLoop(this,'intro_theme',{loop:true,volume:0.7});
    const start=()=>this.scene.restart({currentMission:0, isIntro:false});
    this.input.keyboard.once('keydown-SPACE',start);
    this.input.keyboard.once('keydown-ENTER',start);
    this.input.once('pointerdown',start);
    return;
  }

  // Mission (rovnaké)
  this.sound.stopAll(); playLoop(this,'mission_theme',{loop:true,volume:0.7});

  const bg = document.getElementById('bg-cover');
  if(bg) bg.src = `assets/bg${this.currentMission+1}_1280x720.png`;

  this.jetskiSound = this.sound.add('jetski_loop', { loop:true, volume:0 });
  try{ this.jetskiSound
