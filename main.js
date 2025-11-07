// Rescue Riders — Desktop-identický render: 4:3 canvas (900×600) + 16:9 mission BG za canvasom
const GW = 900, GH = 600;

const MainScene = { key:'main', preload, create, update, init };

const config = {
  type: Phaser.AUTO,
  parent: 'stage',              // <div id="stage"> v indexe
  width: GW,                    // LOGICKÁ veľkosť hry pevná 900×600
  height: GH,
  backgroundColor: 0x000000,    // prekryje ho mission BG za canvasom (body background)
  physics: { default:'arcade', arcade:{ debug:false } },
  scene: [MainScene]
};

let game = new Phaser.Game(config);
game.scene.start('main', { isIntro:true });

/* =============== Helpers =============== */
// nastav 16:9 cover pozadie na <body> podľa kľúča (bg1..bg5 alebo hero/fail/reward*)
function setBodyBG(key){
  document.body.style.backgroundImage = key ? `url("assets/${key}.png")` : 'none';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundRepeat = 'no-repeat';
}

// fullscreen FIT obrázok (v rámci 900×600) – používame pre intro / reward / fail vo vnútri canvasu
function fitImage(scene, key){
  const img = scene.add.image(GW/2, GH/2, key).setOrigin(0.5);
  const scale = Math.min(GW/img.width, GH/img.height);
  img.setScale(scale);
  return img;
}

// bezpečný audio unlock
function playSafe(scene, key, cfg){ const p=()=>scene.sound.play(key, cfg); if(scene.sound.locked) scene.sound.once('unlocked', p); else p(); }

