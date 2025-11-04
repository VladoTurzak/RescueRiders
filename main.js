// Rescue Riders – compact build: desktop ok + mobile landscape joystick
const GW=900,GH=600;let game;
const S={key:'m',preload,create,update,init};
const cfg={type:Phaser.AUTO,parent:'game',backgroundColor:0x87CEEB,physics:{default:'arcade',arcade:{debug:false}},scene:[S],scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.NO_CENTER}};
const MS=[{rescued:10,caught:3,time:60,swimmerDelay:1500,crookDelay:7000},{rescued:12,caught:5,time:55,swimmerDelay:1400,crookDelay:6000},{rescued:15,caught:8,time:50,swimmerDelay:1200,crookDelay:4000},{rescued:18,caught:10,time:45,swimmerDelay:1100,crookDelay:3000},{rescued:20,caught:14,time:40,swimmerDelay:1000,crookDelay:2000}];

function init(d){this.mi=d?.mi||0;this.intro=!!d?.intro}
function preload(){
  this.load.image('hero','assets/hero_screen.png');
  ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down','jetski_f','jetski_f_left','jetski_f_up','jetski_f_down','swimmer_m','swimmer_f','crook','crook_left','splash','shark','shark_right'].forEach(k=>this.load.image(k,`assets/${k}.png`));
  for(let i=1;i<=5;i++)this.load.image(`bg${i}`,`assets/bg${i}.png`),this.load.image(`reward${i}`,`assets/reward${i}.png`);
  ['intro_theme','mission_theme','reward_theme','fail_theme','game_complete','jetski_loop','swimmer_spawn','crook_spawn','shark_spawn'].forEach(a=>this.load.audio(a,`assets/audio/${a}.${a.includes('spawn')?'wav':'mp3'}`));
}
function create(){
  const W=this.scale.width,H=this.scale.height;this.oX=(W-GW)/2;this.oY=(H-GH)/2;this.bg=null;
  this.k=this.input.keyboard.addKeys({sp:32,en:13,esc:27,r:82});
  this.scale.on('resize',()=>{const w=this.scale.width,h=this.scale.height;this.oX=(w-GW)/2;this.oY=(h-GH)/2;this.bg&&this.bg.setPosition(w/2,h/2).setDisplaySize(w,h);posUI.call(this)});

  if(this.intro){
    fit(this,'hero');txt(this,W/2,H-80,'Press SPACE / ENTER / CLICK to start',26);
    this.sound.stopAll();this.sound.play('intro_theme',{loop:true,volume:.7});
    const go=()=>this.scene.restart({mi:0,intro:false});this.input.keyboard.once('keydown-SPACE',go);this.input.keyboard.once('keydown-ENTER',go);this.input.once('pointerdown',go);return;
  }

  this.sound.stopAll();this.sound.play('mission_theme',{loop:true,volume:.6});
  this.jet=this.sound.add('jetski_loop',{loop:true,volume:0});this.jet.play();
  const m=MS[this.mi],bgk=`bg${this.mi+1}`;if(this.textures.exists(bgk))this.bg=stretch(this,bgk).setDepth(-10);

  this.f=Math.random()>.5;const t=this.f?'jetski_f':'jetski_m';
  this.p=this.physics.add.sprite(this.oX+GW/2,this.oY+GH/2,t).setSize(100,100);
  this.c=this.input.keyboard.createCursorKeys();joy.call(this);

  this.sw=this.physics.add.group();this.cr=this.physics.add.group();
  this.time.addEvent({delay:m.swimmerDelay,callback:spawnS,callbackScope:this,loop:true});
  this.time.addEvent({delay:m.crookDelay,callback:spawnC,callbackScope:this,loop:true});
  if(this.mi>=3){this.sh=this.physics.add.group();this.time.addEvent({delay:6000,callback:()=>spawnSh.call(this,'right'),loop:true});if(this.mi>=4)this.time.addEvent({delay:7000,callback:()=>spawnSh.call(this,'left'),loop:true});this.physics.add.overlap(this.p,this.sh,hitSh,null,this)}
  this.physics.add.overlap(this.p,this.sw,gotS,null,this);this.physics.add.collider(this.p,this.cr,gotC,null,this);

  const y=this.oY+10,fs={fontSize:'22px',color:'#fff',fontStyle:'bold',fontFamily:'Arial',shadow:{offsetX:1,offsetY:1,color:'#000',blur:3}};
  this.u1=this.add.text(this.oX+30,y+12,`⭐ MISSION ${this.mi+1}`,fs);
  this.u2=this.add.text(this.oX+GW/2-60,y+12,`💯 SCORE 0`,fs);
  this.u3=this.add.text(this.oX+GW-150,y+12,`🕒 ${m.time}s`,fs);
  this.u4=this.add.text(this.oX+25,this.oY+65,`🎯 Rescue ${m.rescued} + Catch ${m.caught}`,{fontSize:'18px',color:'#003366',fontStyle:'bold',fontFamily:'Arial'});
  this.tl=m.time;this.timer=this.time.addEvent({delay:1000,loop:true,callback:()=>{this.tl--;this.u3.setText(`🕒 ${this.tl}s`);if(this.tl<=0)fail.call(this)}})
  this.sc=0;this.rs=0;this.cc=0;
  const hr=e=>{if(!e.repeat)rst(this)};this.k.r.on('down',hr);this.k.esc.on('down',hr);
}
function update(){
  if(!this.p)return;const mv=(this.c?.left?.isDown||this.c?.right?.isDown||this.c?.up?.isDown||this.c?.down?.isDown||this.stA);
  if(this.jet){const tv=mv?.5:0;this.jet.volume+= (tv-this.jet.volume)*.08}
  let vx=0,vy=0;
  if(this.c?.left?.isDown)vx-=250;if(this.c?.right?.isDown)vx+=250;if(this.c?.up?.isDown)vy-=250;if(this.c?.down?.isDown)vy+=250;
  if(this.stA){const sp=250;vx=this.stX*sp;vy=this.stY*sp}
  this.p.setVelocity(vx,vy);
  if(Math.abs(vx)>Math.abs(vy)){this.p.setTexture(vx<0?(this.f?'jetski_f_left':'jetski_m_left'):(this.f?'jetski_f':'jetski_m'))}
  else if(Math.abs(vy)>0){this.p.setTexture(vy<0?(this.f?'jetski_f_up':'jetski_m_up'):(this.f?'jetski_f_down':'jetski_m_down'))}
  const hw=this.p.displayWidth/2,hh=this.p.displayHeight/2;
  this.p.x=Phaser.Math.Clamp(this.p.x,this.oX+hw,this.oX+GW-hw);
  this.p.y=Phaser.Math.Clamp(this.p.y,this.oY+hh,this.oY+GH-hh);
}

