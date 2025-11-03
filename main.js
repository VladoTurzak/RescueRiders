// Rescue Riders — Universal Build (Desktop + Mobile) with Jetski-Handle Joystick
// FIXES:
// 1) jetski_loop hrá iba pri pohybe (auto start/stop podľa rýchlosti)
// 2) Intro / Reward / Fail obrazovky sú fullscreen bez deformácie (contain fit)
const GAME_WIDTH = 900, GAME_HEIGHT = 600;
const MainScene = { key: 'main', preload, create, update, init };
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x87CEEB,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 60, forceSetTimeOut: true },
  scene: [MainScene]
};
let game = new Phaser.Game(config);
game.scene.start('main', { isIntro: true });

// --- Helpers ---
function hardReset(sceneCtx) {
  try { if (sceneCtx.engineSfx) sceneCtx.engineSfx.stop(); sceneCtx.sound.stopAll(); } catch(e){}
  setTimeout(() => {
    try { game.destroy(true); } catch(e){}
    game = new Phaser.Game(config);
    game.scene.start('main', { isIntro: true });
  }, 30);
}

// Fit image to full screen without distortion (contain)
function placeFullscreenImage(key, depth = 0) {
  const tex = this.textures.get(key).getSourceImage();
  const iw = tex.width, ih = tex.height;
  const scale = Math.min(config.width / iw, config.height / ih);
  const img = this.add.image(config.width / 2, config.height / 2, key)
    .setOrigin(0.5).setDepth(depth).setScale(scale);
  return img;
}

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
}

function preload() {
  this.load.image('hero', 'assets/hero_screen.png');
  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down','jetski_f','jetski_f_left','jetski_f_up','jetski_f_down']
    .forEach(j => this.load.image(j, `assets/${j}.png`));
  ['swimmer_m','swimmer_f','crook','crook_left','splash']
    .forEach(a => this.load.image(a, `assets/${a}.png`));
  this.load.image('shark', 'assets/shark.png');
  this.load.image('shark_right', 'assets/shark_right.png');
  for (let i=1;i<=5;i++) this.load.image(`bg${i}`, `assets/bg${i}.png`);
  for (let i=1;i<=5;i++) this.load.image(`reward${i}`, `assets/reward${i}.png`);
  this.load.image('fail', 'assets/fail.png');

  // joystick skin
  this.load.image('handle_base', 'assets/joystick/handle_base.png');
  this.load.image('handle_knob', 'assets/joystick/handle_knob.png');

  // audio
  const audios = ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete','jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'];
  audios.forEach(a=>{ const ext = a.includes('spawn')? 'wav':'mp3'; this.load.audio(a, `assets/audio/${a}.${ext}`); });
}

