// Rescue Riders — 900×600 (3:2). Silné odomknutie zvuku + fullscreen/gesture hook.
const GAME_WIDTH = 900, GAME_HEIGHT = 600;
const MainScene = { key:'main', preload, create, update, init };

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 0x000000,
  physics: { default:'arcade', arcade:{ debug:false } },
  audio: { noAudio:false, disableWebAudio:false },
  scene: [MainScene]
};

let game = new Phaser.Game(config);
game.scene.start('main', { isIntro:true });

/* ---------- Helpers ---------- */
function showFullscreenImageFit(scene, key){
  const img = scene.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, key).setOrigin(0.5);
  const scale = Math.min(GAME_WIDTH/img.width, GAME_HEIGHT/img.height);
  img.setScale(scale);
  return img;
}
function showFullscreenImageCover(scene, key){
  const img = scene.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, key).setOrigin(0.5);
  const scale = Math.max(GAME_WIDTH/img.width, GAME_HEIGHT/img.height);
  img.setScale(scale).setDepth(-100);
  return img;
}

// ===== Audio bootstrap (počúva gesture na scene aj na document) =====
function ensureAudio(scene){
  if (ensureAudio._done) return;
  const resume = () => {
    try{ scene.sound.unlock(); }catch(e){}
    try{ const ctx = scene.sound.context; if(ctx && ctx.state!=='running'){ ctx.resume(); } }catch(e){}
    ensureAudio._done = true;
    document.removeEventListener('rr-user-gesture', onDoc);
    document.removeEventListener('pointerdown', onDoc);
    document.removeEventListener('keydown', onDoc);
  };
  const onDoc = ()=>resume();
  // dokumentové gestá (klik na „Start“ mimo canvasu)
  document.addEventListener('rr-user-gesture', onDoc, { once:true });
  document.addEventListener('pointerdown', onDoc, { once:true });
  document.addEventListener('keydown', onDoc, { once:true });
  // záložné gesto priamo v scéne
  scene.input.once('pointerdown', resume);
  scene.input.keyboard.once('keydown', resume);
}

function playLoop(scene, key, cfg){
  ensureAudio(scene);
  const start = ()=>{ try{ scene.sound.play(key, cfg); }catch(e){} };
  if (!scene.sound.locked && scene.sound.context && scene.sound.context.state==='running'){ start(); return; }
  const fire=()=>{ start(); document.removeEventListener('rr-user-gesture', fire); };
  document.addEventListener('rr-user-gesture', fire, { once:true });
}

function hardReset(sceneCtx){
  try{ sceneCtx.sound.stopAll(); if(sceneCtx.jetskiSound) sceneCtx.jetskiSound.stop(); }catch(e){}
  setTimeout(()=>{ try{game.destroy(true);}catch(e){}; game = new Phaser.Game(config); game.scene.start('main',{isIntro:true}); },40);
}

/* ---------- Data ---------- */
const MISSIONS = [
  { rescued:10, caught:3,  time:60, swimmerDelay:1500, crookDelay:7000 },
  { rescued:12, caught:5,  time:55, swimmerDelay:1400, crookDelay:6000 },
  { rescued:15, caught:8,  time:50, swimmerDelay:1200, crookDelay:4000 },
  { rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
  { rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];

/* ---------- Scene ---------- */
function init(d){ this.currentMission = d?.currentMission ?? 0; this.isIntro = d?.isIntro ?? false; }

function preload(){
  this.load.image('hero','assets/hero_screen.png');
  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
   'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
   'swimmer_m','swimmer_f','crook','crook_left','splash',
   'shark','shark_right','fail'
  ].forEach(k=>this.load.image(k,`assets/${k}.png`));
  for(let i=1;i<=5;i++){ this.load.image(`bg${i}`,`assets/bg${i}.png`); this.load.image(`reward${i}`,`assets/reward${i}.png`); }
  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete',
   'jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'
  ].forEach(a=>{
    const ext = a.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(a, `assets/audio/${a}.${ext}`);
  });
}

