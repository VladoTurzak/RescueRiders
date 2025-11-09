// Rescue Riders — pevné 900×600 (3:2), desktop-identické. ŽIADNY runtime resize vo Phaseri.
const GAME_WIDTH = 900, GAME_HEIGHT = 600;

const MainScene = { key:'main', preload, create, update, init };

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',     // existuje v indexe
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 0x000000,
  physics: { default:'arcade', arcade:{ debug:false } },
  scene: [MainScene]
};

let game = new Phaser.Game(config);
game.scene.start('main', { isIntro:true });

/* ---------- Helpers ---------- */
function showFullscreenImageFit(scene, key){
  const W = GAME_WIDTH, H = GAME_HEIGHT;
  const img = scene.add.image(W/2, H/2, key).setOrigin(0.5);
  const scale = Math.min(W/img.width, H/img.height);
  img.setScale(scale);
  return img;
}
function showFullscreenImageCover(scene, key){
  // „cover“ v rámci 900×600 (nie na okno): nič sa nedeformuje, ale zaplní celé pole
  const W = GAME_WIDTH, H = GAME_HEIGHT;
  const img = scene.add.image(W/2, H/2, key).setOrigin(0.5);
  const scale = Math.max(W/img.width, H/img.height);
  img.setScale(scale).setDepth(-100);
  return img;
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

  for(let i=1;i<=5;i++){
    this.load.image(`bg${i}`,`assets/bg${i}.png`);
    this.load.image(`reward${i}`,`assets/reward${i}.png`);
  }

  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete',
   'jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'
  ].forEach(a=>{
    const ext = a.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(a, `assets/audio/${a}.${ext}`);
  });
}

function create(){
  // 🔊 odomkni audio
  if(this.sound.locked) this.sound.unlock();

  // klávesy
  this.keys = this.input.keyboard.addKeys({
    space:Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter:Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc:Phaser.Input.Keyboard.KeyCodes.ESC,
    r:Phaser.Input.Keyboard.KeyCodes.R
  });

  // ----- Intro (v 900×600) -----
  if (this.isIntro){
    showFullscreenImageFit(this,'hero');
    const press = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-60,
      'Press SPACE / ENTER or CLICK to start',
      {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5);
    this.tweens.add({targets:press,alpha:0.2,yoyo:true,repeat:-1,duration:800});

    this.sound.stopAll();
    const playIntro = ()=> this.sound.play('intro_theme',{loop:true,volume:0.7});
    if (this.sound.locked) this.sound.once('unlocked', playIntro); else playIntro();

    const start=()=>this.scene.restart({currentMission:0,isIntro:false});
    this.input.keyboard.once('keydown-SPACE',start);
    this.input.keyboard.once('keydown-ENTER',start);
    this.input.once('pointerdown',start);
    return;
  }

  // ----- Mission (v 900×600) -----
  this.sound.stopAll();
  const playMission = ()=> this.sound.play('mission_theme',{loop:true,volume:0.7});
  if (this.sound.locked) this.sound.once('unlocked', playMission); else playMission();

  this.jetskiSound = this.sound.add('jetski_loop',{loop:true,volume:0});
  this.jetskiSound.play();

  // pozadie misie – cover v rámci 900×600 (bez deformácie UI)
  const bgKey = `bg${this.currentMission+1}`;
  if (this.textures.exists(bgKey)) showFullscreenImageCover(this, bgKey);

  // hráč
  this.isFemale = Math.random()>0.5;
  const tex = this.isFemale ? 'jetski_f' : 'jetski_m';
  this.player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT/2, tex)
                  .setCollideWorldBounds(false).setSize(100,100);

  // vstupy
  this.cursors = this.input.keyboard.createCursorKeys();

  // groups & spawns
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

  // UI – pevné súradnice v 900×600 (vždy viditeľné)
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

  // clamp do 900×600 → nikdy nevylezie mimo zorné pole
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
  this.sound.play('crook_spawn',{volume:0.6}); showSplash.call(this,crook.x,crook.y); popupScore(this,crook.x,crook.y,'+30');
  checkMission.call(this);
}
function spawnSwimmer(){
  const x=Phaser.Math.Between(50,GAME_WIDTH-50), y=Phaser.Math.Between(50,GAME_HEIGHT-50);
  const t=Math.random()>0.5?'swimmer_m':'swimmer_f';
  const s=this.swimmers?.create(x,y,t) ?? this.physics.add.group().create(x,y,t);
  s.setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70);
}
function spawnCrook(){
  const side=Phaser.Math.Between(0,1), y=Phaser.Math.Between(80,GAME_HEIGHT-80);
  let x,v,tx; if(side){ x=-50; v=Phaser.Math.Between(80,150); tx='crook'; } else { x=GAME_WIDTH+50; v=Phaser.Math.Between(-150,-80); tx='crook_left'; }
  const c=this.crooks?.create(y?x:x,y,tx) ?? this.physics.add.group().create(x,y,tx);
  c.setVelocity(v,0).setImmovable(true).setSize(90,90);
}
function spawnShark(direction='right'){
  if(!this.sharks) this.sharks = this.physics.add.group();
  const y=Phaser.Math.Between(100,GAME_HEIGHT-100); let x,v,tx;
  if(direction==='right'){ x=GAME_WIDTH+120; v=Phaser.Math.Between(-250,-200); tx='shark'; }
  else { x=-120; v=Phaser.Math.Between(200,250); tx='shark_right'; }
  const shark=this.sharks.create(x,y,tx);
  shark.setVelocity(v,0).setImmovable(true).setSize(100,60);
  this.sound.play('shark_spawn',{volume:0.8});
  this.tweens.add({targets:shark,y:shark.y+Phaser.Math.Between(-15,15),duration:Phaser.Math.Between(1500,2000),ease:'Sine.easeInOut',yoyo:true,repeat:-1});
}
function hitShark(player,shark){
  shark.destroy(); this.score=Math.max(0,this.score-30); this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  const flash=this.add.rectangle(GAME_WIDTH/2,GAME_HEIGHT/2,GAME_WIDTH,GAME_HEIGHT,0xff0000,0.3).setDepth(999);
  this.tweens.add({targets:flash,alpha:0,duration:400,onComplete:()=>flash.destroy()});
  showSplash.call(this,player.x,player.y); popupScore(this,player.x,player.y,'-30');
}

