// Rescue Riders — Stable fullscreen BG (CSS cover) + world 900x600 + audio unlock + smaller joystick
const GAME_WIDTH = 900, GAME_HEIGHT = 600;
const MainScene = { key: 'main', preload, create, update, init };

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,           // logický svet
  height: GAME_HEIGHT,
  backgroundColor: 0x000000,   // nevidno, lebo pod tým je vždy fullscreen BG cez body
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: {
    mode: Phaser.Scale.FIT,    // celé pole vždy viditeľné
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: { powerPreference: 'high-performance', antialias: true, roundPixels: true },
  resolution: 1,
  fps: { target: 60, forceSetTimeOut: true },
  scene: [MainScene]
};

let game = new Phaser.Game(config);
game.scene.start('main', { isIntro: true });

// ---------- Helpers ----------
function setBodyBG(url) {
  // fullscreen obrázky (intro, bg1-5, reward, fail) vykreslíme ako pozadie stránky bez deformácie
  document.body.style.backgroundImage = url ? `url("${url}")` : '';
}

function hardReset(sceneCtx) {
  try { sceneCtx.sound.stopAll(); sceneCtx.engineSfx?.stop(); } catch(e){}
  setBodyBG('assets/hero_screen.png');  // po resete ukáž intro BG
  setTimeout(() => {
    try { game.destroy(true); } catch(e){}
    game = new Phaser.Game(config);
    game.scene.start('main', { isIntro: true });
  }, 30);
}

function audioUnlock(scene) {
  if (scene.__audioUnlocked) return;
  const unlock = async () => {
    try {
      if (scene.sound?.context?.state === 'suspended') await scene.sound.context.resume();
      scene.__audioUnlocked = true;
    } catch(e){}
    scene.input.off('pointerdown', unlock);
    scene.input.keyboard?.off('keydown', unlock);
  };
  scene.input.on('pointerdown', unlock);
  scene.input.keyboard?.on('keydown', unlock);
}

// ---------- Missions ----------
const MISSIONS = [
  { rescued: 10, caught: 3,  time: 60, swimmerDelay: 1500, crookDelay: 7000 },
  { rescued: 12, caught: 5,  time: 55, swimmerDelay: 1400, crookDelay: 6000 },
  { rescued: 15, caught: 8,  time: 50, swimmerDelay: 1200, crookDelay: 4000 },
  { rescued: 18, caught: 10, time: 45, swimmerDelay: 1100, crookDelay: 3000 },
  { rescued: 20, caught: 14, time: 40, swimmerDelay: 1000, crookDelay: 2000 }
];

function init(data) {
  this.currentMission = data?.currentMission ?? 0;
  this.isIntro = data?.isIntro ?? false;
  this.isTouch = this.sys.game.device.input.touch;

  // jednoduchá mobilná optimalizácia
  this.isMobilePerf = this.isTouch;
  this.MOBILE_SPAWN_SCALE = this.isMobilePerf ? 1.35 : 1.0;
  this.MAX_SWIMMERS = this.isMobilePerf ? 6 : 10;
  this.MAX_CROOKS   = this.isMobilePerf ? 3 : 6;

  this.BASE_SPEED = 260;
  this.MOBILE_SPEED = this.isMobilePerf ? 240 : this.BASE_SPEED;
}

function preload() {
  // BG/intro/reward/fail – načítame pre istotu (aj keď ich dávame ako CSS pozadie, môžu byť použité aj inak)
  this.load.image('hero', 'assets/hero_screen.png');
  for (let i=1;i<=5;i++) this.load.image(`bg${i}`, `assets/bg${i}.png`);
  for (let i=1;i<=5;i++) this.load.image(`reward${i}`, `assets/reward${i}.png`);
  this.load.image('fail', 'assets/fail.png');

  // hráči
  [
    'jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
    'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down'
  ].forEach(k => this.load.image(k, `assets/${k}.png`));

  // NPC
  ['swimmer_m','swimmer_f','crook','crook_left','splash']
    .forEach(k => this.load.image(k, `assets/${k}.png`));

  // žraloky
  this.load.image('shark', 'assets/shark.png');
  this.load.image('shark_right', 'assets/shark_right.png');

  // joystick
  this.load.image('handle_base', 'assets/joystick/handle_base.png');
  this.load.image('handle_knob', 'assets/joystick/handle_knob.png');

  // audio
  const audios = [
    'intro_theme','mission_theme','reward_theme','fail_theme','game_complete','jetski_loop',
    'swimmer_spawn','crook_spawn','shark_spawn'
  ];
  audios.forEach(a => {
    const ext = a.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(a, `assets/audio/${a}.${ext}`);
  });
}

