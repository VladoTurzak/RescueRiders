// Rescue Riders – desktop stable + mobile (portrait aj landscape), joystick, fail screen, prompts
const GW=900, GH=600; let game;
const Scene={ key:'main', preload, create, update, init };
const cfg={
  type:Phaser.AUTO,
  parent:'game',
  backgroundColor:0x87CEEB,
  physics:{ default:'arcade', arcade:{ debug:false } },
  scene:[Scene],
  // RESIZE: plátno sa roztiahne na veľkosť kontajnera (fullscreen),
  // herné pole je vždy 900×600 uprostred (letterbox) – celé viditeľné.
  scale:{ mode:Phaser.Scale.RESIZE, autoCenter:Phaser.Scale.NO_CENTER }
};
const MISS=[ // bez zmeny
  {rescued:10,caught:3,time:60,swimmerDelay:1500,crookDelay:7000},
  {rescued:12,caught:5,time:55,swimmerDelay:1400,crookDelay:6000},
  {rescued:15,caught:8,time:50,swimmerDelay:1200,crookDelay:4000},
  {rescued:18,caught:10,time:45,swimmerDelay:1100,crookDelay:3000},
  {rescued:20,caught:14,time:40,swimmerDelay:1000,crookDelay:2000}
];

function init(d){ this.mi=d?.mi||0; this.isIntro=!!d?.intro; }

function preload(){
  // obrazky
  this.load.image('hero','assets/hero_screen.png');
  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down',
   'jetski_f','jetski_f_left','jetski_f_up','jetski_f_down',
   'swimmer_m','swimmer_f','crook','crook_left','splash',
   'shark','shark_right','fail'].forEach(k=>this.load.image(k,`assets/${k}.png`));
  for(let i=1;i<=5;i++){ this.load.image(`bg${i}`,`assets/bg${i}.png`); this.load.image(`reward${i}`,`assets/reward${i}.png`); }
  // zvuky
  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete','jetski_loop','swimmer_spawn','crook_spawn','shark_spawn']
    .forEach(a=>this.load.audio(a,`assets/audio/${a}.${a.includes('spawn')?'wav':'mp3'}`));
}

