console.log('[RR] main.js načítané');

// === KONFIG ===
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
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

// === ŠTART HRY ===
window.startRescueRiders = function() {
  console.log('[RR] startRescueRiders volané');
  if (game) {
    console.log('[RR] Hra už beží');
    return;
  }

  // Delay pre stabilný Phaser
  setTimeout(() => {
    console.log('[RR] Vytváram Phaser.Game...');
    game = new Phaser.Game(config);
    
    setTimeout(() => {
      console.log('[RR] Štartujem scénu...');
      if (game && game.scene) {
        game.scene.start('main', { isIntro: true });
      }
      
      // Finálny scale refresh
      setTimeout(() => {
        if (game && game.scale) {
          game.scale.refresh();
          console.log('[RR] Scale refresh OK - hra spustená!');
        }
      }, 300);
    }, 300);
  }, 300);
};

// === RESIZE HANDLER ===
let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (game && game.scale) {
      game.scale.refresh();
      console.log('[RR] Resize refresh');
    }
  }, 100);
}

// VisualViewport pre mobil (address bar)
if (window.visualViewport) {
  visualViewport.addEventListener('resize', handleResize);
  visualViewport.addEventListener('scroll', handleResize);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 400));

// === SCÉNA ===
function init(data) {
  this.currentMission = data?.currentMission ?? 0;
  this.isIntro = data?.isIntro ?? false;
}

function preload() {
  console.log('[RR] Preload začatý');
  
  // Intro/fail/reward screens
  this.load.image('hero16', 'assets/hero_screen_1280x720.png');
  this.load.image('fail16', 'assets/fail_1280x720.png');
  for (let i = 1; i <= 5; i++) {
    this.load.image(`reward16_${i}`, `assets/reward${i}_1280x720.png`);
  }

  // Sprites
  const sprites = [
    'jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
    'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
    'swimmer_m','swimmer_f','crook','crook_left','splash',
    'shark','shark_right'
  ];
  sprites.forEach(key => this.load.image(key, `assets/${key}.png`));

  // Audio
  const audios = [
    'intro_theme','mission_theme','reward_theme','fail_theme','game_complete',
    'jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'
  ];
  audios.forEach(key => {
    const ext = key.includes('spawn') ? 'wav' : 'mp3';
    this.load.audio(key, `assets/audio/${key}.${ext}`);
  });
}