// helpers
function rst(sc){try{sc.sound.stopAll();if(sc.jet)sc.jet.stop()}catch{}setTimeout(()=>{try{game.destroy(true)}catch{};game=new Phaser.Game(cfg);game.scene.start('m',{intro:true})},40)}
function fit(s,k){const w=s.scale.width,h=s.scale.height,i=s.add.image(w/2,h/2,k).setOrigin(.5),sx=w/i.width,sy=h/i.height;i.setScale(Math.min(sx,sy));return i}
function stretch(s,k){const w=s.scale.width,h=s.scale.height;return s.add.image(w/2,h/2,k).setOrigin(.5).setDisplaySize(w,h)}
function txt(s,x,y,t,fs){const m=s.add.text(x,y,t,{fontSize:`${fs}px`,color:'#fff',backgroundColor:'#000'}).setOrigin(.5);s.tweens.add({targets:m,alpha:.2,yoyo:true,repeat:-1,duration:800});return m}
function posUI(){if(!this.u1)return;const y=this.oY+10;this.u1.setPosition(this.oX+30,y+12);this.u2.setPosition(this.oX+GW/2-60,y+12);this.u3.setPosition(this.oX+GW-150,y+12);this.u4.setPosition(this.oX+25,this.oY+65)}

// spawns & collisions
function pop(s,x,y,t){const m=s.add.text(x,y,t,{fontSize:'18px',color:'#ff6',fontStyle:'bold',stroke:'#000',strokeThickness:3}).setDepth(9);s.tweens.add({targets:m,y:y-30,alpha:0,duration:700,onComplete:()=>m.destroy()})}
function splash(x,y){const s=this.add.image(x,y,'splash').setScale(.7);this.tweens.add({targets:s,alpha:0,duration:500,onComplete:()=>s.destroy()})}
function gotS(p,o){o.destroy();this.sc+=10;this.rs++;this.u2.setText(`💯 SCORE ${this.sc}`);this.sound.play('swimmer_spawn',{volume:.6});splash.call(this,o.x,o.y);pop(this,o.x,o.y,'+10');chk.call(this)}
function gotC(p,o){o.destroy();this.sc+=30;this.cc++;this.u2.setText(`💯 SCORE ${this.sc}`);this.sound.play('crook_spawn',{volume:.6});splash.call(this,o.x,o.y);pop(this,o.x,o.y,'+30');chk.call(this)}
function spawnS(){const x=Phaser.Math.Between(this.oX+50,this.oX+GW-50),y=Phaser.Math.Between(this.oY+50,this.oY+GH-50),t=Math.random()>.5?'swimmer_m':'swimmer_f';this.sw.create(x,y,t).setVelocity(Phaser.Math.Between(-60,60),Phaser.Math.Between(-40,40)).setBounce(1,1).setSize(70,70)}
function spawnC(){const L=Phaser.Math.Between(0,1),y=Phaser.Math.Between(this.oY+80,this.oY+GH-80);let x,v,t;if(L){x=this.oX-50;v=Phaser.Math.Between(80,150);t='crook'}else{x=this.oX+GW+50;v=Phaser.Math.Between(-150,-80);t='crook_left'};this.cr.create(x,y,t).setVelocity(v,0).setImmovable(true).setSize(90,90)}
function spawnSh(d='right'){const y=Phaser.Math.Between(this.oY+100,this.oY+GH-100);let x,v,t;if(d==='right'){x=this.oX+GW+120;v=Phaser.Math.Between(-250,-200);t='shark'}else{x=this.oX-120;v=Phaser.Math.Between(200,250);t='shark_right'};const sh=this.sh.create(x,y,t).setVelocity(v,0).setImmovable(true).setSize(100,60);this.sound.play('shark_spawn',{volume:.8});this.tweens.add({targets:sh,y:sh.y+Phaser.Math.Between(-15,15),duration:Phaser.Math.Between(1500,2000),ease:'Sine.easeInOut',yoyo:true,repeat:-1})}
function hitSh(p,s){s.destroy();this.sc=Math.max(0,this.sc-30);this.u2.setText(`💯 SCORE ${this.sc}`);const f=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0xff0000,.3).setDepth(9);this.tweens.add({targets:f,alpha:0,duration:400,onComplete:()=>f.destroy()});splash.call(this,p.x,p.y);pop(this,p.x,p.y,'-30')}
function chk(){const m=MS[this.mi];this.u4.setText(`🎯 Rescue ${m.rescued} (${this.rs}/${m.rescued}) + Catch ${m.caught} (${this.cc}/${m.caught})`);if(this.rs>=m.rescued&&this.cc>=m.caught)win.call(this)}
function win(){this.timer&&this.timer.remove();this.physics.pause();this.sound.stopAll();this.sound.play('reward_theme',{loop:true,volume:.7});fit(this,`reward${this.mi+1}`).setDepth(9);
  const nxt=()=>this.scene.restart({mi:this.mi+1,intro:false});
  if(this.mi<MS.length-1){txt(this,this.scale.width/2,this.scale.height-60,'SPACE / ENTER / CLICK → next',24);this.input.keyboard.once('keydown-SPACE',nxt);this.input.keyboard.once('keydown-ENTER',nxt);this.input.once('pointerdown',nxt)}
  else{this.sound.stopAll();this.sound.play('game_complete',{loop:true,volume:.7});this.add.text(this.scale.width/2,this.scale.height-80,'🏆 Game Complete! Press R to restart',{fontSize:'24px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5);document.addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R')rst(this)},{once:true})}
}
function fail(){this.timer&&this.timer.remove();this.physics.pause();this.sound.stopAll();this.sound.play('fail_theme',{loop:true,volume:.7});fit(this,'fail').setDepth(9);const r=()=>this.scene.restart({mi:this.mi,intro:false});txt(this,this.scale.width/2,this.scale.height-60,'SPACE / ENTER / CLICK to retry',24);this.input.keyboard.once('keydown-SPACE',r);this.input.keyboard.once('keydown-ENTER',r);this.input.once('pointerdown',r)}