function create() {
  this.offsetX = (config.width - GAME_WIDTH) / 2;
  this.offsetY = (config.height - GAME_HEIGHT) / 2;

  this.keys = this.input.keyboard.addKeys({
    space:Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter:Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc:Phaser.Input.Keyboard.KeyCodes.ESC,
    r:Phaser.Input.Keyboard.KeyCodes.R,
    up:Phaser.Input.Keyboard.KeyCodes.UP,
    down:Phaser.Input.Keyboard.KeyCodes.DOWN,
    left:Phaser.Input.Keyboard.KeyCodes.LEFT,
    right:Phaser.Input.Keyboard.KeyCodes.RIGHT
  });

  // --- INTRO (fullscreen image, no distortion) ---
  if (this.isIntro) {
    placeFullscreenImage.call(this, 'hero', -10);
    const isMobile = this.isTouch;
    const introText = isMobile ? 'Tap to start' : 'Press SPACE / ENTER or CLICK to start';
    const press = this.add.text(config.width/2, config.height-80, introText,
      {fontSize: isMobile? '28px':'26px', color:'#fff', backgroundColor:'#000'}).setOrigin(0.5).setDepth(5);
    this.tweens.add({targets:press,alpha:0.2,yoyo:true,repeat:-1,duration:800});

    this.sound.stopAll();
    const intro = this.sound.add('intro_theme', { loop:true, volume:0.7 });
    intro.play();

    const startGame=()=>this.scene.restart({currentMission:0,isIntro:false});
    this.input.keyboard.once('keydown-SPACE',startGame);
    this.input.keyboard.once('keydown-ENTER',startGame);
    this.input.once('pointerdown',startGame);
    return;
  }

  // --- MISSION MUSIC ---
  this.sound.stopAll();
  this.sound.add('mission_theme', { loop:true, volume:0.4 }).play();

  // Engine SFX – vytvor, ale nespúšťaj hneď
  this.engineSfx = this.sound.add('jetski_loop', { loop:true, volume:1.8 });

  const mission=MISSIONS[this.currentMission];
  const bgKey=`bg${this.currentMission+1}`;
  if(this.textures.exists(bgKey))
    this.add.image(config.width/2,config.height/2,bgKey).setOrigin(0.5).setDepth(-10).setDisplaySize(config.width,config.height);

  // player
  this.isFemale=Math.random()>0.5;
  const startTexture=this.isFemale?'jetski_f':'jetski_m';
  this.player=this.physics.add.sprite(
    this.offsetX+GAME_WIDTH/2,
    this.offsetY+GAME_HEIGHT/2,
    startTexture
  ).setCollideWorldBounds(false).setSize(100,100);

  this.cursors=this.input.keyboard.createCursorKeys();

  // groups & spawns
  this.swimmers=this.physics.add.group();
  this.crooks=this.physics.add.group();
  this.time.addEvent({delay:mission.swimmerDelay,callback:spawnSwimmer,callbackScope:this,loop:true});
  this.time.addEvent({delay:mission.crookDelay,callback:spawnCrook,callbackScope:this,loop:true});

  // sharks
  if(this.currentMission>=3){
    this.sharks=this.physics.add.group();
    this.time.addEvent({delay:6000,callback:()=>spawnShark.call(this,'right'),loop:true});
    if(this.currentMission>=4)
      this.time.addEvent({delay:7000,callback:()=>spawnShark.call(this,'left'),loop:true});
    this.physics.add.overlap(this.player,this.sharks,hitShark,null,this);
  }

  // collisions
  this.physics.add.overlap(this.player,this.swimmers,rescueSwimmer,null,this);
  this.physics.add.collider(this.player,this.crooks,catchCrook,null,this);

  // info panel
  const panelY=this.offsetY+10;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 800;
  const scaleFont = isSmall ? 1.2 : 1.0;
  const txt={fontSize:`${Math.round(22*scaleFont)}px`,color:'#fff',fontStyle:'bold',fontFamily:'Arial',shadow:{offsetX:1,offsetY:1,color:'#000',blur:3}};
  this.missionLabel=this.add.text(this.offsetX+30,panelY+12,`⭐ MISSION ${this.currentMission+1}`,txt);
  this.scoreLabel=this.add.text(this.offsetX+GAME_WIDTH/2-60,panelY+12,`💯 SCORE 0`,txt);
  this.timerLabel=this.add.text(this.offsetX+GAME_WIDTH-150,panelY+12,`🕒 ${mission.time}s`,txt);
  this.goalLabel=this.add.text(this.offsetX+25,this.offsetY+65,`🎯 Rescue ${mission.rescued} + Catch ${mission.caught}`,
    {fontSize:`${Math.round(18*scaleFont)}px`,color:'#003366',fontStyle:'bold',fontFamily:'Arial'});

  // timer
  this.timeLeft=mission.time;
  this.timerEvent=this.time.addEvent({
    delay:1000,loop:true,
    callback:()=>{ this.timeLeft--; this.timerLabel.setText(`🕒 ${this.timeLeft}s`); if(this.timeLeft<=0) failMission.call(this); }
  });

  this.score=0;this.rescued=0;this.caught=0;

  // hard reset keys
  const onHardReset = (e) => { if (!e.repeat) hardReset(this); };
  this.keys.r.on('down', onHardReset);
  this.keys.esc.on('down', onHardReset);

  // mobile joystick
  if (this.isTouch) createHandlebarJoystick.call(this);
}