function create() {
  console.log('[RR] Create - isIntro:', this.isIntro);
  
  // Audio unlock
  ensureAudio(this);
  
  // Keys
  this.keys = this.input.keyboard.addKeys({
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
    esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    r: Phaser.Input.Keyboard.KeyCodes.R
  });

  // Scale refresh
  this.scale.refresh();

  if (this.isIntro) {
    // Hero screen
    const bg = document.getElementById('bg-cover');
    if (bg) bg.src = 'assets/hero_screen_1280x720.png';

    const hero = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'hero16').setOrigin(0.5);
    hero.setScale(Math.min(GAME_WIDTH/hero.width, GAME_HEIGHT/hero.height));

    const press = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80,
      'Press SPACE / ENTER or CLICK to start',
      {fontSize:'28px', color:'#fff', backgroundColor:'#000a'}).setOrigin(0.5);
    this.tweens.add({
      targets: press, 
      alpha: { from: 1, to: 0.3 }, 
      yoyo: true, repeat: -1, duration: 1000
    });

    playLoop(this, 'intro_theme', {loop:true, volume:0.7});
    
    const startGame = () => {
      console.log('[RR] Intro start!');
      this.scene.restart({currentMission:0, isIntro:false});
    };
    this.input.keyboard.once('keydown-SPACE', startGame);
    this.input.keyboard.once('keydown-ENTER', startGame);
    this.input.once('pointerdown', startGame);
    return;
  }

  // === MISSION START ===
  playLoop(this, 'mission_theme', {loop:true, volume:0.7});

  const bg = document.getElementById('bg-cover');
  if (bg) bg.src = `assets/bg${this.currentMission+1}_1280x720.png`;

  // Jetski sound
  this.jetskiSound = this.sound.add('jetski_loop', {loop:true, volume:0});
  try { this.jetskiSound.play(); } catch(e) {}

  // Player
  this.isFemale = Math.random() > 0.5;
  const tex = this.isFemale ? 'jetski_f' : 'jetski_m';
  this.player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT-200, tex)
    .setCollideWorldBounds(false).setSize(100,100);

  this.cursors = this.input.keyboard.createCursorKeys();

  // Mission data
  const m = MISSIONS[this.currentMission];
  this.swimmers = this.physics.add.group();
  this.crooks = this.physics.add.group();
  
  this.time.addEvent({
    delay: m.swimmerDelay, 
    callback: spawnSwimmer, 
    callbackScope: this, 
    loop: true
  });
  this.time.addEvent({
    delay: m.crookDelay, 
    callback: spawnCrook, 
    callbackScope: this, 
    loop: true
  });

  // Sharks (misie 3+)
  if (this.currentMission >= 3) {
    this.sharks = this.physics.add.group();
    this.time.addEvent({
      delay: 6000, 
      callback: () => spawnShark.call(this, 'right'), 
      loop: true
    });
    if (this.currentMission >= 4) {
      this.time.addEvent({
        delay: 7000, 
        callback: () => spawnShark.call(this, 'left'), 
        loop: true
      });
    }
    this.physics.add.overlap(this.player, this.sharks, hitShark, null, this);
  }

  // Collisions
  this.physics.add.overlap(this.player, this.swimmers, rescueSwimmer, null, this);
  this.physics.add.collider(this.player, this.crooks, catchCrook, null, this);

  // UI
  const txtStyle = {
    fontSize: '24px', 
    color: '#fff', 
    fontStyle: 'bold', 
    fontFamily: 'Arial',
    shadow: {offsetX: 2, offsetY: 2, color: '#000', blur: 4}
  };
  this.missionLabel = this.add.text(40, 30, `⭐ MISSION ${this.currentMission+1}`, txtStyle);
  this.scoreLabel = this.add.text(GAME_WIDTH/2-80, 30, '💯 SCORE 0', txtStyle);
  this.timerLabel = this.add.text(GAME_WIDTH-180, 30, `🕒 ${m.time}s`, txtStyle);
  this.goalLabel = this.add.text(40, 80, `🎯 Rescue ${m.rescued} + Catch ${m.caught}`,
    {fontSize: '20px', color: '#003366', fontStyle: 'bold', fontFamily: 'Arial'});

  // Timer
  this.timeLeft = m.time;
  this.timerEvent = this.time.addEvent({
    delay: 1000, 
    loop: true, 
    callback: () => {
      this.timeLeft--;
      this.timerLabel.setText(`🕒 ${this.timeLeft}s`);
      if (this.timeLeft <= 0) failMission.call(this);
    }
  });

  this.score = 0;
  this.rescued = 0;
  this.caught = 0;

  // Hard reset
  const onHardReset = (e) => { if (!e.repeat) hardReset(this); };
  this.keys.r.on('down', onHardReset);
  this.keys.esc.on('down', onHardReset);

  console.log('[RR] Mission', this.currentMission+1, 'začatá!');
}

// === UPDATE ===
function update() {
  if (!this.player || !this.cursors) return;

  const moving = this.cursors.left.isDown || this.cursors.right.isDown ||
                 this.cursors.up.isDown || this.cursors.down.isDown;
  
  if (this.jetskiSound) {
    const targetVol = moving ? 0.6 : 0;
    this.jetskiSound.volume += (targetVol - this.jetskiSound.volume) * 0.1;
  }

  let vx = 0, vy = 0;
  if (this.cursors.left.isDown) {
    vx = -280;
    this.player.setTexture(this.isFemale ? 'jetski_f_left' : 'jetski_m_left');
  } else if (this.cursors.right.isDown) {
    vx = 280;
    this.player.setTexture(this.isFemale ? 'jetski_f' : 'jetski_m');
  }
  if (this.cursors.up.isDown) {
    vy = -280;
    this.player.setTexture(this.isFemale ? 'jetski_f_up' : 'jetski_m_up');
  } else if (this.cursors.down.isDown) {
    vy = 280;
    this.player.setTexture(this.isFemale ? 'jetski_f_down' : 'jetski_m_down');
  }

  this.player.setVelocity(vx, vy);

  // Bounds
  const hw = this.player.displayWidth / 2;
  const hh = this.player.displayHeight / 2;
  this.player.x = Phaser.Math.Clamp(this.player.x, hw, GAME_WIDTH - hw);
  this.player.y = Phaser.Math.Clamp(this.player.y, hh, GAME_HEIGHT - hh);
}