function create() {
  audioUnlock(this);

  this.keys = this.input.keyboard.addKeys({
    space:Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter:Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc:Phaser.Input.Keyboard.KeyCodes.ESC,
    r:Phaser.Input.Keyboard.KeyCodes.R,
    left:Phaser.Input.Keyboard.KeyCodes.LEFT,
    right:Phaser.Input.Keyboard.KeyCodes.RIGHT,
    up:Phaser.Input.Keyboard.KeyCodes.UP,
    down:Phaser.Input.Keyboard.KeyCodes.DOWN
  });

  // ---------- INTRO ----------
  if (this.isIntro) {
    // fullscreen intro bez deformácie
    setBodyBG('assets/hero_screen.png');

    // text a ovládanie v world súradniciach (900x600) – FIT ich vypozicionuje
    const introText = this.isTouch ? 'Tap to start' : 'Press SPACE / ENTER or CLICK to start';
    const press = this.add.text(GAME_WIDTH/2, GAME_HEIGHT - 50, introText,
      { fontSize:'24px', color:'#fff', backgroundColor:'#000' }).setOrigin(0.5);
    this.tweens.add({ targets:press, alpha:0.2, yoyo:true, repeat:-1, duration:800 });

    this.sound.stopAll();
    this.sound.add('intro_theme', { loop:true, volume:0.7 }).play();

    const startGame = () => this.scene.restart({ currentMission: 0, isIntro: false });
    this.input.keyboard.once('keydown-SPACE', startGame);
    this.input.keyboard.once('keydown-ENTER', startGame);
    this.input.once('pointerdown', startGame);
    return;
  }

  // ---------- MISSION ----------
  // fullscreen pozadie podľa misie
  setBodyBG(`assets/bg${this.currentMission+1}.png`);

  this.sound.stopAll();
  this.sound.add('mission_theme', { loop:true, volume:0.55 }).play();
  this.engineSfx = this.sound.add('jetski_loop', { loop:true, volume:0.22 }); // hrá len pri pohybe (viď update)

  const mission = MISSIONS[this.currentMission];

  // player
  this.isFemale = Math.random() > 0.5;
  const startTexture = this.isFemale ? 'jetski_f' : 'jetski_m';
  this.player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT/2, startTexture)
    .setCollideWorldBounds(false).setSize(100,100);

  // groups
  this.swimmers = this.physics.add.group();
  this.crooks = this.physics.add.group();

  // spawns (mobil redšie)
  this.time.addEvent({ delay: Math.round(mission.swimmerDelay * this.MOBILE_SPAWN_SCALE), callback: spawnSwimmer, callbackScope: this, loop: true });
  this.time.addEvent({ delay: Math.round(mission.crookDelay   * this.MOBILE_SPAWN_SCALE), callback: spawnCrook,   callbackScope: this, loop: true });

  // sharks
  if (this.currentMission >= 3) {
    this.sharks = this.physics.add.group();
    this.time.addEvent({ delay: 6000, callback: () => spawnShark.call(this, 'right'), loop: true });
    if (this.currentMission >= 4) {
      this.time.addEvent({ delay: 7000, callback: () => spawnShark.call(this, 'left'), loop: true });
    }
    this.physics.add.overlap(this.player, this.sharks, hitShark, null, this);
  }

  // collisions
  this.physics.add.overlap(this.player, this.swimmers, rescueSwimmer, null, this);
  this.physics.add.collider(this.player, this.crooks,  catchCrook,   null, this);

  // HUD (world coords)
  const txt = { fontSize:'22px', color:'#fff', fontStyle:'bold', fontFamily:'Arial', shadow:{ offsetX:1, offsetY:1, color:'#000', blur:3 } };
  this.missionLabel = this.add.text(30, 18, `⭐ MISSION ${this.currentMission + 1}`, txt);
  this.scoreLabel   = this.add.text(GAME_WIDTH/2 - 60, 18, `💯 SCORE 0`, txt);
  this.timerLabel   = this.add.text(GAME_WIDTH - 150, 18, `🕒 ${mission.time}s`, txt);
  this.goalLabel    = this.add.text(25, 64, `🎯 Rescue ${mission.rescued} + Catch ${mission.caught}`,
                        { fontSize:'18px', color:'#003366', fontStyle:'bold', fontFamily:'Arial' });

  // timer
  this.timeLeft = mission.time;
  this.timerEvent = this.time.addEvent({
    delay: 1000, loop: true,
    callback: () => { this.timeLeft--; this.timerLabel.setText(`🕒 ${this.timeLeft}s`); if (this.timeLeft <= 0) failMission.call(this); }
  });

  this.score = 0; this.rescued = 0; this.caught = 0;

  // quick reset
  this.keys.r.on('down', () => hardReset(this));
  this.keys.esc.on('down', () => hardReset(this));

  // input
  this.cursors = this.input.keyboard.createCursorKeys();

  // ✅ menší joystick – VŽDY v zornom poli, lebo je v world (0..900×0..600) a FIT svet zväčší/centruje
  if (this.isTouch) createHandlebarJoystick.call(this);
}