/* ---------- Win / Fail ---------- */
function checkMission(){
  const m=MISSIONS[this.currentMission];
  this.goalLabel.setText(`🎯 Rescue ${m.rescued} (${this.rescued||0}/${m.rescued}) + Catch ${m.caught} (${this.caught||0}/${m.caught})`);
  if((this.rescued||0)>=m.rescued && (this.caught||0)>=m.caught) missionComplete.call(this);
}
function missionComplete(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  this.sound.stopAll(); this.sound.play('reward_theme',{loop:true,volume:0.7});
  showFullscreenImageFit(this,`reward${this.currentMission+1}`).setDepth(999);

  const next=()=>this.scene.restart({currentMission:this.currentMission+1,isIntro:false});
  if(this.currentMission<MISSIONS.length-1){
    const t=this.add.text(GAME_WIDTH/2,GAME_HEIGHT-60,'Press SPACE / ENTER / CLICK for next mission',
      {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
    this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
    this.input.keyboard.once('keydown-SPACE',next);
    this.input.keyboard.once('keydown-ENTER',next);
    this.input.once('pointerdown',next);
  } else {
    this.sound.stopAll(); this.sound.play('game_complete',{loop:true,volume:0.7});
    this.add.text(GAME_WIDTH/2,GAME_HEIGHT-100,'🏆 Game Complete! 🏆',
      {fontSize:'32px',color:'#ff0'}).setOrigin(0.5).setDepth(1000);
    const r=this.add.text(GAME_WIDTH/2,GAME_HEIGHT-60,'Press R to restart the game',
      {fontSize:'24px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
    this.tweens.add({targets:r,alpha:0.2,yoyo:true,repeat:-1,duration:800});
    const h=(e)=>{ if(e.key==='r'||e.key==='R'){ document.removeEventListener('keydown',h); hardReset(this);} };
    document.addEventListener('keydown',h);
  }
}
function failMission(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  this.sound.stopAll(); this.sound.play('fail_theme',{loop:true,volume:0.7});
  showFullscreenImageFit(this,'fail').setDepth(999);
  const retry=()=>this.scene.restart({currentMission:this.currentMission,isIntro:false});
  const t=this.add.text(GAME_WIDTH/2,GAME_HEIGHT-60,'Press SPACE / ENTER / CLICK to retry',
    {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
  this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
  this.input.keyboard.once('keydown-SPACE',retry);
  this.input.keyboard.once('keydown-ENTER',retry);
  this.input.once('pointerdown',retry);
}