function update(){
  if(!this.player)return;

  // keyboard (desktop)
  if(!this.isTouch){
    this.player.setVelocity(0);
    if(this.keys.left.isDown){this.player.setVelocityX(-250);this.player.setTexture(this.isFemale?'jetski_f_left':'jetski_m_left');}
    else if(this.keys.right.isDown){this.player.setVelocityX(250);this.player.setTexture(this.isFemale?'jetski_f':'jetski_m');}
    if(this.keys.up.isDown){this.player.setVelocityY(-250);this.player.setTexture(this.isFemale?'jetski_f_up':'jetski_m_up');}
    else if(this.keys.down.isDown){this.player.setVelocityY(250);this.player.setTexture(this.isFemale?'jetski_f_down':'jetski_m_down');}
  } else {
    // joystick (mobile)
    if (this.joyVec) {
      const speed = 260;
      this.player.setVelocity(this.joyVec.x * speed, this.joyVec.y * speed);
      const ax = Math.abs(this.joyVec.x), ay = Math.abs(this.joyVec.y);
      if (ay > ax) {
        if (this.joyVec.y < -0.2) this.player.setTexture(this.isFemale ? 'jetski_f_up' : 'jetski_m_up');
        else if (this.joyVec.y > 0.2) this.player.setTexture(this.isFemale ? 'jetski_f_down' : 'jetski_m_down');
      } else if (ax > 0.2) {
        if (this.joyVec.x < -0.2) this.player.setTexture(this.isFemale ? 'jetski_f_left' : 'jetski_m_left');
        else if (this.joyVec.x > 0.2) this.player.setTexture(this.isFemale ? 'jetski_f' : 'jetski_m');
      }
    } else {
      this.player.setVelocity(0);
    }
  }

  // clamp
  const halfW=this.player.displayWidth/2,halfH=this.player.displayHeight/2;
  this.player.x=Phaser.Math.Clamp(this.player.x,this.offsetX+halfW,this.offsetX+GAME_WIDTH-halfW);
  this.player.y=Phaser.Math.Clamp(this.player.y,this.offsetY+halfH,this.offsetY+GAME_HEIGHT-halfH);

  // Engine sound start/stop podľa rýchlosti
  if (this.engineSfx && this.player.body) {
    const vx = this.player.body.velocity.x || 0;
    const vy = this.player.body.velocity.y || 0;
    const speed = Math.hypot(vx, vy);
    if (speed > 20) {
      if (!this.engineSfx.isPlaying) this.engineSfx.play();
    } else {
      if (this.engineSfx.isPlaying) this.engineSfx.pause();
    }
  }
}