function create(){
  recalcOffsets.call(this); // nastav offsety pre 900×600 uprostred
  this.bg=null;

  // klávesy
  this.keys=this.input.keyboard.addKeys({
    SPACE:Phaser.Input.Keyboard.KeyCodes.SPACE,
    ENTER:Phaser.Input.Keyboard.KeyCodes.ENTER,
    ESC:Phaser.Input.Keyboard.KeyCodes.ESC,
    R:Phaser.Input.Keyboard.KeyCodes.R
  });

  // Intro obrazovka s promptom
  if(this.isIntro){
    fit(this,'hero');
    promptBlink(this, this.scale.width/2, this.scale.height-80, 'Press SPACE / ENTER / CLICK to start', 26);
    this.sound.stopAll(); this.sound.play('intro_theme',{loop:true,volume:0.7});
    const start=()=>this.scene.restart({mi:0,intro:false});
    this.input.keyboard.once('keydown-SPACE',start);
    this.input.keyboard.once('keydown-ENTER',start);
    this.input.once('pointerdown',start);
    // resize hook
    this.scale.on('resize',()=>{ fit(this,'hero'); });
    return;
  }

  // Mission
  this.sound.stopAll(); this.sound.play('mission_theme',{loop:true,volume:0.6});
  this.jet=this.sound.add('jetski_loop',{loop:true,volume:0}); this.jet.play();

  const m=MISS[this.mi], bgKey=`bg${this.mi+1}`;
  if(this.textures.exists(bgKey)) this.bg=stretch(this,bgKey).setDepth(-10);

  // hráč
  this.isF=Math.random()>0.5;
  const t=this.isF?'jetski_f':'jetski_m';
  this.p=this.physics.add.sprite(this.offX+GW/2, this.offY+GH/2, t).setCollideWorldBounds(false).setSize(100,100);

  // vstupy
  this.curs=this.input.keyboard.createCursorKeys();
  setupJoystick.call(this); // HTML joystick

  // skupiny & spawny
  this.sw=this.physics.add.group();
  this.cr=this.physics.add.group();
  this.time.addEvent({delay:m.swimmerDelay,callback:spawnSwimmer,callbackScope:this,loop:true});
  this.time.addEvent({delay:m.crookDelay,  callback:spawnCrook,  callbackScope:this,loop:true});

  if(this.mi>=3){
    this.sh=this.physics.add.group();
    this.time.addEvent({delay:6000,callback:()=>spawnShark.call(this,'right'),loop:true});
    if(this.mi>=4) this.time.addEvent({delay:7000,callback:()=>spawnShark.call(this,'left'),loop:true});
    this.physics.add.overlap(this.p,this.sh,hitShark,null,this);
  }
  this.physics.add.overlap(this.p,this.sw,rescue,null,this);
  this.physics.add.collider(this.p,this.cr, capture,null,this);

  // UI
  const y=this.offY+10, fs={fontSize:'22px',color:'#fff',fontStyle:'bold',fontFamily:'Arial',shadow:{offsetX:1,offsetY:1,color:'#000',blur:3}};
  this.uMission=this.add.text(this.offX+30,         y+12, `⭐ MISSION ${this.mi+1}`, fs);
  this.uScore  =this.add.text(this.offX+GW/2-60,    y+12, `💯 SCORE 0`, fs);
  this.uTimer  =this.add.text(this.offX+GW-150,     y+12, `🕒 ${m.time}s`, fs);
  this.uGoal   =this.add.text(this.offX+25, this.offY+65, `🎯 Rescue ${m.rescued} + Catch ${m.caught}`, {fontSize:'18px',color:'#003366',fontStyle:'bold',fontFamily:'Arial'});

  this.timeLeft=m.time;
  this.timer=this.time.addEvent({delay:1000,loop:true,callback:()=>{ this.timeLeft--; this.uTimer.setText(`🕒 ${this.timeLeft}s`); if(this.timeLeft<=0) fail.call(this); }});
  this.score=0; this.rescued=0; this.caught=0;

  const hard=(e)=>{ if(!e.repeat) resetGame(this); };
  this.keys.R.on('down',hard); this.keys.ESC.on('down',hard);

  // resize
  this.scale.on('resize',()=>{ recalcOffsets.call(this); restretchBG.call(this); repositionUI.call(this); });
}

function update(){
  if(!this.p) return;
  // jemný fade zvuku motora
  const isMoving = (this.curs?.left?.isDown||this.curs?.right?.isDown||this.curs?.up?.isDown||this.curs?.down?.isDown||this.stickActive);
  if(this.jet){ const target=isMoving?0.5:0; this.jet.volume += (target - this.jet.volume)*0.08; }

  // vstup
  let vx=0, vy=0;
  if(this.curs?.left?.isDown)  vx-=250;
  if(this.curs?.right?.isDown) vx+=250;
  if(this.curs?.up?.isDown)    vy-=250;
  if(this.curs?.down?.isDown)  vy+=250;

  if(this.stickActive){ const sp=250; vx=this.stickDX*sp; vy=this.stickDY*sp; }

  // pohyb + textúry
  this.p.setVelocity(vx,vy);
  if(Math.abs(vx)>Math.abs(vy)){
    this.p.setTexture(vx<0?(this.isF?'jetski_f_left':'jetski_m_left'):(this.isF?'jetski_f':'jetski_m'));
  }else if(Math.abs(vy)>0){
    this.p.setTexture(vy<0?(this.isF?'jetski_f_up':'jetski_m_up'):(this.isF?'jetski_f_down':'jetski_m_down'));
  }

  // hranice 900×600 – celé viditeľné
  const hw=this.p.displayWidth/2, hh=this.p.displayHeight/2;
  this.p.x=Phaser.Math.Clamp(this.p.x, this.offX+hw, this.offX+GW-hw);
  this.p.y=Phaser.Math.Clamp(this.p.y, this.offY+hh, this.offY+GH-hh);
}

