<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Rescue Riders 16:9</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <style>
    html,body {
      margin:0; padding:0; background:#000; height:100%; overflow:hidden;
      display:flex; justify-content:center; align-items:center;
    }

    /* BG – vyplní CELÝ screen (dynamicky s UI) */
    #bg-cover {
      position:fixed; inset:0;
      width:100vw; height:100dvh; /* dynamická výška s address bar */
      object-fit:cover;
      z-index:0; pointer-events:none;
      background:#000;
    }

    /* Phaser FULL viewport (dynamicky) */
    #phaser-wrapper {
      position:fixed; inset:0;
      width:100vw; height:100dvh;
      display:flex; justify-content:center; align-items:center;
    }
    #game-container {
      position:relative;
      width:100%; height:100%;
      max-width:100vw; max-height:100dvh;
    }
    #game-container canvas {
      display:block; image-rendering: pixelated;
    }

    /* Rotate block */
    #rotate-block {
      display:none; position:fixed; inset:0;
      background:#000; color:#fff; z-index:99999;
      align-items:center; justify-content:center; text-align:center;
      font-family:Arial, sans-serif;
    }
    @media (orientation:portrait) and (pointer:coarse) {
      #rotate-block { display:flex; }
      #phaser-wrapper, #nick { display:none !important; }
    }

    /* Nick modal */
    #nick {
      position:fixed; left:50%; top:50%;
      transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.9); padding:28px 40px; border-radius:12px;
      color:#fff; text-align:center; font-family:Arial, sans-serif;
      z-index:10000; width:min(92vw,520px);
      box-shadow:0 10px 30px rgba(0,0,0,.5);
    }
    #nick h2 { margin:0 0 10px; color:#ffcc00; font-weight:800; letter-spacing:.3px; }
    #nick p { margin:8px 0 12px; opacity:.9; }
    #nick input { 
      padding:12px 14px; border:none; border-radius:10px; width:100%; 
      text-align:center; font-size:16px; outline:none; background:#333; color:#fff;
    }
    #nick button { 
      margin-top:12px; padding:12px 22px; border:none; border-radius:10px; 
      background:#ffcc00; font-weight:800; cursor:pointer; width:100%;
    }

    /* Joystick – FIXED mimo Phaser */
    :root { --joy:min(24vmin,130px); --knob:calc(var(--joy)*.34); }
    #joy {
      position:fixed; bottom:5%; left:5%;
      width:var(--joy); height:var(--joy);
      touch-action:none; display:none;
      z-index:99999;
    }
    #joy-base { 
      position:absolute; inset:0; border-radius:50%; 
      background:rgba(255,255,255,.15); border:2px solid rgba(255,255,255,.4); 
    }
    #joy-stick {
      position:absolute; width:var(--knob); height:var(--knob); border-radius:50%;
      background:rgba(255,255,255,.95);
      left:calc(50% - var(--knob)/2); top:calc(50% - var(--knob)/2);
      box-shadow:0 0 12px rgba(0,0,0,.6);
      transition:transform .08s linear;
    }
  </style>
</head>
<body>
  <img id="bg-cover" src="assets/hero_intro_1280x720.png" alt="background">
  
  <div id="rotate-block">
    <div><h2>🌊 Rotate your device</h2><p>Playable only in landscape</p></div>
  </div>

  <!-- Nick modal -->
  <div id="nick">
    <h2>🌊 Rescue Riders</h2>
    <p>Enter your nickname:</p>
    <input id="n" maxlength="12"