// === GAME LOGIC ===
const MISSIONS = [
  { rescued:10, caught:3, time:60, swimmerDelay:1500, crookDelay:7000 },
  { rescued:12, caught:5, time:55, swimmerDelay:1400, crookDelay:6000 },
  { rescued:15, caught:8, time:50, swimmerDelay:1200, crookDelay:4000 },
  { rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
  { rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];

function ensureAudio(scene) {
  if (ensureAudio._done) return;
  ensureAudio._done = true;
  
  const resume = () => {
    try { scene.sound.unlock(); } catch(e) {}
    try { 
      const ctx = scene.sound.context; 
      if (ctx && ctx.state !== 'running') ctx.resume(); 
    } catch(e) {}
  };
  
  ['pointerdown','touchstart','click','keydown'].forEach(ev => {
    document.addEventListener(ev, resume, {once: true});
  });
  scene.input.once('pointerdown', resume);
  scene.input.keyboard.once('keydown', resume);
}

function playLoop(scene, key, cfg) {
  ensureAudio(scene);
  try { scene.sound.play(key, cfg); } catch(e) {}
}

function hardReset(sceneCtx) {
  try {
    sceneCtx.sound.stopAll();
    if (sceneCtx.jetskiSound) sceneCtx.jetskiSound.stop();
  } catch(e) {}
  
  setTimeout(() => {
    try { game.destroy(true); } catch(e) {}
    game = null;
    window.startRescueRiders();
  }, 100);
}

function showSplash(x, y) {
  const splash = this.add.image(x, y, 'splash').setScale(0.8);
  this.tweens.add({
    targets: splash,
    alpha: 0,
    duration: 600,
    onComplete: () => splash.destroy()
  });
}

function popupScore(scene, x, y, text) {
  const popup = scene.add.text(x, y, text, {
    fontSize: '24px',
    color: '#ffff88',
    fontStyle: 'bold',
    stroke: '#000',
    strokeThickness: 4
  }).setDepth(1000);
  
  scene.tweens.add({
    targets: popup,
    y: y - 40,
    alpha: 0,
    duration: 800,
    onComplete: () => popup.destroy()
  });
}

function rescueSwimmer(player, swimmer) {
  swimmer.destroy();
  this.score += 10;
  this.rescued++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  
  this.sound.play('swimmer_spawn', {volume: 0.7});
  showSplash.call(this, swimmer.x, swimmer.y);
  popupScore(this, swimmer.x, swimmer.y, '+10');
  checkMission.call(this);
}

function catchCrook(player, crook) {
  crook.destroy();
  this.score += 30;
  this.caught++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  
  this.sound.play('crook_spawn', {volume: 0.7});
  showSplash.call(this, crook.x, crook.y);
  popupScore(this, crook.x, crook.y, '+30');
  checkMission.call(this);
}

function spawnSwimmer() {
  const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
  const y = Phaser.Math.Between(80, GAME_HEIGHT - 80);
  const texture = Math.random() > 0.5 ? 'swimmer_m' : 'swimmer_f';
  
  const swimmer = this.swimmers.create(x, y, texture);
  swimmer.setVelocity(
    Phaser.Math.Between(-80, 80),
    Phaser.Math.Between(-60, 60)
  ).setBounce(1, 1).setSize(70, 70);
}

function spawnCrook() {
  const side = Phaser.Math.Between(0, 1);
  const y = Phaser.Math.Between(120, GAME_HEIGHT - 120);
  
  let x, vx, texture;
  if (side === 0) {
    x = -80;
    vx = Phaser.Math.Between(100, 180);
    texture = 'crook';
  } else {
    x = GAME_WIDTH + 80;
    vx = Phaser.Math.Between(-180, -100);
    texture = 'crook_left';
  }
  
  const crook = this.crooks.create(x, y, texture);
  crook.setVelocity(vx, 0).setImmovable(true).setSize(100, 100);
}

function spawnShark(dir = 'right') {
  const y = Phaser.Math.Between(140, GAME_HEIGHT - 140);
  let x, vx, texture;
  
  if (dir === 'right') {
    x = GAME_WIDTH + 160;
    vx = Phaser.Math.Between(-280, -220);
    texture = 'shark';
  } else {
    x = -160;
    vx = Phaser.Math.Between(220, 280);
    texture = 'shark_right';
  }
  
  const shark = this.sharks.create(x, y, texture);
  shark.setVelocity(vx, 0).setImmovable(true).setSize(120, 70);
  
  this.sound.play('shark_spawn', {volume: 0.9});
  
  this.tweens.add({
    targets: shark,
    y: y + Phaser.Math.Between(-20, 20),
    duration: Phaser.Math.Between(2000, 3000),
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1
  });
}

function hitShark(player, shark) {
  shark.destroy();
  this.score = Math.max(0, this.score - 30);
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  
  // Flash efekt
  const flash = this.add.rectangle(
    GAME_WIDTH/2, GAME_HEIGHT/2, 
    GAME_WIDTH, GAME_HEIGHT, 
    0xff4444, 0.4
  ).setDepth(1000);
  
  this.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 400,
    onComplete: () => flash.destroy()
  });
  
  showSplash.call(this, player.x, player.y);
  popupScore(this, player.x, player.y, '-30');
}

