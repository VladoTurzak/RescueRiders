console.log('[RR] main.js načítané');

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

window.startRescueRiders = function() {
  if (game) return;
  console.log('[RR] Štartujem hru...');

  setTimeout(() => {
    game = new Phaser.Game(config);
    setTimeout(() => {
      game.scene.start('main', { isIntro: true });
      setTimeout(() => game.scale.refresh(), 300);
    }, 300);
  }, 300);
};

// RESIZE - mobil + desktop
let resizeTO;
function onResize() {
  clearTimeout(resizeTO);
  resizeTO = setTimeout(() => {
    if (game && game.scale) game.scale.refresh();
  }, 100);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', onResize);
  visualViewport.addEventListener('scroll', onResize);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 400));

function init(data) {
  this.currentMission = data?.currentMission ?? 0;
  this.isIntro = data?.isIntro ?? false;
}

function preload() {
  this.load.image('hero16', 'assets/hero_screen_1280x720.png');
  this.load.image('fail16', 'assets/fail_1280x720.png');
  for (let i=1; i<=5; i++) this.load.image(`reward16_${i}`, `assets/reward${i}_1280x720.png`);

  const sprites = ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
    'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
    'swimmer_m','swimmer_f','crook','crook_left','splash','shark','shark_right'];
  sprites.forEach(k => this.load.image(k, `assets/${k}.png`));

  const audio = ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete',
    'jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'];
  audio.forEach(a => {
    const ext = a.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(a, `assets/audio/${a}.${ext}`);
  });
}

function create() {
  this.scale.refresh();
  this.keys = this.input.keyboard.addKeys('SPACE,ENTER,ESC,R');
  ensureAudio(this);

  if (this.isIntro) {
    document.getElementById('bg-cover').src = 'assets/hero_screen_1280x720.png';
    const img = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'hero16').setOrigin(0.5);
    img.setScale(Math.min(GAME_WIDTH/img.width, GAME_HEIGHT/img.height));

    const txt = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80, 'Press SPACE / ENTER or CLICK to start',
      {fontSize:'28px', color:'#fff', backgroundColor:'#000a'}).setOrigin(0.5);
    this.tweens.add({targets:txt, alpha:0.3, yoyo:true, repeat:-1, duration:1000});

    playLoop(this, 'intro_theme', {loop:true, volume:0.7});

    const start = () => this.scene.restart({currentMission:0, isIntro:false});
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);
    return;
  }

  playLoop(this, 'mission_theme', {loop:true, volume:0.7});
  document.getElementById('bg-cover').src = `assets/bg${this.currentMission+1}_1280x720.png`;

  this.jetskiSound = this.sound.add('jetski_loop', {loop:true, volume:0});
  this.jetskiSound.play();

  this.isFemale = Math.random() > 0.5;
  this.player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT/2, this.isFemale ? 'jetski_f' : 'jetski_m')
    .setSize(100,100);

  this.cursors = this.input.keyboard.createCursorKeys();

  const m = MISSIONS[this.currentMission];
  this.swimmers = this.physics.add.group();
  this.crooks = this.physics.add.group();
  this.time.addEvent({delay:m.swimmerDelay, callback:spawnSwimmer, callbackScope:this, loop:true});
  this.time.addEvent({delay:m.crookDelay, callback:spawnCrook, callbackScope:this, loop:true});

  if (this.currentMission >= 3) {
    this.sharks = this.physics.add.group();
    this.time.addEvent({delay:6000, callback:()=>spawnShark.call(this,'right'), loop:true});
    if (this.currentMission >= 4)
      this.time.addEvent({delay:7000, callback:()=>spawnShark.call(this,'left'), loop:true});
    this.physics.add.overlap(this.player, this.sharks, hitShark, null, this);
  }

  this.physics.add.overlap(this.player, this.swimmers, rescueSwimmer, null, this);
  this.physics.add.collider(this.player, this.crooks, catchCrook, null, this);

  const style = {fontSize:'24px', color:'#fff', fontStyle:'bold', fontFamily:'Arial'};
  this.missionLabel = this.add.text(40, 30, `MISSION ${this.currentMission+1}`, style);
  this.scoreLabel = this.add.text(GAME_WIDTH/2-80, 30, 'SCORE 0', style);
  this.timerLabel = this.add.text(GAME_WIDTH-180, 30, `${m.time}s`, style);
  this.goalLabel = this.add.text(40, 80, `Rescue ${m.rescued} + Catch ${m.caught}`, {fontSize:'20px', color:'#003366'});

  this.timeLeft = m.time;
  this.timerEvent = this.time.addEvent({
    delay:1000, loop:true, callback:()=>{
      this.timeLeft--;
      this.timerLabel.setText(`${this.timeLeft}s`);
      if (this.timeLeft <= 0) failMission.call(this);
    }
  });

  this.score = 0; this.rescued = 0; this.caught = 0;
  this.keys.r.on('down', () => hardReset(this));
  this.keys.esc.on('down', () => hardReset(this));
}