// joystick (HTML overlay)
function joy(){
  const j=document.getElementById('joy'),k=document.getElementById('js'),b=document.getElementById('jb');
  if(!j||!('ontouchstart'in window)){this.stA=false;return}
  const R=40,rc=()=>j.getBoundingClientRect(),c=()=>({x:rc().left+rc().width/2,y:rc().top+rc().height/2});
  const mv=(x,y)=>{const{x:cx,y:cy}=c();let dx=x-cx,dy=y-cy;const L=Math.hypot(dx,dy)||1;if(L>R){dx=dx/L*R;dy=dy/L*R}k.style.transform=`translate(${35+dx}px,${35+dy}px)`;this.stX=dx/R;this.stY=dy/R;this.stA=true};
  const end=()=>{this.stA=false;this.stX=this.stY=0;k.style.transform='translate(35px,35px)'};
  b.addEventListener('touchstart',e=>mv(e.changedTouches[0].clientX,e.changedTouches[0].clientY),{passive:false});
  b.addEventListener('touchmove',e=>mv(e.changedTouches[0].clientX,e.changedTouches[0].clientY),{passive:false});
  b.addEventListener('touchend',end,{passive:false});b.addEventListener('touchcancel',end,{passive:false});
}

game=new Phaser.Game(cfg);game.scene.start('m',{intro:true});