function update() {
  if (!this.player) return;

  const speed = this.isTouch ? this.MOBILE_SPEED : this.BASE_SPEED;

  if (!this.isTouch) {
    let vx=0, vy=0;
    if (this.keys.left.isDown)  { vx = -speed; this.player.setTexture(this.isFemale ? 'jetski_f_left' : 'jetski_m_left'); }
    else if (this.keys.right.isDown){ vx =  speed; this.player.setTexture(this.isFemale ? 'jetski_f' : 'jetski_m'); }
    if (this.keys.up.isDown)    { vy = -speed; this.player.setTexture(this.isFemale ? 'jetski_f_up' : 'jetski_m_up'); }
    else if (this.keys.down.isDown) { vy =  speed; this.player.setTexture(this.isFemale ? 'jetski_f_down' : 'jetski_m_down'); }
    this.player.setVelocity(vx, vy);
  } else {
    if (this.joyVecSmoothed) {
      const jx = this.joyVecSmoothed.x, jy = this.joyVecSmoothed.y;
      this.player.setVelocity(jx*speed, jy*speed);

      const ax = Math.abs(jx), ay = Math.abs(jy);
      if (ay > ax) {
        if (jy < -0.25) this.player.setTexture(this.isFemale ? 'jetski_f_up' : 'jetski_m_up');
        else if (jy > 0.25) this.player.setTexture(this.isFemale ? 'jetski_f_down' : 'jetski_m_down');
      } else if (ax > 0.25) {
        if (jx < -0.25) this.player.setTexture(this.isFemale ? 'jetski_f_left' : 'jetski_m_left');
        else if (jx > 0.25) this.player.setTexture(this.isFemale ? 'jetski_f' : 'jetski_m');
      }
    } else {
      this.player.setVelocity(0,0);
    }
  }

  // clamp do worldu
  const halfW = this.player.displayWidth/2, halfH = this.player.displayHeight/2;
  this.player.x = Phaser.Math.Clamp(this.player.x, halfW, GAME_WIDTH - halfW);
  this.player.y = Phaser.Math.Clamp(this.player.y, halfH, GAME_HEIGHT - halfH);

  // motor len pri pohybe
  if (this.engineSfx && this.player.body) {
    const v = this.player.body.velocity;
    const sp = Math.hypot(v.x||0, v.y||0);
    if (sp > 20) { if (!this.engineSfx.isPlaying) this.engineSfx.play(); }
    else { if (this.engineSfx.isPlaying) this.engineSfx.pause(); }
  }
}