/* ================= Helpers ================= */
function resetGame(sc){
  try{ sc.sound.stopAll(); if(sc.jet) sc.jet.stop(); }catch(e){}
  setTimeout(()=>{ try{game.destroy(true)}catch(e){}; game=new Phaser.Game(cfg); game.scene.start('main',{intro:true}); },40);
}
function recalcOffsets(){ const w=this.scale.width,h=this.scale.height; this.offX=(w-GW)/2; this.offY=(h-GH)/2; }
function fit(s,key){ const w=s.scale.width,h=s.scale.height,i=s.add.image(w/2,h/2,key).setOrigin(.5),sx=w/i.width,sy=h/i.height; i.setScale(Math.min(sx,sy)); return i; }
function stretch(s,key){ const w=s.scale.width,h=s.scale.height; return s.add.image(w/2,h/2,key).setOrigin(.5).setDisplaySize(w,h); }
function restretchBG(){ if(this.bg) this.bg.setPosition(this.scale.width/2,this.scale.height/2).setDisplaySize(this.scale.width,this.scale.height); }
function promptBlink(s,x,y,t,fs){ const m=s.add.text(x,y,t,{fontSize:`${fs}px`,color:'#fff',backgroundColor:'#000'}).setOrigin(.5); s.tweens.add({targets:m,alpha:.2,yoyo:true,repeat:-1,duration:800}); return m; }
function repositionUI(){ if(!this.uMission) return; const y=this.offY+10; this.uMission.setPosition(this.offX+30,y+12); this.uScore.setPosition(this.offX+GW/2-60,y+12); this.uTimer.setPosition(this.offX+GW-150,y+12); this.uGoal.setPosition(this.offX+25,this.offY+65); }

/* ================ Spawns & kolízie ================ */
function popup(s,x,y,text){ const t=s.add.text(x,y,text,{fontSize:'18px',color:'#ffff66',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(9); s.tweens.add({targets:t,y:y-30,alpha:0,duration:700,onComplete:()=>t.destroy()}); }
function splash(x,y){ const sp=this.add.image(x,y,'splash').setScale(.7); this.tweens.add({targets:sp,alpha:0,duration:500,onComplete:()=>sp.destroy()}); }
function rescue(p,sw){ sw.destroy(); this.score+=10; this.rescued++; this.uScore.setText(`💯 SCORE ${this.score}`); this.sound.play('swimmer_spawn',{volume:0.6}); splash.call(this,sw.x,sw.y); popup(this,sw.x,sw.y,'+10'); checkWin.call(this); }
function capture(p,cr){ cr.destroy(); this.score+=30; this.caught++; this.uScore.setText(`💯 SCORE ${this.score}`); this.sound.play('crook_spawn',{volume:0.6}); splash.call(this,cr.x,cr.y); popup(this,cr.x,cr.y,'+30'); checkWin.call(this); }
function spawnSwimmer(){ const x=Phaser.Math.Between(this.offX+50,this.offX+GW-50), y=Phaser.Math.Between(this.offY+50,this.offY+GH-50), tx=Math.random()>0.5?'swimmer_m':'swimmer_f'; this.sw.create(x,y,tx).setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70); }
function spawnCrook(){ const L=Phaser.Math.Between(0,1), y=Phaser.Math.Between(this.offY+80,this.offY+GH-80); let x,v,tx; if(L){ x=this.offX-50; v=Phaser.Math.Between(80,150); tx='crook'; } else { x=this.offX+GW+50; v=Phaser.Math.Between(-150,-80); tx='crook_left'; } this.cr.create(x,y,tx).setVelocity(v,0).setImmovable(true).setSize(90,90); }
function spawnShark(dir='right'){ const y=Phaser.Math.Between(this.offY+100,this.offY+GH-100); let x,v,tx; if(dir==='right'){ x=this.offX+GW+120; v=Phaser.Math.Between(-250,-200); tx='shark'; } else { x=this.offX-120; v=Phaser.Math.Between(200,250); tx='shark_right'; } const s=this.sh.create(x,y,tx); s.setVelocity(v,0).setImmovable(true).setSize(100,60); this.sound.play('shark_spawn',{volume:0.8}); this.tweens.add({targets:s,y:s.y+Phaser.Math.Between(-15,15),duration:Phaser.Math.Between(1500,2000),ease:'Sine.easeInOut',yoyo:true,repeat:-1}); }
function hitShark(p,s){ s.destroy(); this.score=Math.max(0,this.score-30); this.uScore.setText(`💯 SCORE ${this.score}`); const f=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0xff0000,0.3).setDepth(9); this.tweens.add({targets:f,alpha:0,duration:400,onComplete:()=>f.destroy()}); splash.call(this,p.x,p.y); popup(this,p.x,p.y,'-30'); }
function checkWin(){ const m=MISS[this.mi]; this.uGoal.setText(`🎯 Rescue ${m.rescued} (${this.rescued}/${m.rescued}) + Catch ${m.caught} (${this.caught}/${m.caught})`); if(this.rescued>=m.rescued && this.caught>=m.caught) win.call(this); }

