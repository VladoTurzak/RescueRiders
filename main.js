// Rescue Riders — Universal Mobile/Desktop (Improved Mobile Controls & Performance)
// Fixes: precise joystick (deadzone + smoothing), capped spawns on mobile, constant-speed movement, engine sfx only on move,
// fullscreen intro/reward/fail "contain", high-performance renderer, capped resolution for mobile perf.

// --- Persistent global state (survives scene restarts) ---
if (typeof window.rr_muted === 'undefined') window.rr_muted = false;

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
  // 🔧 render/perf
  render: { powerPreference: 'high-performance', antialias: true, roundPixels: true, transparent: false },
  resolution: 1, // cap DPR to 1 on mobile for performance
  fps: { target: 60, forceSetTimeOut: true },
  scene: [MainScene]
};

let game = new Phaser.Game(config);
game.scene.start('main', { isIntro: true });

// --- Helpers ---
function hardReset(sceneCtx) {
  try { if (sceneCtx.engineSfx) sceneCtx.engineSfx.stop(); sceneCtx.sound.stopAll(); } catch(e){}
  const pb = document.getElementById('rr-pause-btn');
  if (pb) pb.style.display = 'none';
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
  const sw = this.scale.width, sh = this.scale.height;
  const scale = Math.min(sw / iw, sh / ih);
  return this.add.image(sw / 2, sh / 2, key)
    .setOrigin(0.5).setDepth(depth).setScale(scale);
}

// Missions
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
  this.gender = data?.gender ?? window.rr_selectedGender ?? localStorage.getItem('rr_gender') ?? 'm';
  this.totalScore = data?.totalScore ?? 0;

  // 🔧 Mobile perf profile
  this.isMobilePerf = this.isTouch;
  this.MOBILE_SPAWN_SCALE = this.isMobilePerf ? 1.35 : 1.0;   // redšie spawny na mobile
  this.MAX_SWIMMERS = this.isMobilePerf ? 6 : 10;
  this.MAX_CROOKS   = this.isMobilePerf ? 3 : 6;

  // pohyb
  this.BASE_SPEED = 260;              // px/s
  this.MOBILE_SPEED = this.isMobilePerf ? 240 : this.BASE_SPEED;
}

