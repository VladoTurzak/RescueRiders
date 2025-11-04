// Rescue Riders – Desktop preserved + Mobile landscape joystick + safe resize
const GAME_WIDTH = 900, GAME_HEIGHT = 600;


const MainScene = { key: 'main', preload, create, update, init }; // keep same API


const config = {
type: Phaser.AUTO,
parent: 'game-container',
backgroundColor: 0x87CEEB,
physics: { default: 'arcade', arcade: { debug: false } },
scene: [MainScene],
scale: {
mode: Phaser.Scale.RESIZE, // 🔸 keep canvas filling the container, reacts to resize
autoCenter: Phaser.Scale.NO_CENTER
}
};


let game = new Phaser.Game(config);
game.scene.start('main', { isIntro: true });


function hardReset(sceneCtx) {
try { sceneCtx.sound.stopAll(); if (sceneCtx.jetskiSound) sceneCtx.jetskiSound.stop(); } catch(e){}
setTimeout(() => { try { game.destroy(true); } catch(e){}; game = new Phaser.Game(config); game.scene.start('main', { isIntro:true }); }, 50);
}


// --- Missions (unchanged) ---
const MISSIONS = [
{ rescued:10, caught:3, time:60, swimmerDelay:1500, crookDelay:7000 },
{ rescued:12, caught:5, time:55, swimmerDelay:1400, crookDelay:6000 },
{ rescued:15, caught:8, time:50, swimmerDelay:1200, crookDelay:4000 },
{ rescued:18, caught:10, time:45, swimmerDelay:1100, crookDelay:3000 },
{ rescued:20, caught:14, time:40, swimmerDelay:1000, crookDelay:2000 }
];


// Helpers that always use current size
function fitImage(scene, key) {
const w = scene.scale.width, h = scene.scale.height;
const img = scene.add.image(w/2, h/2, key).setOrigin(0.5);
const sx = w / img.width, sy = h / img.height;
img.setScale(Math.min(sx, sy));
return img;
}
function stretchImage(scene, key) {
const w = scene.scale.width, h = scene.scale.height;
return scene.add.image(w/2, h/2, key).setOrigin(0.5).setDisplaySize(w, h);
}


function init(data){ this.currentMission = data?.currentMission ?? 0; this.isIntro = data?.isIntro ?? false; }


function preload(){
this.load.image('hero', 'assets/hero_screen.png');
const jets = ['jetski_m','jetski_m_left','jetski_m_up','jetski_m_down','jetski_f','jetski_f_left','jetski_f_up','jetski_f_down'];
jets.forEach(j=>this.load.image(j, `assets/${j}.png`));
['swimmer_m','swimmer_f','crook','crook_left','splash'].forEach(a=>this.load.image(a, `assets/${a}.png`));
this.load.image('shark', 'assets/shark.png');
this.load.image('shark_right', 'assets/shark_right.png');
for(let i=1;i<=5;i++) this.load.image(`bg${i}`, `assets/bg${i}.png`);
function failMission(){ if(this.timerEvent) this.timerEvent.remove(); this.physics.pause(); this.sound.stopAll(); this.sound.play('fail_theme',{loop:true,volume:0.7}); fitImage(this,'fail').setDepth(999); const retry=()=>this.scene.restart({currentMission:this.currentMission,isIntro:false}); const t=this.add.text(this.scale.width/2,this.scale.height-60,'Press SPACE / ENTER / CLICK to retry',{fontSize:'26px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5).setDepth(1000); this.tweens.add({targets:t,alpha:0.2,yoyo:true,repeat:-1,duration:800}); this.input.keyboard.once('keydown-SPACE',retry); this.input.keyboard.once('keydown-ENTER',retry); this.input.once('pointerdown',retry); }