function win(){
  this.timer && this.timer.remove();
  this.physics.pause();
  this.sound.stopAll(); this.sound.play('reward_theme',{loop:true,volume:0.7});
  fit(this,`reward${this.mi+1}`).setDepth(9);

  const next=()=>this.scene.restart({mi:this.mi+1,intro:false});
  if(this.mi<MISS.length-1){
    promptBlink(this,this.scale.width/2,this.scale.height-60,'Press SPACE / ENTER / CLICK for next mission',24);
    this.input.keyboard.once('keydown-SPACE',next);
    this.input.keyboard.once('keydown-ENTER',next);
    this.input.once('pointerdown',next);
  }else{
    this.sound.stopAll(); this.sound.play('game_complete',{loop:true,volume:0.7});
    this.add.text(this.scale.width/2,this.scale.height-80,'🏆 Game Complete! Press R to restart',{fontSize:'24px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5);
    document.addEventListener('keydown',e=>{ if(e.key==='r'||e.key==='R') resetGame(this); },{once:true});
  }
}

function fail(){
  this.timer && this.timer.remove();
  this.physics.pause();
  this.sound.stopAll(); this.sound.play('fail_theme',{loop:true,volume:0.7});
  fit(this,'fail').setDepth(9); // Fail obraz späť
  const retry=()=>this.scene.restart({mi:this.mi,isIntro:false});
  promptBlink(this,this.scale.width/2,this.scale.height-60,'Press SPACE / ENTER / CLICK to retry',24);
  this.input.keyboard.once('keydown-SPACE',retry);
  this.input.keyboard.once('keydown-ENTER',retry);
  this.input.once('pointerdown',retry);
}

/* ================ Joystick (HTML overlay) ================ */
function setupJoystick(){
  const j=document.getElementById('joy'), k=document.getElementById('js'), b=document.getElementById('jb');
  if(!j || !('ontouchstart' in window)){ this.stickActive=false; return; }
  const R=40, rc=()=>j.getBoundingClientRect(), center=()=>({x:rc().left+rc().width/2,y:rc().top+rc().height/2});
  const move=(x,y)=>{ const c=center(); let dx=x-c.x, dy=y-c.y; const L=Math.hypot(dx,dy)||1; if(L>R){ dx=dx/L*R; dy=dy/L*R; } k.style.transform=`translate(${35+dx}px,${35+dy}px)`; this.stickDX=dx/R; this.stickDY=dy/R; this.stickActive=true; };
  const end=()=>{ this.stickActive=false; this.stickDX=this.stickDY=0; k.style.transform='translate(35px,35px)'; };
  b.addEventListener('touchstart',e=>move(e.changedTouches[0].clientX,e.changedTouches[0].clientY),{passive:false});
  b.addEventListener('touchmove', e=>move(e.changedTouches[0].clientX,e.changedTouches[0].clientY),{passive:false});
  b.addEventListener('touchend',  end,{passive:false});
  b.addEventListener('touchcancel',end,{passive:false});
}

/* ================ Spustenie ================ */
game=new Phaser.Game(cfg);
game.scene.start('main',{intro:true});