function checkMission() {
  const m = MISSIONS[this.currentMission];
  this.goalLabel.setText(
    `🎯 Rescue ${m.rescued} (${this.rescued}/${m.rescued}) + Catch ${m.caught} (${this.caught}/${m.caught})`
  );
  
  if (this.rescued >= m.rescued && this.caught >= m.caught) {
    missionComplete.call(this);
  }
}

function missionComplete() {
  if (this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  this.sound.stopAll();
  
  playLoop(this, 'reward_theme', {loop:true, volume:0.8});

  const rewardKey = `reward16_${this.currentMission+1}`;
  const rewardImg = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, rewardKey)
    .setOrigin(0.5).setDepth(999);
  rewardImg.setScale(Math.min(GAME_WIDTH/rewardImg.width, GAME_HEIGHT/rewardImg.height));

  const nextMission = () => this.scene.restart({
    currentMission: this.currentMission + 1,
    isIntro: false
  });

  if (this.currentMission < MISSIONS.length - 1) {
    const nextText = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80,
      'Press SPACE / ENTER / CLICK for next mission',
      {fontSize: '28px', color:'#fff', backgroundColor:'#000a'}
    ).setOrigin(0.5).setDepth(1001);
    
    this.tweens.add({
      targets: nextText,
      alpha: {from:1, to:0.3},
      yoyo: true,
      repeat: -1,
      duration: 1000
    });
    
    this.input.keyboard.once('keydown-SPACE', nextMission);
    this.input.keyboard.once('keydown-ENTER', nextMission);
    this.input.once('pointerdown', nextMission);
  } else {
    // GAME COMPLETE
    this.sound.stopAll();
    playLoop(this, 'game_complete', {loop:true, volume:0.8});
    
    this.add.text(GAME_WIDTH/2, GAME_HEIGHT-150,
      '🏆 GAME COMPLETE! 🏆',
      {fontSize: '36px', color:'#ffdd00', fontStyle:'bold'}
    ).setOrigin(0.5).setDepth(1001);
    
    const restartText = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80,
      'Press R to play again',
      {fontSize: '26px', color:'#fff', backgroundColor:'#000a'}
    ).setOrigin(0.5).setDepth(1001);
    
    this.tweens.add({
      targets: restartText,
      alpha: {from:1, to:0.3},
      yoyo: true,
      repeat: -1,
      duration: 1000
    });
    
    const restartHandler = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        document.removeEventListener('keydown', restartHandler);
        hardReset(this);
      }
    };
    document.addEventListener('keydown', restartHandler);
  }
}

function failMission() {
  if (this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  this.sound.stopAll();
  
  playLoop(this, 'fail_theme', {loop:true, volume:0.8});

  const failImg = this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'fail16')
    .setOrigin(0.5).setDepth(999);
  failImg.setScale(Math.min(GAME_WIDTH/failImg.width, GAME_HEIGHT/failImg.height));

  const retryMission = () => this.scene.restart({
    currentMission: this.currentMission,
    isIntro: false
  });

  const retryText = this.add.text(GAME_WIDTH/2, GAME_HEIGHT-80,
    'Press SPACE / ENTER / CLICK to retry',
    {fontSize: '28px', color:'#fff', backgroundColor:'#000a'}
  ).setOrigin(0.5).setDepth(1001);
  
  this.tweens.add({
    targets: retryText,
    alpha: {from:1, to:0.3},
    yoyo: true,
    repeat: -1,
    duration: 1000
  });
  
  this.input.keyboard.once('keydown-SPACE', retryMission);
  this.input.keyboard.once('keydown-ENTER', retryMission);
  this.input.once('pointerdown', retryMission);
}

console.log('[RR] main.js načítané kompletne');