function create(){
  // Registruj robustné odomknutie zvuku pre túto scénu
  ensureAudio(this);

  // klávesy
  this.keys = this.input.keyboard.addKeys({
    space:Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter:Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc:Phaser.Input.Keyboard.KeyCodes.ESC,
    r:Phaser.Input.Keyboard.KeyCodes.R
  });

  // ----- Intro -----
  if (this.isIntro){
    showFullscreenImageFit(this,'hero');
    const press = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-60,
      'Press SPACE / ENTER or CLICK to start',
      {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5);
    this.tweens.add({targets:press,alpha:0.2,yoyo:true,repeat:-1,duration:800});

    this.sound.stopAll();
    playLoop(this,'intro_theme',{loop:true,volume:0.7});

    const start=()=>this.scene.restart({currentMission:0,isIntro:false});
    this.input.keyboard.once('keydown-SPACE',start);
    this.input.keyboard.once('keydown-ENTER',start);
    this.input.once('pointerdown',start);
    return;
  }

  // ----- Mission -----
  this.sound.stopAll();
  playLoop(this,'mission_theme',{loop:true,volume:0.7});

  this.jetskiSound = this.sound.add('jetski_loop',{loop:true,volume:0});
  const startJet = ()=>{ try{ this.jetskiSound.play(); }catch(e){} };
  if (!this.sound.locked && this.sound.context && this.sound.context.state==='running') startJet();
  else document.addEventListener('rr-user-gesture', ()=>startJet(), { once:true });

  // Pozadie (cover v 900×600)
  const bgKey = `bg${this.currentMission+1}`;
  if (this.textures.exists(bgKey)) showFullscreenImageCover(this, bgKey);

  // Hráč
  this.isFemale = Math.random()>0.5;
  const tex = this.isFemale ? 'jetski_f' : 'jetski_m';
  this.player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT/2, tex)
                  .setCollideWorldBounds(false).setSize(100,100);

  // Vstupy
  this.cursors = this.input.keyboard.createCursorKeys();

  // Spawny
  const m = MISSIONS[this.currentMission];
  this.swimmers = this.physics.add.group();
  this.crooks   = this.physics.add.group();
  this.time.addEvent({delay:m.swimmerDelay, callback:spawnSwimmer, callbackScope:this, loop:true});
  this.time.addEvent({delay:m.crookDelay,   callback:spawnCrook,   callbackScope:this, loop:true});

  if (this.currentMission>=3){
    this.sharks = this.physics.add.group();
    this.time.addEvent({delay:6000, callback:()=>spawnShark.call(this,'right'), loop:true});
    if (this.currentMission>=4) this.time.addEvent({delay:7000, callback:()=>spawnShark.call(this,'left'),  loop:true});
    this.physics.add.overlap(this.player, this.sharks, hitShark, null, this);
  }
  this.physics.add.overlap(this.player, this.swimmers, rescueSwimmer, null, this);
  this.physics.add.collider(this.player, this.crooks,  catchCrook,   null, this);

  // UI
  const txt={fontSize:'22px',color:'#fff',fontStyle:'bold',fontFamily:'Arial',shadow:{offsetX:1,offsetY:1,color:'#000',blur:3}};
  this.missionLabel = this.add.text(30, 22, `⭐ MISSION ${this.currentMission+1}`, txt);
  this.scoreLabel   = this.add.text(GAME_WIDTH/2-60, 22, `💯 SCORE 0`, txt);
  this.timerLabel   = this.add.text(GAME_WIDTH-150, 22, `🕒 ${m.time}s`, txt);
  this.goalLabel    = this.add.text(25, 65, `🎯 Rescue ${m.rescued} + Catch ${m.caught}`,
                        {fontSize:'18px',color:'#003366',fontStyle:'bold',fontFamily:'Arial'});

  this.timeLeft = m.time;
  this.timerEvent = this.time.addEvent({
    delay:1000, loop:true, callback:()=>{
      this.timeLeft--; this.timerLabel.setText(`🕒 ${this.timeLeft}s`);
      if(this.timeLeft<=0) failMission.call(this);
    }
  });

  this.score=0; this.rescued=0; this.caught=0;

  const onHard = (e)=>{ if(!e.repeat) hardReset(this); };
  this.keys.r.on('down', onHard);
  this.keys.esc.on('down', onHard);
}

function update(){
  if(!this.player||!this.cursors) return;
  const moving = this.cursors.left.isDown||this.cursors.right.isDown||this.cursors.up.isDown||this.cursors.down.isDown;
  if (this.jetskiSound){
    const target = moving ? 0.55 : 0.0;
    this.jetskiSound.volume += (target - this.jetskiSound.volume)*0.08;
  }
  let vx=0, vy=0;
  if(this.cursors.left.isDown){ vx-=250; this.player.setTexture(this.isFemale?'jetski_f_left':'jetski_m_left'); }
  else if(this.cursors.right.isDown){ vx+=250; this.player.setTexture(this.isFemale?'jetski_f':'jetski_m'); }
  if(this.cursors.up.isDown){ vy-=250; this.player.setTexture(this.isFemale?'jetski_f_up':'jetski_m_up'); }
  else if(this.cursors.down.isDown){ vy+=250; this.player.setTexture(this.isFemale?'jetski_f_down':'jetski_m_down'); }
  this.player.setVelocity(vx,vy);
  const hw=this.player.displayWidth/2, hh=this.player.displayHeight/2;
  this.player.x = Phaser.Math.Clamp(this.player.x, hw, GAME_WIDTH - hw);
  this.player.y = Phaser.Math.Clamp(this.player.y, hh, GAME_HEIGHT - hh);
}

/* ---------- Gameplay utils ---------- */
function showSplash(x,y){ const s=this.add.image(x,y,'splash').setScale(0.7); this.tweens.add({targets:s,alpha:0,duration:500,onComplete:()=>s.destroy()}); }
function popupScore(scene,x,y,text){ const t=scene.add.text(x,y,text,{fontSize:'18px',color:'#ffff66',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(999); scene.tweens.add({targets:t,y:y-30,alpha:0,duration:700,onComplete:()=>t.destroy()}); }

/* ---------- Spawns & collisions ---------- */
function rescueSwimmer(player,swimmer){
  swimmer.destroy(); this.score+=10; this.rescued++; this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('swimmer_spawn',{volume:0.6}); showSplash.call(this,swimmer.x,swimmer.y); popupScore(this,swimmer.x,swimmer.y,'+10');
  checkMission.call(this);
}
function catchCrook(player,crook){
  crook.destroy(); this.score+=30; this.caught++; this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('crook_spawn',{volume:0.6}); showSplash.call(this,crook.x,crook.y); popupScore(this,cr