function preload() {
  // Track loading progress for the overlay bar (only on first load, not restarts)
  if (!window.rr_assetsLoaded) {
    this.load.on('progress', v => {
      if (typeof window.updateLoadingProgress === 'function')
        window.updateLoadingProgress(Math.round(v * 100));
    });
  }
  this.load.image('hero', 'assets/hero_screen.png');
  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
   'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down']
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
  // ✅ GUARANTEED: hide loading overlay as soon as create() runs (after all assets loaded)
  window.rr_assetsLoaded = true;
  const _lo = document.getElementById('loading-overlay');
  if (_lo) _lo.style.display = 'none';

  this.offsetX = (config.width - GAME_WIDTH) / 2;
  this.offsetY = (config.height - GAME_HEIGHT) / 2;

  // --- Mute button (DOM, persists across scene restarts) ---
  let _muteBtn = document.getElementById('rr-mute-btn');
  if (!_muteBtn) {
    _muteBtn = document.createElement('button');
    _muteBtn.id = 'rr-mute-btn';
    _muteBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(0,0,0,0.65);color:#fff;border:2px solid rgba(255,255,255,0.45);border-radius:8px;padding:5px 11px;font-size:22px;cursor:pointer;touch-action:manipulation;';
    document.body.appendChild(_muteBtn);
    _muteBtn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      window.rr_muted = !window.rr_muted;
      _muteBtn.textContent = window.rr_muted ? '🔇' : '🔊';
      if (game?.sound) game.sound.setMute(window.rr_muted);
    });
  }
  _muteBtn.textContent = window.rr_muted ? '🔇' : '🔊';
  if (game?.sound) game.sound.setMute(window.rr_muted);

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

  // --- INTRO ---
  if (this.isIntro) {
    const _pb = document.getElementById('rr-pause-btn');
    if (_pb) _pb.style.display = 'none';
    placeFullscreenImage.call(this, 'hero', -10);
    const isMobile = this.isTouch;
    const introText = isMobile ? 'Tap to start' : 'Press SPACE / ENTER or CLICK to start';
    const press = this.add.text(this.scale.width/2, this.scale.height-80, introText,
      {fontSize: isMobile? '28px':'26px', color:'#fff', backgroundColor:'#000'}).setOrigin(0.5).setDepth(5);
    this.tweens.add({targets:press,alpha:0.2,yoyo:true,repeat:-1,duration:800});

    this.sound.stopAll();
    this.sound.add('intro_theme', { loop:true, volume:0.7 }).play();

    const startGame=()=>this.scene.restart({currentMission:0,isIntro:false,gender:this.gender,totalScore:0});
    this.input.keyboard.once('keydown-SPACE',startGame);
    this.input.keyboard.once('keydown-ENTER',startGame);
    this.input.once('pointerdown',startGame);
    return;
  }

  // --- MISSION MUSIC ---
  this.sound.stopAll();
  this.sound.add('mission_theme', { loop:true, volume:0.45 }).play();

  // engine sfx pripravený, nehrá
  this.engineSfx = this.sound.add('jetski_loop', { loop:true, volume:0.8 });

  const mission=MISSIONS[this.currentMission];
  const bgKey=`bg${this.currentMission+1}`;
  if(this.textures.exists(bgKey))
    this.add.image(config.width/2,config.height/2,bgKey).setOrigin(0.5).setDepth(-10).setDisplaySize(config.width,config.height);

  // --- Pause button (mobile, DOM) ---
  if (this.isTouch) {
    let _pauseBtn = document.getElementById('rr-pause-btn');
    if (!_pauseBtn) {
      _pauseBtn = document.createElement('button');
      _pauseBtn.id = 'rr-pause-btn';
      _pauseBtn.style.cssText = 'position:fixed;top:10px;right:64px;z-index:99999;background:rgba(0,0,0,0.65);color:#fff;border:2px solid rgba(255,255,255,0.45);border-radius:8px;padding:5px 11px;font-size:22px;cursor:pointer;touch-action:manipulation;display:none;';
      document.body.appendChild(_pauseBtn);
    }
    _pauseBtn.style.display = 'block';
    _pauseBtn.textContent = '⏸';
    this._pauseBtn = _pauseBtn;
    _pauseBtn.onclick = e => {
      e.stopPropagation();
      if (!this.gameStarted) return;
      this.isPaused = !this.isPaused;
      _pauseBtn.textContent = this.isPaused ? '▶️' : '⏸';
      if (this.isPaused) {
        this.physics.pause();
        if (this.timerEvent) this.timerEvent.paused = true;
        if (this.engineSfx?.isPlaying) this.engineSfx.pause();
        this.sound.pauseAll();
      } else {
        this.physics.resume();
        if (this.timerEvent) this.timerEvent.paused = false;
        this.sound.resumeAll();
      }
    };
  }

  // player
  this.isFemale = this.gender === 'f';
  const startTexture=this.isFemale?'jetski_f':'jetski_m';
  this.player=this.physics.add.sprite(
    this.offsetX+GAME_WIDTH/2,
    this.offsetY+GAME_HEIGHT/2,
    startTexture
  ).setCollideWorldBounds(false).setSize(100,100);

  // groups
  this.swimmers=this.physics.add.group();
  this.crooks=this.physics.add.group();

  // spawns (mobil = redšie)
  const swimDelay = Math.round(mission.swimmerDelay * this.MOBILE_SPAWN_SCALE);
  const crookDelay = Math.round(mission.crookDelay * this.MOBILE_SPAWN_SCALE);
  this.time.addEvent({delay:swimDelay, callback:spawnSwimmer, callbackScope:this, loop:true});
  this.time.addEvent({delay:crookDelay, callback:spawnCrook, callbackScope:this, loop:true});

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

  // panel
  const panelY=this.offsetY+10;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 800;
  const scaleFont = isSmall ? 1.2 : 1.0;
  const txt={fontSize:`${Math.round(22*scaleFont)}px`,color:'#fff',fontStyle:'bold',fontFamily:'Arial',shadow:{offsetX:1,offsetY:1,color:'#000',blur:3}};
  this.missionLabel=this.add.text(this.offsetX+30,panelY+12,`⭐ MISSION ${this.currentMission+1}/${MISSIONS.length}`,txt);
  this.scoreLabel=this.add.text(this.offsetX+GAME_WIDTH/2-60,panelY+12,`💯 SCORE 0`,txt);
  this.timerLabel=this.add.text(this.offsetX+GAME_WIDTH-150,panelY+12,`🕒 ${mission.time}s`,txt);
  if (this.totalScore > 0)
    this.add.text(this.offsetX+GAME_WIDTH-148,panelY+38,`🏆 TOTAL ${this.totalScore}`,
      {fontSize:'14px',color:'#ffcc00',fontFamily:'Arial',fontStyle:'bold'});
  this.goalLabel=this.add.text(this.offsetX+25,this.offsetY+65,`🎯 Rescue 0/${mission.rescued} + Catch 0/${mission.caught}`,
    {fontSize:`${Math.round(18*scaleFont)}px`,color:'#003366',fontStyle:'bold',fontFamily:'Arial'});

  // timer
  this.timeLeft=mission.time;
  this.timerEvent=this.time.addEvent({
    delay:1000,loop:true,
    callback:()=>{
      if (!this.gameStarted || this.isPaused) return;
      this.timeLeft--;
      this.timerLabel.setText(`🕒 ${this.timeLeft}s`);
      if (this.timeLeft <= 10 && !this.timerUrgent) {
        this.timerUrgent = true;
        this.timerLabel.setColor('#ff3333');
        this.tweens.add({ targets: this.timerLabel, alpha: 0.25, yoyo: true, repeat: -1, duration: 420 });
      }
      if (this.timeLeft <= 0) failMission.call(this);
    }
  });

  this.score=0;this.rescued=0;this.caught=0;
  this.gameStarted=false;
  this.isPaused=false;
  this.timerUrgent=false;

  // keys
  const onHardReset = (e) => { if (!e.repeat) hardReset(this); };
  this.keys.r.on('down', onHardReset);
  this.keys.esc.on('down', onHardReset);

  // controls
  this.cursors=this.input.keyboard.createCursorKeys();
  if (this.isTouch) createHandlebarJoystick.call(this);

  // 3-2-1 countdown before mission starts
  startCountdown.call(this);
}