// ---------- efekty / logika ----------
function showSplash(x,y){ const s=this.add.image(x,y,'splash').setScale(0.7); this.tweens.add({targets:s,alpha:0,duration:420,onComplete:()=>s.destroy()}); }
function popupScore(scene,x,y,text){ const t=scene.add.text(x,y,text,{fontSize:'18px',color:'#ffff66',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(999); scene.tweens.add({targets:t,y:y-26,alpha:0,duration:600,onComplete:()=>t.destroy()}); }

function rescueSwimmer(player,swimmer){
  swimmer.destroy(); this.score+=10; this.rescued++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('swimmer_spawn',{volume:0.6});
  showSplash.call(this,swimmer.x,swimmer.y); popupScore(this,swimmer.x,swimmer.y,'+10');
  checkMission.call(this);
}
function catchCrook(player,crook){
  crook.destroy(); this.score+=30; this.caught++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('crook_spawn',{volume:0.6});
  showSplash.call(this,crook.x,crook.y); popupScore(this,crook.x,crook.y,'+30');
  checkMission.call(this);
}
function spawnSwimmer(){
  if (this.swimmers.countActive(true) >= this.MAX_SWIMMERS) return;
  const x=Phaser.Math.Between(50, GAME_WIDTH-50);
  const y=Phaser.Math.Between(50, GAME_HEIGHT-50);
  const texture=Math.random()>0.5?'swimmer_m':'swimmer_f';
  const s=this.swimmers.create(x,y,texture);
  s.setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70);
}
function spawnCrook(){
  if (this.crooks.countActive(true) >= this.MAX_CROOKS) return;
  const side=Phaser.Math.Between(0,1);
  const y=Phaser.Math.Between(80, GAME_HEIGHT-80);
  let texture,x,vx;
  if(side){ x=-50;             vx=Phaser.Math.Between(80,150);  texture='crook'; }
  else    { x=GAME_WIDTH+50;   vx=Phaser.Math.Between(-150,-80);texture='crook_left'; }
  const c=this.crooks.create(x,y,texture);
  c.setVelocity(vx,0).setImmovable(true).setSize(90,90);
}
function spawnShark(direction='right'){
  const y=Phaser.Math.Between(100, GAME_HEIGHT-100);
  let x,vx,texture;
  if(direction==='right'){ x=GAME_WIDTH+120; vx=Phaser.Math.Between(-250,-200); texture='shark'; }
  else                   { x=-120;          vx=Phaser.Math.Between(200,250);  texture='shark_right'; }
  const shark=this.sharks.create(x,y,texture);
  shark.setVelocity(vx,0).setImmovable(true).setSize(100,60);
  this.sound.play('shark_spawn',{volume:0.8});
  this.tweens.add({targets:shark,y:shark.y+Phaser.Math.Between(-15,15),duration:Phaser.Math.Between(1500,2000),ease:'Sine.easeInOut',yoyo:true,repeat:-1});
}
function hitShark(player,shark){
  shark.destroy();
  this.score=Math.max(0,this.score-30);
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  const flash=this.add.rectangle(0,0,GAME_WIDTH,GAME_HEIGHT,0xff0000,0.28).setOrigin(0,0).setDepth(999);
  this.tweens.add({targets:flash,alpha:0,duration:340,onComplete:()=>flash.destroy()});
  showSplash.call(this,player.x,player.y); popupScore(this,player.x,player.y,'-30');
}
function checkMission(){
  const mission=MISSIONS[this.currentMission];
  this.goalLabel.setText(`🎯 Rescue ${mission.rescued} (${this.rescued}/${mission.rescued}) + Catch ${mission.caught} (${this.caught}/${mission.caught})`);
  if (this.rescued>=mission.rescued && this.caught>=mission.caught) missionComplete.call(this);
}
function missionComplete(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  this.engineSfx?.stop();
  this.sound.stopAll();
  this.sound.add('reward_theme',{loop:true,volume:0.7}).play();

  // fullscreen reward ako BG
  setBodyBG(`assets/reward${this.currentMission+1}.png`);

  if (this.currentMission === MISSIONS.length - 1) {
    const nickname = localStorage.getItem('rr_nickname') || 'Player';
    const scoreEntry = { name: nickname, score: this.score, date: new Date().toISOString() };
    let leaderboard = JSON.parse(localStorage.getItem('rr_leaderboard') || '[]');
    leaderboard.push(scoreEntry); leaderboard.sort((a,b)=>b.score-a.score); leaderboard = leaderboard.slice(0,20);
    localStorage.setItem('rr_leaderboard', JSON.stringify(leaderboard));

    let y = 120;
    this.add.text(GAME_WIDTH/2, y, '🏅 TOP RESCUE RIDERS (Top 20) 🏅',
      { fontSize:'24px', color:'#ffff66', fontStyle:'bold' }).setOrigin(0.5).setDepth(1000);
    y += 35;
    leaderboard.forEach((e,i) => {
      this.add.text(GAME_WIDTH/2, y + i*24, `${(i+1).toString().padStart(2,'0')}. ${e.name} — ${e.score} pts`,
        { fontSize:'18px', color:'#fff', fontFamily:'Courier New' }).setOrigin(0.5).setDepth(1000);
    });

    const restartText = this.add.text(GAME_WIDTH/2, GAME_HEIGHT - 48, 'Press R (or Tap) to restart the game',
      { fontSize:'22px', color:'#fff', backgroundColor:'#000' }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: restartText, alpha:0.2, yoyo:true, repeat:-1, duration:800 });
    const restartHandler = () => { document.removeEventListener('pointerdown', restartHandler); hardReset(this); };
    document.addEventListener('pointerdown', restartHandler);
    this.keys.r.once('down', restartHandler);
  } else {
    const next=()=>this.scene.restart({currentMission:this.currentMission+1,isIntro:false});
    const t=this.add.text(GAME_WIDTH/2, GAME_HEIGHT-48, 'Press SPACE / ENTER / TAP for next mission',
      { fontSize:'26px', color:'#fff', backgroundColor:'#000' }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
    this.input.keyboard.once('keydown-SPACE',next);
    this.input.keyboard.once('keydown-ENTER',next);
    this.input.once('pointerdown',next);
  }
}
function failMission(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  this.engineSfx?.stop();
  this.sound.stopAll();
  this.sound.add('fail_theme',{loop:true,volume:0.7}).play();

  // fullscreen fail ako BG
  setBodyBG('assets/fail.png');

  const t=this.add.text(GAME_WIDTH/2, GAME_HEIGHT-48, 'Press SPACE / ENTER / TAP to retry',
    { fontSize:'26px', color:'#fff', backgroundColor:'#000' }).setOrigin(0.5).setDepth(1000);
  this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});

  const retry=()=>this.scene.restart({currentMission:this.currentMission,isIntro:false});
  this.input.keyboard.once('keydown-SPACE',retry);
  this.input.keyboard.once('keydown-ENTER',retry);
  this.input.once('pointerdown',retry);
}