function update() {
  if (!this.player || !this.cursors) return;

  const moving = this.cursors.left.isDown || this.cursors.right.isDown ||
                 this.cursors.up.isDown || this.cursors.down.isDown;

  if (this.jetskiSound) {
    this.jetskiSound.volume += (moving ? 0.6 : 0 - this.jetskiSound.volume) * 0.1;
  }

  let vx = 0, vy = 0;
  if (this.cursors.left.isDown) { vx = -280; this.player.setTexture(this.isFemale?'jetski_f_left':'jetski_m_left'); }
  else if (this.cursors.right.isDown) { vx = 280; this.player.setTexture(this.isFemale?'jetski_f':'jetski_m'); }
  if (this.cursors.up.isDown) { vy = -280; this.player.setTexture(this.isFemale?'jetski_f_up':'jetski_m_up'); }
  else if (this.cursors.down.isDown) { vy = 280; this.player.setTexture(this.isFemale?'jetski_f_down':'jetski_m_down'); }

  this.player.setVelocity(vx, vy);

  const hw = this.player.displayWidth/2, hh = this.player.displayHeight/2;
  this.player.x = Phaser.Math.Clamp(this.player.x, hw, GAME_WIDTH - hw);
  this.player.y = Phaser.Math.Clamp(this.player.y, hh, GAME_HEIGHT - hh);
}

const MISSIONS = [
  {rescued:10,caught:3,time:60,swimmerDelay:1500,crookDelay:7000},
  {rescued:12,caught:5,time:55,swimmerDelay:1400,crookDelay:6000},
  {rescued:15,caught:8,time:50,swimmerDelay:1200,crookDelay:4000},
  {rescued:18,caught:10,time:45,swimmerDelay:1100,crookDelay:3000},
  {rescued:20,caught:14,time:40,swimmerDelay:1000,crookDelay:2000}
];

function ensureAudio(scene) {
  if (ensureAudio.done) return; ensureAudio.done = true;
  const resume = () => {
    try { scene.sound.unlock(); } catch(e){}
    try { const ctx = scene.sound.context; if (ctx && ctx.state !== 'running') ctx.resume(); } catch(e){}
  };
  document.addEventListener('rr-unlock-audio', resume, {once:true});
  scene.input.once('pointerdown', resume);
}

function playLoop(scene, key, cfg) { ensureAudio(scene); try { scene.sound.play(key, cfg); } catch(e) {} }

function hardReset(scene) {
  try { scene.sound.stopAll(); } catch(e){}
  setTimeout(() => { try { game.destroy(true); } catch(e){} game = null; window.startRescueRiders(); }, 100);
}

function showSplash(x,y) {
  const s = this.add.image(x,y,'splash').setScale(0.8);
  this.tweens.add({targets:s, alpha:0, duration:600, onComplete:()=>s.destroy()});
}

function popupScore(scene,x,y,text) {
  const t = scene.add.text(x,y,text,{fontSize:'24px',color:'#ffff88',fontStyle:'bold',stroke:'#000',strokeThickness:4}).setDepth(1000);
  scene.tweens.add({targets:t, y:y-40, alpha:0, duration:800, onComplete:()=>t.destroy()});
}

function rescueSwimmer(p,s) { s.destroy(); this.score+=10; this.rescued++; this.scoreLabel.setText(`SCORE ${this.score}`); this.sound.play('swimmer_spawn',{volume:0.7}); showSplash.call(this,s.x,s.y); popupScore(this,s.x,s.y,'+10'); checkMission.call(this); }
function catchCrook(p,c) { c.destroy(); this.score+=30; this.caught++; this.scoreLabel.setText(`SCORE ${this.score}`); this.sound.play('crook_spawn',{volume:0.7}); showSplash.call(this,c.x,c.y); popupScore(this,c.x,c.y,'+30'); checkMission.call(this); }

function spawnSwimmer() {
  const x = Phaser.Math.Between(80, GAME_WIDTH-80);
  const y = Phaser.Math.Between(80, GAME_HEIGHT-80);
  const tex = Math.random()>0.5 ? 'swimmer_m' : 'swimmer_f';
  const s = this.swimmers.create(x,y,tex);
  s.setVelocity(Phaser.Math.Between(-80,80), Phaser.Math.Between(-60,60)).setBounce(1,1).setSize(70,70);
}