function update(){
  if(!this.player || this.isPaused || !this.gameStarted)return;

  // dt (konzistentný pohyb)
  const dt = this.game.loop.delta / 1000;
  const speed = this.isTouch ? this.MOBILE_SPEED : this.BASE_SPEED;

  // keyboard
  if(!this.isTouch){
    let vx=0, vy=0;
    if(this.keys.left.isDown){vx=-speed; this.player.setTexture(this.isFemale?'jetski_f_left':'jetski_m_left');}
    else if(this.keys.right.isDown){vx= speed; this.player.setTexture(this.isFemale?'jetski_f':'jetski_m');}
    if(this.keys.up.isDown){vy=-speed; this.player.setTexture(this.isFemale?'jetski_f_up':'jetski_m_up');}
    else if(this.keys.down.isDown){vy= speed; this.player.setTexture(this.isFemale?'jetski_f_down':'jetski_m_down');}
    this.player.setVelocity(vx, vy);
  } else {
    // joystick (smoothed vector)
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

  // clamp
  const halfW=this.player.displayWidth/2, halfH=this.player.displayHeight/2;
  this.player.x=Phaser.Math.Clamp(this.player.x,this.offsetX+halfW,this.offsetX+GAME_WIDTH-halfW);
  this.player.y=Phaser.Math.Clamp(this.player.y,this.offsetY+halfH,this.offsetY+GAME_HEIGHT-halfH);

  // engine sound by speed
  if (this.engineSfx && this.player.body) {
    const v = this.player.body.velocity;
    const sp = Math.hypot(v.x||0, v.y||0);
    if (sp > 20) { if (!this.engineSfx.isPlaying) this.engineSfx.play(); }
    else { if (this.engineSfx.isPlaying) this.engineSfx.pause(); }
  }
}

// effects
function showSplash(x,y){const s=this.add.image(x,y,'splash').setScale(0.7);this.tweens.add({targets:s,alpha:0,duration:420,onComplete:()=>s.destroy()});}
function popupScore(scene,x,y,text){ const t=scene.add.text(x,y,text,{fontSize:'18px',color:'#ffff66',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(999);
  scene.tweens.add({targets:t,y:y-26,alpha:0,duration:600,onComplete:()=>t.destroy()}); }

// logic
function rescueSwimmer(player,swimmer){
  swimmer.destroy();
  this.score+=10;this.rescued++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('swimmer_spawn',{volume:0.6});
  showSplash.call(this,swimmer.x,swimmer.y); popupScore(this,swimmer.x,swimmer.y,'+10');
  checkMission.call(this);
}
function catchCrook(player,crook){
  crook.destroy();
  this.score+=30;this.caught++;
  this.scoreLabel.setText(`💯 SCORE ${this.score}`);
  this.sound.play('crook_spawn',{volume:0.6});
  showSplash.call(this,crook.x,crook.y); popupScore(this,crook.x,crook.y,'+30');
  checkMission.call(this);
}
function spawnSwimmer(){
  if (!this.gameStarted) return;
  if (this.swimmers.countActive(true) >= this.MAX_SWIMMERS) return;
  const x=Phaser.Math.Between(this.offsetX+50,this.offsetX+GAME_WIDTH-50);
  const y=Phaser.Math.Between(this.offsetY+50,this.offsetY+GAME_HEIGHT-50);
  const texture=Math.random()>0.5?'swimmer_m':'swimmer_f';
  const s=this.swimmers.create(x,y,texture);
  s.setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70);
}
function spawnCrook(){
  if (!this.gameStarted) return;
  if (this.crooks.countActive(true) >= this.MAX_CROOKS) return;
  const side=Phaser.Math.Between(0,1);
  const y=Phaser.Math.Between(this.offsetY+80,this.offsetY+GAME_HEIGHT-80);
  let texture,x,vx;
  if(side){x=this.offsetX-50;vx=Phaser.Math.Between(80,150);texture='crook';}
  else{x=this.offsetX+GAME_WIDTH+50;vx=Phaser.Math.Between(-150,-80);texture='crook_left';}
  const c=this.crooks.create(x,y,texture);
  c.setVelocity(vx,0).setImmovable(true).setSize(90,90);
}
function spawnShark(direction='right'){
  if (!this.gameStarted) return;
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
  const flash=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0xff0000,0.28).setDepth(999);
  this.tweens.add({targets:flash,alpha:0,duration:340,onComplete:()=>flash.destroy()});
  showSplash.call(this,player.x,player.y); popupScore(this,player.x,player.y,'-30');
}
function checkMission(){
  const mission=MISSIONS[this.currentMission];
  this.goalLabel.setText(`🎯 Rescue ${this.rescued}/${mission.rescued} + Catch ${this.caught}/${mission.caught}`);
  if(this.rescued>=mission.rescued&&this.caught>=mission.caught) missionComplete.call(this);
}
function missionComplete(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  if (this.engineSfx) this.engineSfx.stop();
  this.sound.stopAll();
  if (this._pauseBtn) this._pauseBtn.style.display = 'none';
  this.sound.add('reward_theme',{loop:true,volume:0.7}).play();

  const rewardKey = `reward${this.currentMission+1}`;
  placeFullscreenImage.call(this, rewardKey, 999);

  if(this.currentMission===MISSIONS.length-1){
    // 🎉 Final mission complete → play "game complete" fanfare instead of reward loop
    this.sound.stopAll();
    this.sound.add('game_complete',{loop:true,volume:0.7}).play();

    const nickname = localStorage.getItem('rr_nickname') || 'Player';
    const finalScore = this.totalScore + this.score;

    const _sw = this.scale.width, _sh = this.scale.height;
    const titleY = Math.max(120, _sh * 0.32);

    this.add.text(_sw / 2, titleY, '🏅 TOP RESCUE RIDERS 🏅',
      { fontSize:'24px', color:'#ffff66', fontStyle:'bold', stroke:'#000', strokeThickness:4 })
      .setOrigin(0.5).setDepth(1000);

    const loadingTxt = this.add.text(_sw / 2, titleY + 40,
      '⏳ Saving score & loading leaderboard...',
      { fontSize:'15px', color:'#aaaaaa' }).setOrigin(0.5).setDepth(1000);

    const _scene = this;

    // ── async: save online, fetch online, fallback to localStorage ──
    (async () => {
      // 1. Save to online leaderboard
      if (typeof window.rrSaveScore === 'function') {
        await window.rrSaveScore(nickname, finalScore);
      }

      // 2. Fetch online leaderboard
      let entries = [];
      if (typeof window.rrGetLeaderboard === 'function') {
        entries = await window.rrGetLeaderboard();
      }

      // 3. Fallback: localStorage (if Firebase not configured or offline)
      const isOnline = entries.length > 0;
      if (!isOnline) {
        let local = JSON.parse(localStorage.getItem('rr_leaderboard') || '[]');
        local.push({ name: nickname, score: finalScore, date: new Date().toISOString() });
        local.sort((a,b) => b.score - a.score);
        local = local.slice(0, 20);
        localStorage.setItem('rr_leaderboard', JSON.stringify(local));
        entries = local;
      }

      // 4. Render
      if (_scene.sys && !_scene.sys.isDestroyed) {
        loadingTxt.setText(isOnline ? '🌍 Global ranking:' : '💾 Local ranking:');
        entries.forEach((e, i) => {
          const isMine = e.name === nickname && e.score === finalScore && i === entries.findIndex(x => x.name===nickname && x.score===finalScore);
          _scene.add.text(_sw / 2, titleY + 60 + i * 24,
            `${(i+1).toString().padStart(2,'0')}. ${e.name} — ${e.score} pts`,
            { fontSize:'17px',
              color: isMine ? '#ffcc00' : '#ffffff',
              fontFamily:'Courier New',
              fontStyle: isMine ? 'bold' : 'normal' })
            .setOrigin(0.5).setDepth(1000);
        });
      }
    })();
    // ────────────────────────────────────────────────────────────

    const restartText = this.add.text(_sw / 2, _sh - 60,
      'Press R (or Tap) to restart the game',
      { fontSize: '22px', color: '#fff', backgroundColor: '#000' })
      .setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: restartText, alpha: 0.2, yoyo: true, repeat: -1, duration: 800 });
    const restartHandler = () => { document.removeEventListener('pointerdown', restartHandler); hardReset(this); };
    document.addEventListener('pointerdown', restartHandler);
    this.keys.r.once('down', restartHandler);
  } else {
    const next=()=>this.scene.restart({currentMission:this.currentMission+1,isIntro:false,gender:this.gender,totalScore:this.totalScore+this.score});
    const t=this.add.text(this.scale.width/2,this.scale.height-60,'Press SPACE / ENTER / TAP for next mission',
      {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
    this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
    this.input.keyboard.once('keydown-SPACE',next);
    this.input.keyboard.once('keydown-ENTER',next);
    this.input.once('pointerdown',next);
  }
}
function failMission(){
  if(this.timerEvent) this.timerEvent.remove();
  this.physics.pause();
  if (this.engineSfx) this.engineSfx.stop();
  this.sound.stopAll();
  if (this._pauseBtn) this._pauseBtn.style.display = 'none';
  this.sound.add('fail_theme',{loop:true,volume:0.7}).play();
  placeFullscreenImage.call(this, 'fail', 999);
  const retry=()=>this.scene.restart({currentMission:this.currentMission,isIntro:false,gender:this.gender,totalScore:this.totalScore});
  const t=this.add.text(this.scale.width/2,this.scale.height-60,'Press SPACE / ENTER / TAP to retry',
    {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000);
  this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800});
  this.input.keyboard.once('keydown-SPACE',retry);
  this.input.keyboard.once('keydown-ENTER',retry);
  this.input.once('pointerdown',retry);
}