/* =============== Data =============== */
const MISSIONS = [
  { rescued:10, caught:3,  time:60, swimmerDelay:1500, crookDelay:7000 },
  { rescued:12, caught:5,  time:55, swimmerDelay:1400, crookDelay:6000 },
  { rescued:15, caught:8,  time:50, swimmerDelay:1200, crookDelay:4000 },
  { rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
  { rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];

/* =============== Scene =============== */
function init(d){ this.mi = d?.currentMission ?? 0; this.isIntro = d?.isIntro ?? false; }

function preload(){
  // gameplay assets (900×600 logika)
  ['hero','fail',
   'jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
   'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
   'swimmer_m','swimmer_f','crook','crook_left','splash',
   'shark','shark_right'
  ].forEach(k=>this.load.image(k,`assets/${k}.png`));

  for(let i=1;i<=5;i++){ this.load.image(`reward${i}`,`assets/reward${i}.png`); }

  // audio
  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete','jetski_loop','swimmer_spawn','crook_spawn','shark_spawn']
    .forEach(a=>this.load.audio(a,`assets/audio/${a}.${a.includes('spawn')?'wav':'mp3'}`));
}

function create(){
  // odomkni audio
  if(this.sound.locked) this.sound.unlock();

  // klávesy
  this.keys = this.input.keyboard.addKeys({
    SPACE:Phaser.Input.Keyboard.KeyCodes.SPACE,
    ENTER:Phaser.Input.Keyboard.KeyCodes.ENTER,
    ESC:Phaser.Input.Keyboard.KeyCodes.ESC,
    R:Phaser.Input.Keyboard.KeyCodes.R
  });

  // ===== Intro (v canvas 900×600), BG = hero cez body =====
  if(this.isIntro){
    setBodyBG('hero_screen');            // 16:9 cover za canvasom
    fitImage(this,'hero');               // intro art vo vnútri 4:3
    const t=this.add.text(GW/2, GH-60, 'Press SPACE / ENTER or CLICK to start',
      {fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5);
    this.tweens.add({targets:t,alpha:.2,yoyo:true,repeat:-1,duration:800});
    this.sound.stopAll(); playSafe(this,'intro_theme',{loop:true,volume:0.7});

    const start=()=>this.scene.restart({currentMission:0,isIntro:false});
    this.input.keyboard.once('keydown-SPACE',start);
    this.input.keyboard.once('keydown-ENTER',start);
    this.input.once('pointerdown',start);
    return;
  }

  // ===== Mission (canvas stále 900×600), BG = bg{mi+1} cez body =====
  setBodyBG(`bg${this.mi+1}`);          // 16:9 cover za canvasom
  this.sound.stopAll(); playSafe(this,'mission_theme',{loop:true,volume:0.7});
  this.jet = this.sound.add('jetski_loop',{loop:true,volume:0}); this.jet.play();

  // Player (clamp striktne v 900×600)
  this.isF = Math.random()>0.5;
  const startTex = this.isF ? 'jetski_f' : 'jetski_m';
  this.p = this.physics.add.sprite(GW/2, GH/2, startTex).setCollideWorldBounds(false).setSize(100,100);
  this.curs = this.input.keyboard.createCursorKeys();

  // Groups & timers
  const m = MISSIONS[this.mi];
  this.sw = this.physics.add.group();
  this.cr = this.physics.add.group();
  this.time.addEvent({delay:m.swimmerDelay, callback:spawnSwimmer, callbackScope:this, loop:true});
  this.time.addEvent({delay:m.crookDelay,   callback:spawnCrook,   callbackScope:this, loop:true});

  if(this.mi>=3){
    this.sh = this.physics.add.group();
    this.time.addEvent({delay:6000, callback:()=>spawnShark.call(this,'right'), loop:true});
    if(this.mi>=4) this.time.addEvent({delay:7000, callback:()=>spawnShark.call(this,'left'),  loop:true});
    this.physics.add.overlap(this.p, this.sh, hitShark, null, this);
  }
  this.physics.add.overlap(this.p, this.sw, rescue, null, this);
  this.physics.add.collider(this.p, this.cr, capture, null, this);

  // UI (vždy v 900×600 – nikdy sa nestratí)
  const txt={fontSize:'22px',color:'#fff',fontStyle:'bold',fontFamily:'Arial',shadow:{offsetX:1,offsetY:1,color:'#000',blur:3}};
  this.uMission=this.add.text(30, 22, `⭐ MISSION ${this.mi+1}`, txt);
  this.uScore  =this.add.text(GW/2-60, 22, `💯 SCORE 0`, txt);
  this.uTimer  =this.add.text(GW-150, 22, `🕒 ${m.time}s`, txt);
  this.uGoal   =this.add.text(25, 65, `🎯 Rescue ${m.rescued} + Catch ${m.caught}`,
                 {fontSize:'18px',color:'#003366',fontStyle:'bold',fontFamily:'Arial'});

  this.timeLeft = m.time;
  this.timer = this.time.addEvent({ delay:1000, loop:true, callback:()=>{
    this.timeLeft--; this.uTimer.setText(`🕒 ${this.timeLeft}s`);
    if(this.timeLeft<=0) fail.call(this);
  }});

  this.score=0; this.rescued=0; this.caught=0;

  const hard=(e)=>{ if(!e.repeat) resetAll(this); };
  this.keys.R.on('down',hard); this.keys.ESC.on('down',hard);
}

function update(){
  if(!this.p||!this.curs) return;

  // motor – len pri pohybe
  const moving = this.curs.left.isDown||this.curs.right.isDown||this.curs.up.isDown||this.curs.down.isDown;
  if(this.jet){ const target = moving?0.55:0.0; this.jet.volume += (target - this.jet.volume)*0.08; }

  let vx=0, vy=0;
  if(this.curs.left.isDown){ vx-=250; this.p.setTexture(this.isF?'jetski_f_left':'jetski_m_left'); }
  else if(this.curs.right.isDown){ vx+=250; this.p.setTexture(this.isF?'jetski_f':'jetski_m'); }
  if(this.curs.up.isDown){ vy-=250; this.p.setTexture(this.isF?'jetski_f_up':'jetski_m_up'); }
  else if(this.curs.down.isDown){ vy+=250; this.p.setTexture(this.isF?'jetski_f_down':'jetski_m_down'); }

  this.p.setVelocity(vx,vy);

  // STRIKTNY clamp v 900×600 → nikdy nevylezie mimo zorné pole
  const hw=this.p.displayWidth/2, hh=this.p.displayHeight/2;
  this.p.x = Phaser.Math.Clamp(this.p.x, hw, GW-hw);
  this.p.y = Phaser.Math.Clamp(this.p.y, hh, GH-hh);
}

/* =============== Gameplay helpers =============== */
function resetAll(sc){
  try{ sc.sound.stopAll(); if(sc.jet) sc.jet.stop(); }catch(e){}
  setTimeout(()=>{ try{game.destroy(true)}catch(e){}; game = new Phaser.Game(config); game.scene.start('main',{isIntro:true}); },40);
}

function splash(x,y){ const sp=this.add.image(x,y,'splash').setScale(.7); this.tweens.add({targets:sp,alpha:0,duration:500,onComplete:()=>sp.destroy()}); }
function popup(x,y,text){ const t=this.add.text(x,y,text,{fontSize:'18px',color:'#ffff66',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(999); this.tweens.add({targets:t,y:y-30,alpha:0,duration:700,onComplete:()=>t.destroy()}); }

function rescue(p,sw){ sw.destroy(); this.score+=10; this.rescued++; this.uScore.setText(`💯 SCORE ${this.score}`); this.sound.play('swimmer_spawn',{volume:0.6}); splash.call(this,sw.x,sw.y); popup.call(this,sw.x,sw.y,'+10'); checkWin.call(this); }
function capture(p,cr){ cr.destroy(); this.score+=30; this.caught++;  this.uScore.setText(`💯 SCORE ${this.score}`); this.sound.play('crook_spawn',{volume:0.6}); splash.call(this,cr.x,cr.y); popup.call(this,cr.x,cr.y,'+30'); checkWin.call(this); }

function spawnSwimmer(){ const x=Phaser.Math.Between(50,GW-50), y=Phaser.Math.Between(50,GH-50), t=Math.random()>0.5?'swimmer_m':'swimmer_f'; this.sw.create(x,y,t).setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70); }
function spawnCrook(){ const L=Phaser.Math.Between(0,1), y=Phaser.Math.Between(80,GH-80); let x,v,tx; if(L){ x=-50; v=Phaser.Math.Between(80,150); tx='crook'; } else { x=GW+50; v=Phaser.Math.Between(-150,-80); tx='crook_left'; } this.cr.create(x,y,tx).setVelocity(v,0).setImmovable(true).setSize(90,90); }
function spawnShark(dir='right'){ const y=Phaser.Math.Between(100,GH-100); let x,v,tx; if(dir==='right'){ x=GW+120; v=Phaser.Math.Between(-250,-200); tx='shark'; } else { x=-120; v=Phaser.Math.Between(200,250); tx='shark_right'; } const s=this.sh.create(x,y,tx); s.setVelocity(v,0).setImmovable(true).setSize(100,60); this.sound.play('shark_spawn',{volume:0.8}); this.tweens.add({targets:s,y:s.y+Phaser.Math.Between(-15,15),duration:Phaser.Math.Between(1500,2000),ease:'Sine.easeInOut',yoyo:true,repeat:-1}); }
function hitShark(p,s){ s.destroy(); this.score=Math.max(0,this.score-30); this.uScore.setText(`💯 SCORE ${this.score}`); const flash=this.add.rectangle(GW/2,GH/2,GW,GH,0xff0000,0.3).setDepth(999); this.tweens.add({targets:flash,alpha:0,duration:400,onComplete:()=>flash.destroy()}); splash.call(this,p.x,p.y); popup.call(this,p.x,p.y,'-30'); }

function checkWin(){ const m=MISSIONS[this.mi]; this.uGoal.setText(`🎯 Rescue ${m.rescued} (${this.rescued}/${m.rescued}) + Catch ${m.caught} (${this.caught}/${m.caught})`); if(this.rescued>=m.rescued && this.caught>=m.caught) win.call(this); }

function win(){
  this.timer && this.timer.remove();
  this.physics.pause();
  this.sound.stopAll(); playSafe(this,'reward_theme',{loop:true,volume:0.7});
  fitImage(this,`reward${this.mi+1}`).setDepth(999);

  const next=()=>this.scene.restart({currentMission:this.mi+1,isIntro:false});
  if(this.mi<MISSIONS.length-1){
    const t=this.add.text(GW/2,GH-60,'Press SPACE / ENTER / CLICK for next mission',{fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5).setDepth(1000);
    this.tweens.add({targets:t,alpha:.2,yoyo:true,repeat:-1,duration:800});
    this.input.keyboard.once('keydown-SPACE',next);
    this.input.keyboard.once('keydown-ENTER',next);
    this.input.once('pointerdown',next);
  }else{
    this.sound.stopAll(); playSafe(this,'game_complete',{loop:true,volume:0.7});
    this.add.text(GW/2,GH-100,'🏆 Game Complete! 🏆',{fontSize:'32px',color:'#ff0'}).setOrigin(.5).setDepth(1000);
    const rt=this.add.text(GW/2,GH-60,'Press R to restart the game',{fontSize:'24px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5).setDepth(1000);
    this.tweens.add({targets:rt,alpha:.2,yoyo:true,repeat:-1,duration:800});
    const h=(e)=>{ if(e.key==='r'||e.key==='R'){ document.removeEventListener('keydown',h); resetAll(this); } };
    document.addEventListener('keydown',h);
  }
}

function fail(){
  this.timer && this.timer.remove();
  this.physics.pause();
  this.sound.stopAll(); playSafe(this,'fail_theme',{loop:true,volume:0.7});
  fitImage(this,'fail').setDepth(999);
  const retry=()=>this.scene.restart({currentMission:this.mi,isIntro:false});
  const t=this.add.text(GW/2,GH-60,'Press SPACE / ENTER / CLICK to retry',{fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5).setDepth(1000);
  this.tweens.add({targets:t,alpha:.2,yoyo:true,repeat:-1,duration:800});
  this.input.keyboard.once('keydown-SPACE',retry);
  this.input.keyboard.once('keydown-ENTER',retry);
  this.input.once('pointerdown',retry);
}