// effects
function showSplash(x,y){const s=this.add.image(x,y,'splash').setScale(0.7);this.tweens.add({targets:s,alpha:0,duration:500,onComplete:()=>s.destroy()});}
function popupScore(scene,x,y,text){ const t=scene.add.text(x,y,text,{fontSize:'18px',color:'#ffff66',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(999); scene.tweens.add({targets:t,y:y-30,alpha:0,duration:700,onComplete:()=>t.destroy()}); }

// logic
function rescueSwimmer(player,swimmer){
  swimmer.destroy();
  this.score+=10;this.rescued++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('swimmer_spawn',{volume:0.6});
  showSplash.call(this,swimmer.x,swimmer.y);
  popupScore(this,swimmer.x,swimmer.y,'+10');
  checkMission.call(this);
}
function catchCrook(player,crook){
  crook.destroy();
  this.score+=30;this.caught++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('crook_spawn',{volume:0.6});
  showSplash.call(this,crook.x,crook.y);
  popupScore(this,crook.x,crook.y,'+30');
  checkMission.call(this);
}
function spawnSwimmer(){
  const x=Phaser.Math.Between(this.offsetX+50,this.offsetX+GAME_WIDTH-50);
  const y=Phaser.Math.Between(this.offsetY+50,this.offsetY+GAME_HEIGHT-50);
  const texture=Math.random()>0.5?'swimmer_m':'swimmer_f';
  const s=this.swimmers.create(x,y,texture);
  s.setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70);
}
function spawnCrook(){
  const side=Phaser.Math.Between(0,1);
  const y=Phaser.Math.Between(this.offsetY+80,this.offsetY+GAME_HEIGHT-80);
  let texture,x,vx;
  if(side){x=this.offsetX-50;vx=Phaser.Math.Between(80,150);texture='crook';}
  else{x=this.offsetX+GAME_WIDTH+50;vx=Phaser.Math.Between(-150,-80);texture='crook_left';}
  const c=this.crooks.create(x,y,texture);
  c.setVelocity(vx,0).setImmovable(true).setSize(90,90);
}
function spawnShark(direction='right'){
  const y=Phaser.Math.Between(this.offsetY+100,this.offsetY+GAME_HEIGHT-100);
  let x,vx,texture;
  if(direction==='right'){x=this.offsetX+GAME_WIDTH+120;vx=Phaser.Math.Between(-250,-200);texture='shark';}
  else{x=this.offsetX-120;vx=Phaser.Math.Between(200,250);texture='shark_right';}
  const shark=this.sharks.create(x,y,texture);
  shark.setVelocity(vx,0).setImmovable(true).setSize(100,60);
  this.sound.play('shark_spawn',{volume:0.8});
  this.tweens.add({targets:shark,y:shark.y+Phaser.Math.Between(-15,15),duration:Phaser.Math.Between(1500,2000),
                   ease:'Sine.easeInOut',yoyo:true,repeat:-1});
}
function hitShark(player,shark){
  shark.destroy();
  this.score=Math.max(0,this.score-30);
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  const flash=this.add.rectangle(config.width/2,config.height/2,config.width,config.height,0xff0000,0.3).setDepth(999);
  this.tweens.add({targets:flash,alpha:0,duration:400,onComplete:()=>flash.destroy()});
  showSplash.call(this,player.x,player.y);
  popupScore(this,player.x,player.y,'-30');
}
function checkMission(){
  const mission=MISSIONS[this.currentMission];
  this.goalLabel.setText(`🎯 Rescue ${mission.rescued} (${this.rescued}/${this.rescued>=mission.rescued?mission.rescued:this.rescued}) + Catch ${mission.caught} (${this.caught}/${this.caught>=mission.caught?mission.caught:this.caught})`);
  if(this.rescued>=mission.rescued&&this.caught>=mission.caught) missionComplete.call(this);
}
function missionComplete(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  if (this.engineSfx) this.engineSfx.stop();
  this.sound.stopAll();
  this.sound.add('reward_theme',{loop:true,volume:0.7}).play();

  // Fullscreen reward image (contain fit)
  const rewardKey = `reward${this.currentMission+1}`;
  placeFullscreenImage.call(this, rewardKey, 999);

  // Save + show Top 20 on final screen
  if(this.currentMission===MISSIONS.length-1){
    const nickname = localStorage.getItem('rr_nickname') || 'Player';
    const scoreEntry = { name: nickname, score: this.score, date: new Date().toISOString() };
    let leaderboard = JSON.parse(localStorage.getItem('rr_leaderboard') || '[]');
    leaderboard.push(scoreEntry);
    leaderboard.sort((a,b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 20);
    localStorage.setItem('rr_leaderboard', JSON.stringify(leaderboard));

    let y = Math.max(120, config.height * 0.35);
    this.add.text(config.width / 2, y, '🏅 TOP RESCUE RIDERS (Top 20) 🏅',
      { fontSize:'24px', color:'#ffff66', fontStyle:'bold' }).setOrigin(0.5).setDepth(1000);
    y += 35;
    leaderboard.forEach((e,i) => {
      this.add.text(config.width / 2, y + i*24,
        `${(i+1).toString().padStart(2,'0')}. ${e.name} — ${e.score} pts`,
        { fontSize:'18px', color:'#fff', fontFamily:'Courier New' }).setOrigin(0.5).setDepth(1000);
    });
  }

  const next=()=>this.scene.restart({currentMission:this.currentMission+1,isIntro:false});
  if(this.currentMission<MISSIONS.length-1){
    const t=this.add.text(config.width/2,config.height-60,'Press SPACE / ENTER / TAP for next mission',
      {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
    this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
    this.input.keyboard.once('keydown-SPACE',next);
    this.input.keyboard.once('keydown-ENTER',next);
    this.input.once('pointerdown',next);
  } else {
    this.sound.stopAll();
    this.sound.add('game_complete', { loop: true, volume: 0.7 }).play();

    this.add.text(config.width / 2, config.height - 100,
      "🏆 Game Complete! 🏆", { fontSize: '32px', color: '#ff0' }).setOrigin(0.5).setDepth(1000);

    const restartText = this.add.text(config.width / 2, config.height - 60,
      'Press R (or Tap) to restart the game',
      { fontSize: '22px', color: '#fff', backgroundColor: '#000' })
      .setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: restartText, alpha: 0.2, yoyo: true, repeat: -1, duration: 800 });

    const restartHandler = () => { document.removeEventListener('pointerdown', restartHandler); hardReset(this); };
    document.addEventListener('pointerdown', restartHandler);
    this.keys.r.once('down', restartHandler);
  }
}
function failMission(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  if (this.engineSfx) this.engineSfx.stop();
  this.sound.stopAll();
  this.sound.add('fail_theme',{loop:true,volume:0.7}).play();

  // Fullscreen fail image (contain fit)
  placeFullscreenImage.call(this, 'fail', 999);

  const retry=()=>this.scene.restart({currentMission:this.currentMission,isIntro:false});
  const t=this.add.text(config.width/2,config.height-60,'Press SPACE / ENTER / TAP to retry',
    {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
  this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
  this.input.keyboard.once('keydown-SPACE',retry);
  this.input.keyboard.once('keydown-ENTER',retry);
  this.input.once('pointerdown',retry);
}

// joystick
function createHandlebarJoystick(){
  const pad = Math.min(this.scale.width, this.scale.height) * 0.08;
  const baseX = pad + 180;
  const baseY = this.scale.height - pad - 120;

  const base = this.add.image(baseX, baseY, 'handle_base').setDepth(1001).setAlpha(0.85).setScale(0.9);
  const knob = this.add.image(baseX, baseY, 'handle_knob').setDepth(1002).setAlpha(0.95).setScale(0.8);

  const radius = 80;
  this.joyVec = null;

  const updateVec = (pointer) => {
    const dx = pointer.x - base.x;
    const dy = pointer.y - base.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const nx = dx / len, ny = dy / len;
    const clampedLen = Math.min(len, radius);
    knob.x = base.x + nx * clampedLen;
    knob.y = base.y + ny * clampedLen;
    this.joyVec = { x: (clampedLen/radius)*nx, y: (clampedLen/radius)*ny };
    const tilt = Phaser.Math.Clamp(dx / 200, -0.35, 0.35);
    base.setRotation(tilt);
  };

  const resetJoy = () => {
    this.tweens.add({targets: knob, x: base.x, y: base.y, duration: 120, ease: 'Sine.easeOut'});
    base.setRotation(0);
    this.joyVec = null;
  };

  this.input.on('pointerdown', (p)=>{ updateVec(p); });
  this.input.on('pointermove', (p)=>{ if(p.isDown) updateVec(p); });
  this.input.on('pointerup', ()=>{ resetJoy(); });
}

// keep canvas fit on resize
window.addEventListener('resize', () => {
  if (!game) return;
  game.scale.resize(window.innerWidth, window.innerHeight);
});