// --- 3-2-1 Countdown before mission starts ---
function startCountdown() {
  const sw = this.scale.width, sh = this.scale.height;
  const overlay = this.add.rectangle(sw/2, sh/2, sw, sh, 0x000000, 0.6).setDepth(3000);
  const txt = this.add.text(sw/2, sh/2, '3',
    { fontSize:'120px', color:'#ffcc00', fontStyle:'bold', stroke:'#000', strokeThickness:10 })
    .setOrigin(0.5).setDepth(3001);
  const labels = ['3','2','1','GO! 🚀'];
  const colors = ['#ffcc00','#ff8800','#ff3333','#00ff88'];
  let step = 0;
  const tick = () => {
    txt.setText(labels[step]).setColor(colors[step]);
    txt.setScale(1.4);
    this.tweens.add({ targets: txt, scaleX: 1.0, scaleY: 1.0, duration: 700, ease: 'Back.easeOut' });
    step++;
    if (step < labels.length) {
      this.time.delayedCall(900, tick);
    } else {
      this.tweens.add({ targets: [overlay, txt], alpha: 0, duration: 500, delay: 350, onComplete: () => {
        overlay.destroy(); txt.destroy();
        this.gameStarted = true;
      }});
    }
  };
  tick();
}

// --- Mobile joystick (handlebars): deadzone + smoothing + pointer lock ---
function createHandlebarJoystick(){
  const isSmallScreen = this.scale.width < 430;
  const pad = Math.min(this.scale.width, this.scale.height) * (isSmallScreen ? 0.06 : 0.08);
  const baseX = pad + (isSmallScreen ? 100 : 180);
  const baseY = this.scale.height - pad - (isSmallScreen ? 72 : 120);

  const joyScale = isSmallScreen ? 1.3 : 1.0;
  const base = this.add.image(baseX, baseY, 'handle_base').setDepth(1001).setAlpha(0.9).setScale(0.9 * joyScale);
  const knob = this.add.image(baseX, baseY, 'handle_knob').setDepth(1002).setAlpha(0.98).setScale(0.8 * joyScale);

  const RADIUS = isSmallScreen ? 108 : 84;
  const DEADZONE = 0.18;       // presnejší stred
  const SMOOTH = 0.22;         // low-pass filter (0..1)

  let activePointerId = null;
  let rawVec = {x:0,y:0};
  this.joyVecSmoothed = null;

  const applyDeadzone = (x,y) => {
    const len = Math.hypot(x,y);
    if (len < DEADZONE) return {x:0,y:0};
    const k = (len - DEADZONE) / (1 - DEADZONE);
    const nx = (x/len) * k, ny = (y/len) * k;
    return {x:nx, y:ny};
  };

  const updateVec = (pointer) => {
    if (activePointerId !== null && activePointerId !== pointer.id) return;
    const dx = pointer.x - base.x;
    const dy = pointer.y - base.y;
    const len = Math.hypot(dx,dy) || 1;
    const nx = dx / len, ny = dy / len;
    const clampedLen = Math.min(len, RADIUS);
    knob.x = base.x + nx * clampedLen;
    knob.y = base.y + ny * clampedLen;

    const vx = clampedLen / RADIUS * nx;
    const vy = clampedLen / RADIUS * ny;
    rawVec = applyDeadzone(vx, vy);

    // vizuálny „tilt“
    const tilt = Phaser.Math.Clamp(dx / 220, -0.35, 0.35);
    base.setRotation(tilt);
  };

  const resetJoy = () => {
    activePointerId = null;
    this.tweens.add({targets: knob, x: base.x, y: base.y, duration: 120, ease: 'Sine.easeOut'});
    base.setRotation(0);
    rawVec = {x:0,y:0};
  };

  // smoothing tick
  this.time.addEvent({
    delay: 16, loop: true,
    callback: () => {
      const cur = this.joyVecSmoothed || {x:0,y:0};
      this.joyVecSmoothed = {
        x: cur.x + (rawVec.x - cur.x) * SMOOTH,
        y: cur.y + (rawVec.y - cur.y) * SMOOTH
      };
      if (Math.abs(this.joyVecSmoothed.x) < 0.01 && Math.abs(this.joyVecSmoothed.y) < 0.01) {
        this.joyVecSmoothed = null; // úplný kľud
      }
    }
  });

  this.input.on('pointerdown', (p)=>{ if (activePointerId===null){ activePointerId=p.id; updateVec(p); } });
  this.input.on('pointermove', (p)=>{ if(p.isDown && p.id===activePointerId) updateVec(p); });
  this.input.on('pointerup',   (p)=>{ if(p.id===activePointerId) resetJoy(); });
}

// keep canvas fit on resize
window.addEventListener('resize', () => {
  if (!game) return;
  game.scale.resize(window.innerWidth, window.innerHeight);
});