function spawnCrook() {
  const side = Phaser.Math.Between(0,1);
  const y = Phaser.Math.Between(120, GAME_HEIGHT-120);
  let x, vx, tex;
  if (side===0) { x=-80; vx=Phaser.Math.Between(100,180); tex='crook'; }
  else { x=GAME_WIDTH+80; vx=Phaser.Math.Between(-180,-100); tex='crook_left'; }
  const c = this.crooks.create(x,y,tex);
  c.setVelocity(vx,0).setImmovable(true).setSize(100,100);
}

function spawnShark(dir='right') {
  const y = Phaser.Math.Between(140, GAME_HEIGHT-140);
  let x, vx, tex;
  if (dir==='right') { x=GAME_WIDTH+160; vx=Phaser.Math.Between(-280,-220); tex='shark'; }
  else { x=-160; vx=Phaser.Math.Between(220,280); tex='shark_right'; }
  const s = this.sharks.create(x,y,tex);
  s.setVelocity(vx,0).setImmovable(true).setSize(120,70);
  this.sound.play('shark_spawn',{volume:0.9});
  this.tweens.add({targets:s, y:y+Phaser.Math.Between(-20,20), duration:Phaser.Math.Between(2000,3000), ease:'Sine.easeInOut', yoyo:true, repeat:-1});
}

function hitShark(p,s) {
  s.destroy(); this.score = Math.max(0, this.score-30); this.scoreLabel.setText(`SCORE ${this.score}`);
  const flash = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0xff4444, 0.4).setDepth(1000);
  this.tweens.add({targets:flash, alpha:0, duration:400, onComplete:()=>flash.destroy()});
  showSplash.call(this,p.x,p.y); popupScore(this,p.x,p.y,'-30');
}

function checkMission() {
  const m = MISSIONS[this.currentMission];
  this.goalLabel.setText(`Rescue ${m.rescued} (${this.rescued}/${m.rescued}) + Catch ${m.caught} (${this.caught}/${m.caught})`);
  if (this.rescued >= m.rescued && this.caught >= m.caught) missionComplete.call(this);
}

function missionComplete() {
  if (this.timerEvent) this.timerEvent.remove();
  this.physics.pause(); this.sound.stopAll(); playLoop(this,'reward_theme',{loop:true,volume:0.8});
  const img = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, `reward16_${this.currentMission+1}`).setOrigin(0.5).setDepth(999);
  img.setScale(Math.min(GAME_WIDTH/img.width, GAME_HEIGHT/img.height));

  if (this.currentMission < MISSIONS.length-1) {
    const txt = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80, 'Press SPACE / ENTER / CLICK for next mission', {fontSize:'28px',color:'#fff',backgroundColor:'#000a'}).setOrigin(0.5).setDepth(1001);
    this.tweens.add({targets:txt, alpha:0.3, yoyo:true, repeat:-1, duration:1000});
    const next = () => this.scene.restart({currentMission:this.currentMission+1, isIntro:false});
    this.input.keyboard.once('keydown-SPACE', next);
    this.input.keyboard.once('keydown-ENTER', next);
    this.input.once('pointerdown', next);
  } else {
    this.sound.stopAll(); playLoop(this,'game_complete',{loop:true,volume:0.8});
    this.add.text(GAME_WIDTH/2, GAME_HEIGHT-150, 'GAME COMPLETE!', {fontSize:'36px',color:'#ffdd00',fontStyle:'bold'}).setOrigin(0.5).setDepth(1001);
    const txt = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80, 'Press R to play again', {fontSize:'26px',color:'#fff',backgroundColor:'#000a'}).setOrigin(0.5).setDepth(1001);
    this.tweens.add({targets:txt, alpha:0.3, yoyo:true, repeat:-1, duration:1000});
    document.addEventListener('keydown', e => { if (e.key==='r'||e.key==='R') hardReset(this); }, {once:true});
  }
}

function failMission() {
  if (this.timerEvent) this.timerEvent.remove();
  this.physics.pause(); this.sound.stopAll(); playLoop(this,'fail_theme',{loop:true,volume:0.8});
  const img = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'fail16').setOrigin(0.5).setDepth(999);
  img.setScale(Math.min(GAME_WIDTH/img.width, GAME_HEIGHT/img.height));
  const txt = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80, 'Press SPACE / ENTER / CLICK to retry', {fontSize:'28px',color:'#fff',backgroundColor:'#000a'}).setOrigin(0.5).setDepth(1001);
  this.tweens.add({targets:txt, alpha:0.3, yoyo:true, repeat:-1, duration:1000});
  const retry = () => this.scene.restart({currentMission:this.currentMission, isIntro:false});
  this.input.keyboard.once('keydown-SPACE', retry);
  this.input.keyboard.once('keydown-ENTER', retry);
  this.input.once('pointerdown', retry);
}

console.log('[RR] main.js pripravený');