// ---------- joystick: menší a vždy viditeľný (world coords) ----------
function createHandlebarJoystick(){
  const baseX = 95;                   // od ľavého okraja worldu
  const baseY = GAME_HEIGHT - 85;     // od spodného okraja worldu
  const base = this.add.image(baseX, baseY, 'handle_base').setDepth(1501).setAlpha(0.9).setScale(0.6);
  const knob = this.add.image(baseX, baseY, 'handle_knob').setDepth(1502).setAlpha(0.98).setScale(0.56);

  const RADIUS = 60, DEAD = 0.18, SMOOTH = 0.22;
  let activeId = null, raw = {x:0,y:0}; this.joyVecSmoothed = null;

  const dead = (x,y) => {
    const l=Math.hypot(x,y); if(l<DEAD) return {x:0,y:0};
    const k=(l-DEAD)/(1-DEAD); return {x:(x/l)*k, y:(y/l)*k};
  };

  const updateVec = () => {
    // worldX/Y už rešpektuje FIT, takže drží pozíciu v worlde
    const dx = this.input.activePointer.worldX - base.x;
    const dy = this.input.activePointer.worldY - base.y;
    const len = Math.hypot(dx,dy) || 1, nx=dx/len, ny=dy/len, cl=Math.min(len,RADIUS);
    knob.x = base.x + nx*cl; knob.y = base.y + ny*cl;
    raw = dead((cl/RADIUS)*nx, (cl/RADIUS)*ny);
    base.setRotation(Phaser.Math.Clamp(dx/220, -0.35, 0.35));
  };

  const reset = () => {
    activeId=null; base.setRotation(0); raw={x:0,y:0};
    this.tweens.add({targets:knob, x:base.x, y:base.y, duration:120, ease:'Sine.easeOut'});
  };

  this.time.addEvent({ delay:16, loop:true, callback:()=>{
    const c=this.joyVecSmoothed||{x:0,y:0};
    this.joyVecSmoothed = { x: c.x + (raw.x-c.x)*SMOOTH, y: c.y + (raw.y-c.y)*SMOOTH };
    if (Math.abs(this.joyVecSmoothed.x)<0.01 && Math.abs(this.joyVecSmoothed.y)<0.01) this.joyVecSmoothed=null;
  }});

  this.input.on('pointerdown', (p)=>{ if(activeId===null){ activeId=p.id; updateVec(); } });
  this.input.on('pointermove', (p)=>{ if(p.isDown && p.id===activeId) updateVec(); });
  this.input.on('pointerup',   (p)=>{ if(p.id===activeId) reset(); });
}
