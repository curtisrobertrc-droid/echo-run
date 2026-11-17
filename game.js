/* Echo Run: The Thornbound Citadel. Rendering, UI and audio on top of sim.js (deterministic rules). */
(function () {
  'use strict';
  var VW = 960, VH = 540, ZOOM = 2, STEP = 1000 / 60;
  var SIM = window.EchoSim, LV = window.EchoLevels, LEVELS = LV.levels, WINGS = LV.wings, P = SIM.P;
  var GOLD = '#ffd27a', PALE = '#e9dcff', DIM = '#9d8cbf', CYAN = '#8ff3ff';
  var ROMAN = ['I', 'II', 'III'];

  // ---------------- save ----------------
  var SAVE_KEY = 'echorun.save.v1';
  var Save = {
    data: { unlocked: 1, stars: {}, best: {}, music: true, sfx: true, shake: true, seenHow: false },
    load: function () { try { var s = window.localStorage.getItem(SAVE_KEY); if (s) { var d = JSON.parse(s); for (var k in d) this.data[k] = d[k]; } } catch (e) {} },
    save: function () { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {} },
    totalStars: function () { var t = 0, s = this.data.stars; for (var k in s) t += s[k]; return t; }
  };
  Save.load();
  window.EchoSave = Save;

  // ---------------- audio ----------------
  var Snd = {
    game: null, music: null, musicKey: null, muted: false,
    play: function (key, vol, rate) {
      if (!Save.data.sfx || this.muted || !this.game) return;
      try { this.game.sound.play('sfx_' + key, { volume: vol == null ? 0.5 : vol, rate: rate || 1, detune: 0 }); } catch (e) {}
    },
    musicFor: function (key, scene) {
      var self = this;
      if (this.musicKey === key && this.music && this.music.isPlaying) return;
      if (this.music) { var old = this.music; this.music = null; if (scene) scene.tweens.add({ targets: old, volume: 0, duration: 600, onComplete: function () { old.stop(); old.destroy(); } }); else { old.stop(); old.destroy(); } }
      this.musicKey = key;
      if (!Save.data.music || !this.game) return;
      try {
        var m = this.music = this.game.sound.add(key, { loop: true, volume: 0 });
        m.play();
        if (scene) scene.tweens.add({ targets: m, volume: 0.42, duration: 1200 }); else m.setVolume(0.42);
      } catch (e) {}
    },
    refresh: function (scene) { var k = this.musicKey; if (!Save.data.music) { if (this.music) { this.music.stop(); this.music.destroy(); this.music = null; } } else { this.musicKey = null; this.musicFor(k || 'music_menu', scene); } },
    setMuted: function (m) { this.muted = m; if (this.game) this.game.sound.mute = m; }
  };
  window.Portal && (window.Portal.onMute = function (m) { Snd.setMuted(m); });

  function starsFor(def, used) { return used <= def.par ? 3 : (used <= def.par + 2 ? 2 : 1); }
  function fmtTime(frames) { var s = Math.floor(frames / 60), m = Math.floor(s / 60); s = s % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function themeOf(i) { return WINGS[LEVELS[i].wing].theme; }
  var MUSIC = { nave: 'music_game', forge: 'music_inn', spire: 'music_menu', menu: 'music_menu' };

  // ---------------- UI helpers ----------------
  function panel(scene, x, y, w, h, opts) {
    opts = opts || {};
    var g = scene.add.graphics();
    var fill = opts.fill == null ? 0x150f24 : opts.fill, a = opts.alpha == null ? 0.92 : opts.alpha;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 5, w, h, 8);
    g.fillStyle(fill, a).fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    g.lineStyle(2, opts.border || 0x8a5a1a, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    g.lineStyle(1, opts.inner || 0xd89a3a, 0.55).strokeRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 6);
    // corner studs
    g.fillStyle(0xffd27a, 0.9);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.fillRect(x + c[0] * (w / 2 - 7) - 2, y + c[1] * (h / 2 - 7) - 2, 4, 4); });
    return g;
  }
  function txt(scene, x, y, s, size, color, font, align) {
    var t = scene.add.text(x, y, s, { fontFamily: font || 'DotGothic', fontSize: (size || 18) + 'px', color: color || PALE, align: align || 'center', lineSpacing: 4 });
    t.setOrigin(0.5); t.setShadow(2, 2, '#05030a', 0, true, true);
    return t;
  }
  function button(scene, x, y, w, h, label, cb, opts) {
    opts = opts || {};
    var c = scene.add.container(x, y);
    var g = scene.add.graphics();
    function draw(hover) {
      g.clear();
      g.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 7);
      g.fillStyle(hover ? 0x3a2560 : (opts.fill || 0x22163a), 1).fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      g.fillStyle(0xffffff, hover ? 0.08 : 0.04).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 3, 5);
      g.lineStyle(2, hover ? 0xffd27a : 0xb07a2a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
    }
    draw(false);
    var t = txt(scene, 0, 0, label, opts.size || 22, opts.color || PALE, opts.font);
    c.add([g, t]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', function () { draw(true); scene.tweens.add({ targets: c, scale: 1.04, duration: 90 }); Snd.play('uimove', 0.25); });
    c.on('pointerout', function () { draw(false); scene.tweens.add({ targets: c, scale: 1, duration: 90 }); });
    c.on('pointerdown', function () { scene.tweens.add({ targets: c, scale: 0.96, duration: 60, yoyo: true }); });
    c.on('pointerup', function () { Snd.play('uiselect', 0.5); cb && cb(); });
    c.label = t; c.redraw = draw;
    return c;
  }
  function starShape(g, x, y, r, filled) {
    var pts = [];
    for (var i = 0; i < 8; i++) { var a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.42 : r; pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr }); }
    if (filled) { g.fillStyle(0xffd27a, 1).fillPoints(pts, true); g.fillStyle(0xfff3c4, 1).fillCircle(x - r * 0.12, y - r * 0.12, r * 0.18); g.lineStyle(2, 0x8a5a1a, 1).strokePoints(pts, true); }
    else { g.fillStyle(0x1a1230, 1).fillPoints(pts, true); g.lineStyle(2, 0x5a4a7a, 1).strokePoints(pts, true); }
  }
  function fadeTo(scene, key, data) {
    if (scene._leaving) return; scene._leaving = true;
    scene.cameras.main.fadeOut(260, 5, 3, 10);
    scene.cameras.main.once('camerafadeoutcomplete', function () { scene.scene.start(key, data); });
  }

  // ---------------- Boot ----------------
  var Boot = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Boot() { Phaser.Scene.call(this, { key: 'Boot' }); },
    preload: function () {
      var w = VW, h = VH, self = this;
      window.Portal && window.Portal.loadingStart();
      var bar = this.add.graphics(), t = txt(this, w / 2, h / 2 - 40, 'Summoning the citadel', 22, DIM);
      this.load.on('progress', function (p) {
        bar.clear(); bar.lineStyle(2, 0xb07a2a, 1).strokeRect(w / 2 - 160, h / 2, 320, 14);
        bar.fillStyle(0x8ff3ff, 1).fillRect(w / 2 - 157, h / 2 + 3, 314 * p, 8);
      });
      this.load.spritesheet('hero', 'hero.png', { frameWidth: 64, frameHeight: 64 });
      this.load.spritesheet('tiles', 'tiles16.png', { frameWidth: 16, frameHeight: 16 });
      this.load.spritesheet('props', 'props.png', { frameWidth: 16, frameHeight: 16 });
      this.load.spritesheet('ghost', 'ghost.png', { frameWidth: 64, frameHeight: 80 });
      ['arch', 'column', 'bgpanels', 'night_sky', 'night_clouds', 'night_mountains', 'glow', 'bigglow', 'pix', 'shaft', 'fog']
        .forEach(function (k) { self.load.image(k, k + '.png'); });
      ['jump', 'land', 'step1', 'step2', 'death', 'echo', 'sacrifice', 'plate', 'gate', 'arrow', 'thunk', 'exit', 'star', 'uimove', 'uiselect', 'fanfare', 'whoosh']
        .forEach(function (k) { self.load.audio('sfx_' + k, 'sfx_' + k + '.mp3'); });
      ['music_menu', 'music_game', 'music_inn'].forEach(function (k) { self.load.audio(k, k + '.mp3'); });
    },
    create: function () {
      Snd.game = this.game;
      var a = this.anims;
      a.create({ key: 'h_idle', frames: a.generateFrameNumbers('hero', { start: 0, end: 3 }), frameRate: 7, repeat: -1 });
      a.create({ key: 'h_run', frames: a.generateFrameNumbers('hero', { start: 4, end: 15 }), frameRate: 16, repeat: -1 });
      a.create({ key: 'ghost', frames: a.generateFrameNumbers('ghost', { start: 0, end: 6 }), frameRate: 8, repeat: -1 });
      makeSkies(this);
      var v = this.textures.createCanvas('vignette', VW, VH), ctx = v.getContext();
      var gr = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,2,10,0.85)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH); v.refresh();
      var ts = this.textures.createCanvas('topshade', 8, 270), tc = ts.getContext(), tg = tc.createLinearGradient(0, 0, 0, 270);
      tg.addColorStop(0, 'rgba(4,2,10,0.85)'); tg.addColorStop(0.4, 'rgba(4,2,10,0.25)'); tg.addColorStop(1, 'rgba(4,2,10,0)');
      tc.fillStyle = tg; tc.fillRect(0, 0, 8, 270); ts.refresh();
      document.getElementById('boot') && document.getElementById('boot').remove();
      window.Portal && window.Portal.loadingStop();
      var start = (window.location.hash.match(/level=(\d+)/) || [])[1];
      if (start) this.scene.start('Game', { level: Math.max(0, Math.min(LEVELS.length - 1, (+start) - 1)) });
      else this.scene.start('Title');
    }
  });

  function makeSkies(scene) {
    var defs = { nave: ['#07050f', '#1a1230', '#2b1d47'], forge: ['#0a0506', '#2a120c', '#4a2214'], spire: ['#05060f', '#141a3a', '#2a2350'] };
    Object.keys(defs).forEach(function (k) {
      var c = scene.textures.createCanvas('sky_' + k, 64, 270), ctx = c.getContext(), g = ctx.createLinearGradient(0, 0, 0, 270);
      g.addColorStop(0, defs[k][0]); g.addColorStop(0.55, defs[k][1]); g.addColorStop(1, defs[k][2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 270); c.refresh();
    });
  }

  // Parallax backdrop. Menus: screen space (L = null, pixel scale 2). Game: world space under a zoom-2 camera.
  // With camera zoom Z, an object with scrollFactor f is visible when x in [240(1-f) + visLeft*f, ...]; helpers below handle that.
  function backdrop(scene, theme, L) {
    var menu = !L, s = menu ? 2 : 1, vw = menu ? VW : VW / ZOOM, vh = menu ? VH : VH / ZOOM;
    var pw = L ? L.pw : VW, ph = L ? L.ph : VH;
    var HX = menu ? 0 : (VW - vw) / 2, HY = menu ? 0 : (VH - vh) / 2;
    function ox(f) { return HX * (1 - f); }
    function oy(f) { return HY * (1 - f); }
    function spanW(f) { return (pw - vw) * f + vw; }
    function spanH(f) { return (ph - vh) * f + vh; }
    var objs = { drift: [] };
    scene.add.image(ox(0) - 1, oy(0) - 1, 'sky_' + theme).setOrigin(0).setScrollFactor(0).setDisplaySize(vw + 2, vh + 2).setDepth(-100);
    if (theme === 'spire') {
      var st = scene.add.tileSprite(ox(0), oy(0), vw / s, 224, 'night_sky').setOrigin(0).setScrollFactor(0).setScale(s, vh / 224).setDepth(-99).setTint(0xb0a8ff).setAlpha(0.9);
      var cl = scene.add.tileSprite(ox(0), oy(0) + vh * 0.02, vw / s, 224, 'night_clouds').setOrigin(0).setScrollFactor(0).setScale(s, s * 0.9).setDepth(-98).setTint(0x9a90d0).setAlpha(0.6);
      var mo = scene.add.tileSprite(ox(0), oy(0) + vh - 224 * s * 0.9, vw / s, 224, 'night_mountains').setOrigin(0).setScrollFactor(0).setScale(s, s * 0.9).setDepth(-97).setTint(0x6a62a8);
      objs.drift.push({ o: cl, sp: 0.05, par: 0.06 }, { o: mo, sp: 0, par: 0.15 });
      for (var i = 0; i < 7; i++) {
        var cf = menu ? 0 : 0.35;
        scene.add.image(ox(cf) + (i * (menu ? 160 : 90) + 30), oy(cf) + spanH(cf) + 6, 'column').setOrigin(0.5, 1).setScrollFactor(cf)
          .setDepth(-96).setTint(0x15122c).setScale((menu ? 2 : 0.9) * (0.75 + (i % 3) * 0.18));
      }
    } else {
      var pf = menu ? 0 : 0.3;
      var ps = menu ? s : 1.5;
      var bp = scene.add.tileSprite(ox(pf) - 10, oy(pf) + spanH(pf) - 192 * ps - (menu ? 20 : 4), (spanW(pf) + 20) / ps, 192, 'bgpanels')
        .setOrigin(0).setScale(ps).setScrollFactor(pf).setDepth(-95).setTint(theme === 'forge' ? 0xc07850 : 0x8a7cb8).setAlpha(0.85);
      objs.panels = bp;
      var colPf = menu ? 0 : 0.6, step = menu ? 330 : 200;
      for (var x = 40; x < spanW(colPf) + 120; x += step) {
        scene.add.image(ox(colPf) + x, oy(colPf) + spanH(colPf) + 12, 'column').setOrigin(0.5, 1).setScale(menu ? 2.6 : 1.25).setScrollFactor(colPf)
          .setDepth(-90).setTint(theme === 'forge' ? 0x4a2a22 : 0x2e2448).setAlpha(0.95);
      }
    }
    var shf = menu ? 0 : 0.7;
    for (var k = 0; k < 4; k++) {
      var sx = ox(shf) + (menu ? 120 + k * 230 : 40 + k * spanW(shf) / 4);
      var sh = scene.add.image(sx, oy(shf) - 10, 'shaft').setOrigin(0.5, 0).setScrollFactor(shf).setDepth(-80)
        .setBlendMode(Phaser.BlendModes.ADD).setAngle(14).setScale(menu ? 2.2 : 1.1, menu ? 2.4 : 1.25)
        .setTint(theme === 'forge' ? 0xffa060 : theme === 'spire' ? 0x9ab0ff : 0xb8a0ff).setAlpha(0.13);
      scene.tweens.add({ targets: sh, alpha: 0.05, duration: 2600 + k * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (theme === 'nave') {
      var gf = menu ? 0 : 0.6;
      for (var gI = 0; gI < 2; gI++) {
        var gh = scene.add.sprite(ox(gf) + (menu ? 200 + gI * 500 : 60 + gI * 220), oy(gf) + (menu ? 200 + gI * 60 : 60 + gI * 40), 'ghost').play('ghost')
          .setScrollFactor(gf).setDepth(-85).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD).setScale(menu ? 1.5 : 0.8).setTint(0xaee8ff);
        scene.tweens.add({ targets: gh, x: gh.x + (menu ? 160 : 90), y: gh.y - 16, duration: 9000 + gI * 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          onYoyo: function (tw, t) { t.flipX = !t.flipX; }, onRepeat: function (tw, t) { t.flipX = !t.flipX; } });
      }
    }
    if (theme !== 'spire') scene.add.image(ox(0) - 1, oy(0) - 1, 'topshade').setOrigin(0).setScrollFactor(0).setDisplaySize(vw + 2, vh * 0.8).setDepth(-75);
    var moteTint = theme === 'forge' ? [0xffb060, 0xff7030] : theme === 'spire' ? [0xc8d8ff, 0x8ff3ff] : [0xcdb8ff, 0x8ff3ff];
    var mz = scene.add.particles(0, 0, 'pix', {
      x: { min: 0, max: pw }, y: { min: menu ? VH * 0.3 : 0, max: ph },
      lifespan: 6000, speedY: theme === 'forge' ? { min: -22, max: -8 } : { min: -6, max: 4 }, speedX: { min: -6, max: 6 },
      scale: { start: menu ? 0.6 : 0.3, end: 0 }, alpha: { start: 0.7, end: 0 }, quantity: 1, frequency: theme === 'forge' ? 90 : 160,
      tint: moteTint, blendMode: 'ADD'
    }).setDepth(-70);
    if (menu) mz.setScrollFactor(0);
    objs.motes = mz;
    return objs;
  }

  // ---------------- helpers for the level renderer ----------------
  function hsh(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }
  var THEME_MUL = { nave: [1, 1, 1], forge: [1.08, 0.84, 0.72], spire: [0.86, 0.92, 1.08] };
  function shade(v, theme) {
    var m = THEME_MUL[theme], r = Math.min(255, Math.round(255 * v * m[0])), g = Math.min(255, Math.round(255 * v * m[1])), b = Math.min(255, Math.round(255 * v * m[2]));
    return (r << 16) | (g << 8) | b;
  }
  function heroFrame(st, t) {
    switch (st) {
      case 'idle': return Math.floor(t / 8) % 4;
      case 'run': return 4 + Math.floor(t / 4) % 12;
      case 'rise': return t < 4 ? 17 : 18;
      case 'apex': return 19;
      case 'fall': return 20;
      case 'kneel': return 26;
      case 'dead': return 22;
    }
    return 0;
  }

  // ---------------- Game ----------------
  var Game = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Game() { Phaser.Scene.call(this, { key: 'Game' }); },
    init: function (data) {
      this.levelIndex = data && data.level != null ? data.level : 0;
      this.bonusSlots = (data && data.bonusSlots) || 0;
      this._leaving = false;
    },
    create: function () {
      var self = this, def = LEVELS[this.levelIndex];
      this.def = def; this.theme = themeOf(this.levelIndex);
      this.world = new SIM.World(def);
      this.world.maxEchoes += this.bonusSlots;
      var L = this.L = this.world.L;
      var cam = this.cameras.main;
      cam.setZoom(ZOOM).setBounds(0, 0, L.pw, L.ph).setRoundPixels(true).setBackgroundColor('#07050d');
      this.bg = backdrop(this, this.theme, L);
      this.buildTiles();
      this.buildEntities();
      this.buildFx();
      // player
      this.pl = this.add.sprite(0, 0, 'hero', 0).setOrigin(0.5, 60 / 64).setDepth(25);
      this.plGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb070).setAlpha(0.18).setScale(1.3).setDepth(24);
      this.sq = { x: 1, y: 1 };
      this.echoViews = {};
      this.camT = this.add.zone(L.start.x, L.start.y, 1, 1);
      this.look = 0;
      cam.startFollow(this.camT, true, 0.1, 0.12);
      cam.centerOn(L.start.x + 6, L.start.y);
      // fog
      this.fog = this.add.tileSprite(0, L.ph - 70, L.pw, 64, 'fog').setOrigin(0).setDepth(50).setAlpha(this.theme === 'forge' ? 0.12 : 0.2)
        .setTint(this.theme === 'forge' ? 0xff9a60 : this.theme === 'spire' ? 0x9ab0ff : 0xb8a0ff);
      // input
      this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,Z,X,K,SPACE,R,ESC,P,U,ENTER,H');
      this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
      this.touch = { left: false, right: false, jump: false, sac: false };
      this.acc = 0; this.mode = 'play'; this.modeT = 0; this.paused = false; this.hitstop = 0;
      this.prevSac = false;
      this.syncAll(true);
      this.spawnFx(true);
      this.scene.launch('Hud', { gs: this });
      this.hud = this.scene.get('Hud');
      cam.fadeIn(400, 5, 3, 10);
      Snd.musicFor(MUSIC[this.theme], this);
      window.Portal && window.Portal.gameplayStart();
      this.events.once('shutdown', function () { window.Portal && window.Portal.gameplayStop(); });
      window.__echo = this; // test hook
    },

    buildTiles: function () {
      var L = this.L, th = this.theme, W = L.W, H = L.H, x, y;
      var solid = function (tx, ty) { if (tx < 0 || tx >= W || ty < 0 || ty >= H) return ty >= 0 ? true : true; return L.solid[ty][tx]; };
      // distance to open space (Chebyshev, capped)
      var dist = [];
      for (y = 0; y < H; y++) { dist.push([]); for (x = 0; x < W; x++) dist[y].push(L.solid[y][x] ? 9 : 0); }
      for (var pass = 1; pass <= 4; pass++) for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (dist[y][x] < pass) continue;
        var near = false;
        for (var dy = -1; dy <= 1 && !near; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (dist[ny][nx] === pass - 1) { near = true; break; }
        }
        if (near) dist[y][x] = pass;
      }
      var rt = this.add.renderTexture(0, 0, L.pw, L.ph).setOrigin(0).setDepth(0);
      this.rt = rt;
      var lum = [1, 0.9, 0.6, 0.38, 0.26, 0.2];
      rt.beginDraw();
      var topVar = {};
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (!L.solid[y][x]) continue;
        var d = Math.min(5, dist[y][x]), above = y > 0 ? L.solid[y - 1][x] : true;
        var hv = hsh(x, y);
        if (!above && y > 0) {
          var v = hv % 9; topVar[x + ',' + y] = v;
          rt.batchDrawFrame('tiles', 13 + v, x * 16, y * 16, 1, shade(1, th));
        } else if (topVar[x + ',' + (y - 1)] != null) {
          rt.batchDrawFrame('tiles', 22 + topVar[x + ',' + (y - 1)], x * 16, y * 16, 1, shade(Math.max(0.7, lum[d]), th));
        } else {
          var bv = hsh(x >> 1, y >> 1) % 3, f = bv * 4 + (y % 2) * 2 + (x % 2);
          rt.batchDrawFrame('tiles', f, x * 16, y * 16, 1, shade(lum[d] * (0.92 + (hv % 9) / 100), th));
        }
      }
      rt.endDraw();
      // crisp edges
      var g = this.make.graphics({ x: 0, y: 0, add: false });
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (!L.solid[y][x]) continue;
        var X = x * 16, Y = y * 16;
        if (x > 0 && !L.solid[y][x - 1]) { g.fillStyle(0x0a0712, 1).fillRect(X, Y, 1, 16); g.fillStyle(0xffffff, 0.08).fillRect(X + 1, Y, 1, 16); }
        if (x < W - 1 && !L.solid[y][x + 1]) { g.fillStyle(0x0a0712, 1).fillRect(X + 15, Y, 1, 16); }
        if (y < H - 1 && !L.solid[y + 1][x]) { g.fillStyle(0x0a0712, 1).fillRect(X, Y + 15, 16, 1); g.fillStyle(0x000000, 0.3).fillRect(X, Y + 14, 16, 1); }
      }
      rt.draw(g); g.destroy();
      // ledges and spikes
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (L.oneway[y][x]) rt.stamp('props', 7, x * 16, y * 16, { originX: 0, originY: 0, tint: shade(1, th) });
      L.spikes.forEach(function (s) {
        if (s.up) rt.stamp('props', 0, s.x, s.y, { originX: 0, originY: 0 });
        else rt.stamp('props', 0, s.x + 8, s.y + 8, { scaleY: -1 });
      });
      // contact shadow under the play area edges
      this.rtShadow = null;
    },

    buildEntities: function () {
      var self = this, L = this.L;
      // exit
      if (L.exit) {
        var ex = L.exit.x + 8, ey = L.exit.y + 16;
        this.exitGlow = this.add.image(ex, ey - 26, 'bigglow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc870).setAlpha(0.35).setScale(0.35).setDepth(0.5);
        this.tweens.add({ targets: this.exitGlow, alpha: 0.18, scale: 0.3, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.exitArch = this.add.image(ex, ey, 'arch').setOrigin(0.5, 1).setDepth(1);
        this.exitLight = this.add.image(ex, ey - 22, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0c0).setScale(0.45, 0.8).setAlpha(0.6).setDepth(1.1);
        this.exitFx = this.add.particles(0, 0, 'pix', { x: { min: ex - 8, max: ex + 8 }, y: ey - 4, lifespan: 1400, speedY: { min: -30, max: -12 }, speedX: { min: -4, max: 4 },
          scale: { start: 0.4, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffd27a, 0xfff3c4], blendMode: 'ADD', frequency: 120 }).setDepth(1.2);
      }
      // torches
      L.torches.forEach(function (t) {
        var g = self.add.graphics().setDepth(1);
        g.fillStyle(0x0a0712, 1).fillRect(t.x - 2, t.y + 1, 4, 7); g.fillStyle(0x8a5a1a, 1).fillRect(t.x - 3, t.y - 1, 6, 3); g.fillStyle(0xd89a3a, 1).fillRect(t.x - 3, t.y - 1, 6, 1);
        var gl = self.add.image(t.x, t.y - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a40).setAlpha(0.4).setScale(1.5).setDepth(0.4);
        self.tweens.add({ targets: gl, alpha: { from: 0.32, to: 0.48 }, scale: { from: 1.4, to: 1.62 }, duration: 120 + (t.x % 7) * 30, yoyo: true, repeat: -1 });
        self.add.particles(t.x, t.y - 2, 'pix', { lifespan: { min: 250, max: 520 }, speedY: { min: -34, max: -16 }, speedX: { min: -5, max: 5 },
          scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xfff0a0, 0xffb040, 0xff6020], blendMode: 'ADD', frequency: 40 }).setDepth(1.3);
      });
      // tips
      (L.tips || []).forEach(function (tp) {
        var t = self.add.text(tp.x * 16, tp.y * 16, tp.text, { fontFamily: 'DotGothic', fontSize: '9px', color: '#d9c8f5', align: 'center', lineSpacing: 2 })
          .setOrigin(0.5).setResolution(4).setDepth(2).setAlpha(0.85);
        t.setShadow(1, 1, '#05030a', 0, true, true);
        t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 20, L.pw - t.width / 2 - 20);
        self.tweens.add({ targets: t, y: t.y - 2, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });
      // plates
      this.plateViews = L.plates.map(function (p) {
        var s = self.add.sprite(p.x + 8, p.y + 8, 'props', 1).setDepth(3);
        var gl = self.add.image(p.x + 8, p.y + 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8ff3ff).setAlpha(0).setScale(0.7, 0.35).setDepth(3.1);
        return { p: p, s: s, gl: gl };
      });
      // gates
      this.gateViews = Object.keys(L.gates).map(function (k) {
        var g = L.gates[k], c = self.add.container(g.x, g.y).setDepth(-1);
        var ts = self.add.tileSprite(0, 0, g.w, g.h - 16, 'props', 3).setOrigin(0);
        var tips = [];
        for (var i = 0; i < g.w / 16; i++) tips.push(self.add.image(i * 16, g.h - 16, 'props', 4).setOrigin(0));
        c.add([ts].concat(tips));
        var rune = self.add.image(g.x + g.w / 2, g.y - 8, 'props', 10).setDepth(2).setAlpha(0.35).setTint(g.invert ? 0xff8a8a : 0x8ff3ff);
        return { g: g, c: c, rune: rune };
      });
      // launchers
      this.launcherViews = L.launchers.map(function (l) {
        return self.add.sprite(l.x + 8, l.y + 8, 'props', 5).setFlipX(l.dir < 0).setDepth(2);
      });
      // movers
      this.moverViews = L.movers.map(function (m) {
        var c = self.add.container(m.x, m.y).setDepth(4);
        var parts = [];
        for (var i = 0; i < m.w / 16; i++) parts.push(self.add.image(i * 16, 0, 'props', i === 0 ? 8 : (i === m.w / 16 - 1 ? 9 : 8)).setOrigin(0));
        var gl = self.add.image(m.w / 2, 13, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc870).setAlpha(0.35).setScale(0.7, 0.25);
        c.add([gl].concat(parts));
        return { m: m, c: c };
      });
      this.arrowViews = [];
    },

    buildFx: function () {
      var mk = function (scene, cfg) { return scene.add.particles(0, 0, 'pix', Object.assign({ emitting: false }, cfg)).setDepth(40); };
      this.fxDust = mk(this, { lifespan: { min: 300, max: 650 }, speed: { min: 8, max: 40 }, angle: { min: 200, max: 340 }, gravityY: 50,
        scale: { start: 0.55, end: 0 }, alpha: { start: 0.75, end: 0 }, tint: [0x9a8ab8, 0x6a5a88, 0xcdb8ff] });
      this.fxSpark = mk(this, { lifespan: { min: 250, max: 600 }, speed: { min: 40, max: 130 }, gravityY: 220, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xffd27a, 0xffffff, 0xffa040], blendMode: 'ADD' });
      this.fxSoul = mk(this, { lifespan: { min: 600, max: 1200 }, speed: { min: 20, max: 95 }, gravityY: -50, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0x8ff3ff, 0xffffff, 0x3fb8d8], blendMode: 'ADD' });
      this.fxShard = mk(this, { lifespan: { min: 450, max: 900 }, speed: { min: 60, max: 170 }, gravityY: 320, scale: { start: 0.8, end: 0.2 }, alpha: { start: 1, end: 0 },
        tint: [0xc0303f, 0x7a1424, 0xe9dcff, 0xffd27a] });
      this.fxGold = mk(this, { lifespan: { min: 600, max: 1400 }, speed: { min: 30, max: 200 }, gravityY: -20, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xffd27a, 0xfff3c4, 0xffffff], blendMode: 'ADD' });
      this.fxWisp = mk(this, { lifespan: { min: 500, max: 900 }, speedY: { min: -22, max: -8 }, speedX: { min: -6, max: 6 }, scale: { start: 0.45, end: 0 }, alpha: { start: 0.7, end: 0 },
        tint: [0x8ff3ff, 0x3fb8d8], blendMode: 'ADD' });
      this.fxWisp.setDepth(21);
    },

    readInput: function () {
      var k = this.keys, t = this.touch;
      var left = k.LEFT.isDown || k.A.isDown || t.left, right = k.RIGHT.isDown || k.D.isDown || t.right;
      var jump = k.SPACE.isDown || k.UP.isDown || k.W.isDown || k.Z.isDown || t.jump;
      var sacHeld = k.X.isDown || k.K.isDown || k.DOWN.isDown || k.S.isDown || t.sac;
      var sac = sacHeld && !this.prevSac; this.prevSac = sacHeld;
      if (this.autoInput) return this.autoInput();
      return { left: left, right: right, jump: jump, sac: sac };
    },

    update: function (time, delta) {
      var k = this.keys;
      if (!this.paused && this.mode !== 'won') {
        if (Phaser.Input.Keyboard.JustDown(k.ESC) || Phaser.Input.Keyboard.JustDown(k.P)) { this.hud.togglePause(true); }
        else if (Phaser.Input.Keyboard.JustDown(k.R)) { this.restartChamber(); return; }
        else if (Phaser.Input.Keyboard.JustDown(k.U)) { this.releaseLast(); }
        else if (Phaser.Input.Keyboard.JustDown(k.H)) { this.hud.showHint(); }
      } else if (this.paused && (Phaser.Input.Keyboard.JustDown(k.ESC) || Phaser.Input.Keyboard.JustDown(k.P))) { this.hud.togglePause(false); }
      if (this.paused) return;
      this.acc += Math.min(delta, 100) * (this.timeScale || 1);
      var n = 0;
      while (this.acc >= STEP && n < 5) { this.acc -= STEP; this.fixedStep(); n++; }
      this.render(delta);
    },

    fixedStep: function () {
      var w = this.world;
      if (this.hitstop > 0) { this.hitstop--; return; }
      if (this.mode === 'play') {
        var inp = this.readInput();
        w.step(inp);
        this.handleEvents();
        if (w.won) this.beginWin();
        else if (w.dead) this.beginDeath();
        else if (w.ended) this.beginSacrifice();
      } else if (this.mode === 'dying' || this.mode === 'kneel') {
        this.modeT++;
        // world keeps ticking for ambience (arrows, movers) but the player is out
        w.step({}); this.handleEvents(true);
        var dur = this.mode === 'dying' ? 52 : 34;
        if (this.modeT >= dur) this.respawn();
      } else if (this.mode === 'won') {
        this.modeT++;
      }
    },

    handleEvents: function (quiet) {
      var self = this, w = this.world, ev = w.events; w.events = [];
      ev.forEach(function (e) {
        switch (e.type) {
          case 'jump': if (quiet) break; Snd.play('jump', 0.35, 0.95 + Math.random() * 0.1); self.sq.x = 0.78; self.sq.y = 1.22; self.fxDust.explode(5, e.x, e.y); break;
          case 'land': if (quiet) break; var im = Math.min(1, (e.v || 3) / 7); Snd.play('land', 0.25 + im * 0.3); self.sq.x = 1 + 0.3 * im; self.sq.y = 1 - 0.25 * im;
            self.fxDust.explode(4 + Math.round(im * 6), e.x, e.y); if (im > 0.85 && Save.data.shake) self.cameras.main.shake(70, 0.002); break;
          case 'step': if (quiet) break; Snd.play(Math.random() < 0.5 ? 'step1' : 'step2', 0.12, 0.9 + Math.random() * 0.2); if (Math.random() < 0.5) self.fxDust.explode(1, e.x, e.y); break;
          case 'plate': Snd.play('plate', e.on ? 0.5 : 0.3, e.on ? 1 : 0.8); if (e.on) { self.fxSpark.explode(6, e.x, e.y); self.fxSoul.explode(4, e.x, e.y); } break;
          case 'gate': Snd.play('gate', 0.4, e.open ? 1.1 : 0.85); self.fxDust.explode(8, e.x, e.y); if (!e.open && Save.data.shake) self.cameras.main.shake(80, 0.002); break;
          case 'arrowFire': Snd.play('arrow', 0.22, 1.2); self.fxDust.explode(3, e.x, e.y); var lv = self.launcherViews.find(function (s) { return Math.abs(s.x - e.x) < 20 && Math.abs(s.y - e.y) < 4; });
            if (lv) self.tweens.add({ targets: lv, scaleX: 0.85, duration: 60, yoyo: true }); break;
          case 'arrowHit':
            if (e.how === 'blocked') { Snd.play('thunk', 0.35, 1.3); self.fxSoul.explode(8, e.x, e.y); self.fxSpark.explode(4, e.x, e.y); }
            else if (e.how === 'thunk') { Snd.play('thunk', 0.22); self.fxDust.explode(4, e.x, e.y); self.stuckArrow(e); }
            break;
          case 'death': self.deathFx(e); break;
          case 'sacrifice': self.sacFx(e); break;
          case 'win': break;
        }
      });
    },

    stuckArrow: function (e) {
      var s = this.add.image(e.x - e.dir * 6, e.y, 'props', 6).setFlipX(e.dir < 0).setDepth(6);
      this.tweens.add({ targets: s, alpha: 0, delay: 700, duration: 500, onComplete: function () { s.destroy(); } });
    },

    deathFx: function (e) {
      Snd.play('death', 0.6);
      this.hitstop = 5;
      if (Save.data.shake) this.cameras.main.shake(180, 0.007);
      this.fxShard.explode(18, e.x, e.y);
      this.fxSoul.explode(16, e.x, e.y - 4);
      this.pl.setTintFill(0xffffff);
      var self = this;
      this.time.delayedCall(90, function () { self.pl.clearTint(); self.pl.setTint(0xff9a9a); });
      this.cameras.main.flash(120, 120, 30, 50);
    },
    sacFx: function (e) {
      Snd.play('sacrifice', 0.55);
      this.fxSoul.explode(22, e.x, e.y);
      var ring = this.add.image(e.x, e.y + 15, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8ff3ff).setScale(0.2, 0.08).setDepth(22);
      this.tweens.add({ targets: ring, scaleX: 1.6, scaleY: 0.4, alpha: 0, duration: 650, onComplete: function () { ring.destroy(); } });
      if (Save.data.shake) this.cameras.main.shake(100, 0.003);
    },

    beginDeath: function () { this.mode = 'dying'; this.modeT = 0; this.world.p.state = 'dead'; },
    beginSacrifice: function () { this.mode = 'kneel'; this.modeT = 0; },

    respawn: function () {
      var w = this.world, cause = w.dead ? (w.deathCause === 'pit' ? 'pit' : 'death') : 'sacrifice';
      var removed = w.commitEcho(cause);
      w.newAttempt();
      this.mode = 'play'; this.modeT = 0; this.acc = 0;
      this.syncAll(true);
      this.spawnFx(false);
      Snd.play('echo', 0.45);
      this.cameras.main.flash(260, 60, 140, 170);
      var msg = cause === 'pit' ? 'The abyss keeps no Echo' : (removed ? 'Your oldest Echo fades' : 'An Echo remains');
      this.hud.toast(msg);
      this.hud.refresh();
    },

    spawnFx: function (first) {
      var s = this.L.start, x = s.x + P.w / 2, y = s.y + P.h;
      this.fxSoul.explode(first ? 10 : 18, x, y - 14);
      var ring = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setScale(1.4, 0.3).setDepth(22).setAlpha(0.8);
      this.tweens.add({ targets: ring, scaleX: 0.2, alpha: 0, duration: 500, onComplete: function () { ring.destroy(); } });
      this.pl.setAlpha(0); this.tweens.add({ targets: this.pl, alpha: 1, duration: 260 });
      this.pl.clearTint();
      this.sq.x = 0.7; this.sq.y = 1.3;
    },

    beginWin: function () {
      var self = this, w = this.world;
      this.mode = 'won'; this.modeT = 0;
      Snd.play('exit', 0.55);
      var ex = this.L.exit.x + 8, ey = this.L.exit.y - 8;
      this.fxGold.explode(40, ex, ey);
      this.cameras.main.flash(300, 255, 220, 150);
      this.tweens.add({ targets: this.pl, alpha: 0, scaleX: 0.4, scaleY: 1.4, duration: 420, ease: 'Quad.easeIn' });
      window.Portal && window.Portal.gameplayStop();
      var used = w.echoesUsed, stars = starsFor(this.def, used), id = this.levelIndex;
      var d = Save.data, prev = d.stars[id] || 0, best = d.best[id];
      d.stars[id] = Math.max(prev, stars);
      d.best[id] = { echoes: best ? Math.min(best.echoes, used) : used, frames: best ? Math.min(best.frames, w.totalFrames) : w.totalFrames };
      d.unlocked = Math.max(d.unlocked, Math.min(LEVELS.length, id + 2));
      Save.save();
      if (stars === 3) window.Portal && window.Portal.happytime();
      this.time.delayedCall(950, function () { self.hud.showComplete({ stars: stars, used: used, par: self.def.par, frames: w.totalFrames, newBest: stars > prev }); });
    },

    restartChamber: function () {
      if (this._leaving) return; this._leaving = true;
      var self = this;
      Snd.play('whoosh', 0.4);
      this.cameras.main.fadeOut(220, 5, 3, 10);
      this.cameras.main.once('camerafadeoutcomplete', function () { self.scene.restart({ level: self.levelIndex, bonusSlots: self.bonusSlots }); });
    },
    releaseLast: function () {
      if (this.mode !== 'play' || !this.world.echoes.length) return;
      var e = this.world.echoes[this.world.echoes.length - 1], v = this.echoViews[e.id];
      if (v) this.fxSoul.explode(14, e.x + 6, e.y + 15);
      this.world.releaseLastEcho(); this.world.newAttempt(); this.acc = 0;
      this.syncAll(true); this.spawnFx(false); Snd.play('whoosh', 0.4);
      this.hud.toast('Echo released'); this.hud.refresh();
    },
    addSlot: function () { this.bonusSlots++; this.world.maxEchoes++; this.hud.refresh(); this.hud.toast('One more Echo may linger'); },
    goTo: function (key, data) { this.scene.stop('Hud'); fadeTo(this, key, data); },

    syncAll: function (reset) {
      var self = this, w = this.world, live = {};
      w.echoes.forEach(function (e) { live[e.id] = true; if (!self.echoViews[e.id]) self.echoViews[e.id] = self.makeEchoView(e); });
      Object.keys(this.echoViews).forEach(function (id) {
        if (!live[id]) { var v = self.echoViews[id]; [v.spr, v.aura, v.glow, v.top, v.rune].forEach(function (o) { o.destroy(); }); delete self.echoViews[id]; }
      });
      this.arrowViews.forEach(function (a) { a.setVisible(false); });
      if (reset) { this.look = 0; }
    },
    makeEchoView: function (e) {
      var v = {
        glow: this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x3fb8d8).setAlpha(0.3).setScale(0.9, 1.1).setDepth(19),
        rune: this.add.image(0, 0, 'props', 10).setDepth(19.5).setAlpha(0).setScale(0.8),
        aura: this.add.sprite(0, 0, 'hero', 0).setOrigin(0.5, 60 / 64).setTintFill(0x8ff3ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setScale(1.08).setDepth(20),
        spr: this.add.sprite(0, 0, 'hero', 0).setOrigin(0.5, 60 / 64).setTint(0x7fdcff).setAlpha(0.6).setDepth(20.5),
        top: this.add.image(0, 0, 'pix').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8ff3ff).setDisplaySize(P.echoTopW - 4, 1).setAlpha(0).setDepth(20.6),
        frozenShown: false
      };
      return v;
    },

    render: function (delta) {
      var self = this, w = this.world, p = w.p, t = this.time.now;
      // player
      var st = this.mode === 'dying' ? 'dead' : (this.mode === 'kneel' ? 'kneel' : p.state);
      var fr = st === 'dead' ? 21 + Math.min(2, Math.floor(this.modeT / 6)) : st === 'kneel' ? 24 + Math.min(2, Math.floor(this.modeT / 5)) : heroFrame(st, p.animT);
      this.pl.setFrame(fr).setFlipX(p.flip);
      this.sq.x += (1 - this.sq.x) * 0.2; this.sq.y += (1 - this.sq.y) * 0.2;
      if (this.mode !== 'won') this.pl.setScale(this.sq.x, this.sq.y);
      this.pl.setPosition(Math.round(p.x + P.w / 2), Math.round(p.y + P.h));
      if (this.mode === 'dying' && this.modeT > 20) this.pl.setAlpha(Math.max(0, 1 - (this.modeT - 20) / 25));
      if (this.mode === 'kneel') { this.pl.setTint(Phaser.Display.Color.GetColor(255 - this.modeT * 4, 255, 255)); this.pl.setAlpha(Math.max(0.2, 1 - this.modeT / 40)); }
      this.plGlow.setPosition(this.pl.x, this.pl.y - 16).setAlpha(this.mode === 'play' ? 0.16 : 0);
      // camera look-ahead
      var want = p.flip ? -26 : 26; if (Math.abs(p.vx) < 0.3) want *= 0.5;
      this.look += (want - this.look) * 0.04;
      this.camT.setPosition(p.x + P.w / 2 + this.look, p.y + P.h / 2 - 12);
      // echoes
      w.echoes.forEach(function (e) {
        var v = self.echoViews[e.id]; if (!v) return;
        var f = e.rec[e.idx], es = SIM.STATES[f[2]] || 'idle', ef = heroFrame(es, f[4]);
        var x = Math.round(e.x + P.w / 2), y = Math.round(e.y + P.h);
        var fl = !!f[3];
        v.spr.setFrame(ef).setFlipX(fl).setPosition(x, y);
        v.aura.setFrame(ef).setFlipX(fl).setPosition(x, y);
        v.glow.setPosition(x, y - 15);
        v.top.setPosition(x, e.y + 0.5);
        v.rune.setPosition(x, y - 6);
        var vis = !e.gone;
        [v.spr, v.aura, v.glow, v.top, v.rune].forEach(function (o) { o.setVisible(vis); });
        if (!vis) return;
        if (e.frozen) {
          if (!v.frozenShown) {
            v.frozenShown = true;
            v.spr.setTint(0x5fc8e8); self.fxSoul.explode(10, x, y - 15);
            v.top.setAlpha(0.9); v.rune.setAlpha(0.8);
            self.tweens.add({ targets: v.aura, scale: { from: 1.5, to: 1.08 }, alpha: { from: 0.6, to: 0.28 }, duration: 380 });
          }
          var pulse = 0.5 + 0.5 * Math.sin(t / 420 + e.id);
          v.spr.setAlpha(0.78 + pulse * 0.08); v.glow.setAlpha(0.26 + pulse * 0.12); v.top.setAlpha(0.55 + pulse * 0.35); v.rune.setAlpha(0.5 + pulse * 0.4);
        } else {
          if (v.frozenShown) { v.frozenShown = false; v.spr.setTint(0x7fdcff); v.top.setAlpha(0); v.rune.setAlpha(0); }
          v.spr.setAlpha(0.5 + 0.08 * Math.sin(t / 60 + e.id * 3));
          v.top.setAlpha(0.35);
          if (Math.random() < 0.25) self.fxWisp.emitParticleAt(x + (Math.random() * 10 - 5), y - Math.random() * 28);
        }
      });
      // plates
      this.plateViews.forEach(function (pv) { pv.s.setFrame(pv.p.pressed ? 2 : 1); pv.gl.setAlpha(pv.p.pressed ? 0.55 + 0.15 * Math.sin(t / 150) : 0); });
      // gates
      this.gateViews.forEach(function (gv) {
        gv.c.y = gv.g.y - gv.g.open * (gv.g.h - 2);
        var wantOpen = gv.g.open > 0.5;
        gv.rune.setAlpha(wantOpen ? 0.9 : 0.35);
      });
      // movers
      this.moverViews.forEach(function (mv) { mv.c.setPosition(Math.round(mv.m.x), Math.round(mv.m.y)); });
      // arrows
      w.arrows.forEach(function (a, i) {
        var s = self.arrowViews[i];
        if (!s) { s = self.add.image(0, 0, 'props', 6).setDepth(30); self.arrowViews.push(s); }
        s.setVisible(true).setFlipX(a.dir < 0).setPosition(Math.round(a.x + a.w / 2), Math.round(a.y + 2));
      });
      for (var i = w.arrows.length; i < this.arrowViews.length; i++) this.arrowViews[i].setVisible(false);
      // parallax drift
      var cam = this.cameras.main;
      this.bg.drift.forEach(function (d) { d.o.tilePositionX = cam.scrollX * d.par + t * d.sp * 0.01; });
      this.fog.tilePositionX = t * 0.006;
      if (this.exitLight) this.exitLight.setAlpha(0.45 + 0.15 * Math.sin(t / 300));
    }
  });

  // ---------------- icons ----------------
  function icon(g, kind, s, col) {
    g.fillStyle(col || 0xe9dcff, 1); g.lineStyle(3, col || 0xe9dcff, 1);
    switch (kind) {
      case 'pause': g.fillRect(-s * 0.35, -s * 0.45, s * 0.25, s * 0.9); g.fillRect(s * 0.1, -s * 0.45, s * 0.25, s * 0.9); break;
      case 'restart': g.beginPath(); g.arc(0, 0, s * 0.42, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(250), false); g.strokePath();
        g.fillTriangle(s * 0.12, -s * 0.62, s * 0.42, -s * 0.36, s * 0.08, -s * 0.2); break;
      case 'hint': g.lineStyle(s * 0.16, col || 0xe9dcff, 1); g.beginPath(); g.arc(0, -s * 0.16, s * 0.24, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(80), false); g.strokePath();
        g.fillRect(-s * 0.08, s * 0.02, s * 0.16, s * 0.18); g.fillRect(-s * 0.08, s * 0.3, s * 0.16, s * 0.15); break;
      case 'left': g.fillTriangle(-s * 0.4, 0, s * 0.25, -s * 0.42, s * 0.25, s * 0.42); break;
      case 'right': g.fillTriangle(s * 0.4, 0, -s * 0.25, -s * 0.42, -s * 0.25, s * 0.42); break;
      case 'jump': g.fillTriangle(0, -s * 0.45, -s * 0.42, s * 0.2, s * 0.42, s * 0.2); g.fillRect(-s * 0.15, s * 0.15, s * 0.3, s * 0.28); break;
      case 'sac': // skull-ish rune
        g.fillCircle(0, -s * 0.08, s * 0.36); g.fillRect(-s * 0.22, s * 0.15, s * 0.44, s * 0.24);
        g.fillStyle(0x0e0a1a, 1).fillCircle(-s * 0.14, -s * 0.06, s * 0.1).fillCircle(s * 0.14, -s * 0.06, s * 0.1).fillRect(-s * 0.04, s * 0.18, s * 0.08, s * 0.2); break;
    }
  }
  function iconButton(scene, x, y, r, kind, cb) {
    var c = scene.add.container(x, y), g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillCircle(2, 3, r); g.fillStyle(0x1a1230, 0.85).fillCircle(0, 0, r); g.lineStyle(2, 0xb07a2a, 1).strokeCircle(0, 0, r);
    var ig = scene.add.graphics(); icon(ig, kind, r * 0.9);
    c.add([g, ig]); c.setSize(r * 2, r * 2); c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', function () { scene.tweens.add({ targets: c, scale: 0.9, duration: 60, yoyo: true }); });
    c.on('pointerup', function () { Snd.play('uiselect', 0.4); cb(); });
    return c;
  }
  function isTouch() { return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window; }

  // ---------------- HUD ----------------
  var Hud = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Hud() { Phaser.Scene.call(this, { key: 'Hud' }); },
    init: function (data) { this.gs = data.gs; this.overlay = null; this.hintRevealed = false; },
    create: function () {
      var self = this, gs = this.gs, def = gs.def;
      this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.85);
      // chamber label
      var wing = WINGS[def.wing];
      this.lblWing = this.add.text(22, 14, ROMAN[def.wing] + ' \u00b7 ' + wing.name.toUpperCase(), { fontFamily: 'DotGothic', fontSize: '13px', color: DIM }).setShadow(2, 2, '#000', 0, true, true);
      this.lblName = this.add.text(20, 28, (gs.levelIndex + 1) + '. ' + def.name, { fontFamily: 'Jacquard', fontSize: '34px', color: GOLD }).setShadow(2, 3, '#2a0a10', 0, true, true);
      this.slots = this.add.graphics();
      this.lblUsed = this.add.text(22, 98, '', { fontFamily: 'DotGothic', fontSize: '14px', color: PALE }).setShadow(2, 2, '#000', 0, true, true);
      // buttons
      this.btnPause = iconButton(this, VW - 40, 40, 24, 'pause', function () { self.togglePause(true); });
      this.btnRestart = iconButton(this, VW - 100, 40, 24, 'restart', function () { gs.restartChamber(); });
      this.btnHint = iconButton(this, VW - 160, 40, 24, 'hint', function () { self.showHint(); });
      // toast
      this.toastT = txt(this, VW / 2, 96, '', 20, CYAN).setAlpha(0);
      // touch controls
      this.touchUI = null;
      if (isTouch()) this.buildTouch();
      this.input.on('pointerdown', function (p) { if (p.wasTouch && !self.touchUI) self.buildTouch(); });
      this.refresh();
      this.banner();
      this.keysH = this.input.keyboard.addKeys('ENTER,SPACE,N');
    },
    banner: function () {
      var gs = this.gs, def = gs.def;
      var c = this.add.container(VW / 2, VH * 0.36).setAlpha(0);
      var a = txt(this, 0, -36, 'CHAMBER ' + (gs.levelIndex + 1), 16, DIM);
      var b = txt(this, 0, 4, def.name, 64, GOLD, 'Jacquard');
      var line = this.add.graphics(); line.fillStyle(0xd89a3a, 0.8).fillRect(-150, 44, 300, 2); line.fillStyle(0xffd27a, 1).fillRect(-4, 41, 8, 8);
      var items = [a, b, line];
      if (def.intro) items.push(txt(this, 0, 74, def.intro, 16, PALE));
      c.add(items);
      this.tweens.add({ targets: c, alpha: 1, y: VH * 0.34, duration: 500, ease: 'Quad.easeOut', hold: def.intro ? 2600 : 1300, yoyo: true, onComplete: function () { c.destroy(); } });
    },
    refresh: function () {
      var w = this.gs.world, g = this.slots, max = w.maxEchoes, act = w.echoes.length;
      g.clear();
      for (var i = 0; i < max; i++) {
        var x = 32 + i * 26, y = 84;
        g.fillStyle(0x000000, 0.4).fillCircle(x + 1, y + 2, 9);
        g.fillStyle(i < act ? 0x3fb8d8 : 0x1a1230, 1).fillCircle(x, y, 9);
        g.lineStyle(2, i < act ? 0x8ff3ff : 0x5a4a7a, 1).strokeCircle(x, y, 9);
        if (i < act) g.fillStyle(0xe6fbff, 1).fillCircle(x - 2, y - 2, 3);
      }
      this.lblUsed.setText('Echoes used ' + w.echoesUsed + '   \u00b7   Par ' + this.gs.def.par);
    },
    toast: function (s) {
      var t = this.toastT; t.setText(s); this.tweens.killTweensOf(t); t.setAlpha(0).setY(104);
      this.tweens.add({ targets: t, alpha: 1, y: 96, duration: 200, hold: 1100, yoyo: true });
    },
    buildTouch: function () {
      var self = this, c = this.touchUI = this.add.container(0, 0).setDepth(5);
      var defs = [{ k: 'left', x: 92, y: VH - 92, r: 58 }, { k: 'right', x: 222, y: VH - 92, r: 58 }, { k: 'jump', x: VW - 96, y: VH - 104, r: 68 }, { k: 'sac', x: VW - 238, y: VH - 74, r: 48 }];
      this.tbtn = defs.map(function (d) {
        var g = self.add.graphics(), ig = self.add.graphics();
        icon(ig, d.k, d.r * 0.7, d.k === 'sac' ? 0x8ff3ff : 0xe9dcff); ig.setPosition(d.x, d.y);
        c.add([g, ig]); d.g = g; d.on = false; return d;
      });
      this.drawTouch();
    },
    drawTouch: function () {
      if (!this.tbtn) return;
      this.tbtn.forEach(function (d) {
        d.g.clear(); d.g.fillStyle(d.on ? 0x3a2560 : 0x150f24, d.on ? 0.75 : 0.45).fillCircle(d.x, d.y, d.r);
        d.g.lineStyle(2, d.k === 'sac' ? 0x3fb8d8 : 0xb07a2a, d.on ? 1 : 0.6).strokeCircle(d.x, d.y, d.r);
      });
    },
    update: function () {
      var gs = this.gs;
      if (this.tbtn) {
        var st = { left: false, right: false, jump: false, sac: false }, ptrs = this.input.manager.pointers, changed = false, self = this;
        if (!this.overlay) ptrs.forEach(function (p) {
          if (!p.isDown) return;
          self.tbtn.forEach(function (d) { var dx = p.x - d.x, dy = p.y - d.y; if (dx * dx + dy * dy < (d.r + 18) * (d.r + 18)) st[d.k] = true; });
          // generous zones: lower-left half splits left/right
          if (p.y > VH * 0.55 && p.x < 300 && !st.left && !st.right) { if (p.x < 157) st.left = true; else st.right = true; }
        });
        this.tbtn.forEach(function (d) { if (d.on !== st[d.k]) { d.on = st[d.k]; changed = true; } });
        if (changed) this.drawTouch();
        gs.touch = st;
      }
      if (this.overlay && this.overlay.kind === 'complete' && (Phaser.Input.Keyboard.JustDown(this.keysH.ENTER) || Phaser.Input.Keyboard.JustDown(this.keysH.N))) this.overlay.goNext && this.overlay.goNext();
    },
    closeOverlay: function () { if (this.overlay) { this.overlay.destroy(); this.overlay = null; } },
    dim: function (kind) {
      this.closeOverlay();
      var c = this.add.container(0, 0).setDepth(10); c.kind = kind;
      var r = this.add.rectangle(0, 0, VW, VH, 0x05030a, 0.72).setOrigin(0).setInteractive();
      c.add(r); this.overlay = c; return c;
    },
    togglePause: function (on) {
      var self = this, gs = this.gs;
      if (gs.mode === 'won') return;
      if (!on) { this.closeOverlay(); gs.paused = false; return; }
      gs.paused = true;
      var c = this.dim('pause');
      c.add(panel(this, VW / 2, VH / 2, 420, 440));
      c.add(txt(this, VW / 2, VH / 2 - 182, 'Paused', 52, GOLD, 'Jacquard'));
      var y = VH / 2 - 118, items = [
        ['Resume', function () { self.togglePause(false); }],
        ['Restart chamber  (R)', function () { self.togglePause(false); gs.restartChamber(); }],
        ['Release last Echo  (U)', function () { self.togglePause(false); gs.releaseLast(); }],
        [(window.Portal && window.Portal.hasAds() ? '\u25b6 ' : '') + '+1 Echo slot', function () { self.reward(function () { self.togglePause(false); gs.addSlot(); }); }],
        ['Settings', function () { openSettings(self, function () { self.togglePause(true); }); }],
        ['Chambers', function () { gs.paused = false; gs.goTo('Select'); }],
        ['Main menu', function () { gs.paused = false; gs.goTo('Title'); }]
      ];
      items.forEach(function (it, i) { c.add(button(self, VW / 2, y + i * 50, 320, 40, it[0], it[1], { size: 18 })); });
    },
    reward: function (grant) {
      var self = this;
      if (!window.Portal) { grant(); return; }
      window.Portal.rewarded(function (ok) { if (ok) grant(); else self.toast('No reward this time'); });
    },
    showHint: function () {
      var self = this, gs = this.gs;
      if (gs.mode === 'won') return;
      gs.paused = true;
      var c = this.dim('hint');
      c.add(panel(this, VW / 2, VH / 2, 560, 300));
      c.add(txt(this, VW / 2, VH / 2 - 104, 'The Oracle', 46, GOLD, 'Jacquard'));
      if (this.hintRevealed) {
        var t = txt(this, VW / 2, VH / 2 - 10, gs.def.hint, 18, PALE); t.setWordWrapWidth(470); c.add(t);
        c.add(button(this, VW / 2, VH / 2 + 104, 200, 42, 'Back to it', function () { self.closeOverlay(); gs.paused = false; }));
      } else {
        c.add(txt(this, VW / 2, VH / 2 - 30, 'Stuck in this chamber?\nThe Oracle can show you the way.', 18, PALE));
        var ads = window.Portal && window.Portal.hasAds();
        c.add(button(this, VW / 2 - 110, VH / 2 + 84, 200, 42, ads ? '\u25b6 Reveal hint' : 'Reveal hint', function () {
          self.reward(function () { self.hintRevealed = true; self.showHint(); });
        }));
        c.add(button(this, VW / 2 + 110, VH / 2 + 84, 200, 42, 'Not yet', function () { self.closeOverlay(); gs.paused = false; }));
      }
    },
    showComplete: function (r) {
      var self = this, gs = this.gs, i = gs.levelIndex, last = i >= LEVELS.length - 1;
      var c = this.dim('complete');
      var pnl = panel(this, VW / 2, VH / 2, 520, 380); c.add(pnl);
      c.add(txt(this, VW / 2, VH / 2 - 140, last ? 'The Crown is Yours' : 'Chamber Cleared', 54, GOLD, 'Jacquard'));
      c.add(txt(this, VW / 2, VH / 2 - 96, gs.def.name, 18, DIM));
      var sg = this.add.graphics(); c.add(sg);
      for (var s = 0; s < 3; s++) starShape(sg, VW / 2 + (s - 1) * 84, VH / 2 - 30, 30, false);
      for (var s2 = 0; s2 < r.stars; s2++) (function (k) {
        self.time.delayedCall(350 + k * 260, function () {
          var g = self.add.graphics(); starShape(g, 0, 0, 30, true); g.setPosition(VW / 2 + (k - 1) * 84, VH / 2 - 30).setScale(2).setAlpha(0);
          c.add(g); self.tweens.add({ targets: g, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
          Snd.play('star', 0.5, 1 + k * 0.12);
        });
      })(s2);
      if (r.stars === 3) this.time.delayedCall(350 + 3 * 260, function () { Snd.play('fanfare', 0.35); });
      c.add(txt(this, VW / 2, VH / 2 + 30, 'Echoes used  ' + r.used + '   \u00b7   Par  ' + r.par + '   \u00b7   Time  ' + fmtTime(r.frames), 18, PALE));
      c.add(txt(this, VW / 2, VH / 2 + 58, r.stars < 3 ? 'Finish at par for three stars.' : (r.newBest ? 'Flawless. The curse trembles.' : 'Flawless.'), 15, r.stars < 3 ? DIM : CYAN));
      var y = VH / 2 + 118;
      c.goNext = function () { if (last) gs.goTo('Title', { credits: true }); else gs.goTo('Game', { level: i + 1 }); };
      c.add(button(this, VW / 2 - 165, y, 150, 44, 'Replay', function () { gs.goTo('Game', { level: i }); }, { size: 18 }));
      c.add(button(this, VW / 2, y, 150, 44, 'Chambers', function () { gs.goTo('Select'); }, { size: 18 }));
      c.add(button(this, VW / 2 + 165, y, 150, 44, last ? 'Epilogue' : 'Next  \u25b8', c.goNext, { size: 18, color: GOLD }));
      c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    }
  });

  // ---------------- shared overlays ----------------
  function openSettings(scene, onClose) {
    var hud = scene.overlay !== undefined; // HUD has overlay mgmt
    var c = scene.add.container(0, 0).setDepth(20);
    if (hud) { scene.closeOverlay(); scene.overlay = c; c.kind = 'settings'; }
    c.add(scene.add.rectangle(0, 0, VW, VH, 0x05030a, 0.75).setOrigin(0).setInteractive());
    c.add(panel(scene, VW / 2, VH / 2, 440, 400));
    c.add(txt(scene, VW / 2, VH / 2 - 150, 'Settings', 50, GOLD, 'Jacquard'));
    var d = Save.data;
    var rows = [
      ['Music', function () { return d.music; }, function () { d.music = !d.music; Save.save(); Snd.refresh(scene); }],
      ['Sound effects', function () { return d.sfx; }, function () { d.sfx = !d.sfx; Save.save(); }],
      ['Screen shake', function () { return d.shake; }, function () { d.shake = !d.shake; Save.save(); }]
    ];
    rows.forEach(function (r, i) {
      var b = button(scene, VW / 2, VH / 2 - 80 + i * 56, 320, 44, '', null, { size: 19 });
      function lab() { b.label.setText(r[0] + ':  ' + (r[1]() ? 'On' : 'Off')); }
      lab(); b.on('pointerup', function () { r[2](); lab(); });
      c.add(b);
    });
    if (scene.scale.fullscreenAvailable !== false) {
      var fb = button(scene, VW / 2, VH / 2 + 88, 320, 44, 'Toggle fullscreen', function () { if (scene.scale.isFullscreen) scene.scale.stopFullscreen(); else scene.scale.startFullscreen(); }, { size: 19 });
      c.add(fb);
    }
    c.add(button(scene, VW / 2, VH / 2 + 150, 200, 44, 'Done', function () { c.destroy(); if (hud) scene.overlay = null; onClose && onClose(); }, { size: 20, color: GOLD }));
    return c;
  }
  var CREDITS = [
    ['Game', 'Echo Run, built with Phaser 3 (MIT)'],
    ['Art', 'Gothicvania Church Pack & Patreon\'s Collection\nby Luis Zuno (ansimuz), CC0'],
    ['Music', '"Lament for a Warrior\'s Soul", "Exploration",\n"The Old Tower Inn" by RandomMind, CC0'],
    ['Sound', 'Kenney RPG Audio (CC0) \u00b7 80 CC0 RPG SFX (rubberduck)\n\u00b7 512 Retro SFX by Juhani Junkala (CC0)'],
    ['Fonts', 'Jacquard 24 & DotGothic16, SIL Open Font License 1.1']
  ];
  function openCredits(scene, onClose) {
    var c = scene.add.container(0, 0).setDepth(20);
    c.add(scene.add.rectangle(0, 0, VW, VH, 0x05030a, 0.8).setOrigin(0).setInteractive());
    c.add(panel(scene, VW / 2, VH / 2, 640, 470));
    c.add(txt(scene, VW / 2, VH / 2 - 190, 'Credits', 50, GOLD, 'Jacquard'));
    CREDITS.forEach(function (r, i) {
      c.add(txt(scene, VW / 2, VH / 2 - 132 + i * 64, r[0].toUpperCase(), 13, DIM));
      c.add(txt(scene, VW / 2, VH / 2 - 106 + i * 64, r[1], 15, PALE));
    });
    c.add(button(scene, VW / 2, VH / 2 + 196, 180, 42, 'Close', function () { c.destroy(); onClose && onClose(); }, { size: 19 }));
    return c;
  }

  // ---------------- Title ----------------
  var Title = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Title() { Phaser.Scene.call(this, { key: 'Title' }); },
    init: function (data) { this._leaving = false; this.showCredits = data && data.credits; },
    create: function () {
      var self = this;
      backdrop(this, 'nave', null);
      // ground ledge
      var g = this.add.graphics();
      for (var x = 0; x < VW; x += 48) { this.add.image(x, VH - 72, 'tiles', 13 + (x / 48) % 9).setOrigin(0).setScale(3); this.add.image(x, VH - 24, 'tiles', 22 + (x / 48) % 9).setOrigin(0).setScale(3); }
      // echoes and hero
      var hx = 250, hy = VH - 72;
      [[-120, 0.25, 3], [-62, 0.4, 1]].forEach(function (e) {
        var gl = self.add.image(hx + e[0], hy - 50, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x3fb8d8).setAlpha(0.3).setScale(2.6);
        var a = self.add.sprite(hx + e[0], hy, 'hero', e[2]).setOrigin(0.5, 60 / 64).setScale(3).setTint(0x7fdcff).setAlpha(e[1] + 0.2);
        var au = self.add.sprite(hx + e[0], hy, 'hero', e[2]).setOrigin(0.5, 60 / 64).setScale(3.2).setTintFill(0x8ff3ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.15);
        self.tweens.add({ targets: [a, au, gl], alpha: '-=0.1', duration: 1400 + e[0] * -4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });
      this.add.image(hx, hy - 60, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa060).setAlpha(0.22).setScale(3);
      this.add.sprite(hx, hy, 'hero').setOrigin(0.5, 60 / 64).setScale(3).play('h_idle');
      this.add.particles(0, 0, 'pix', { x: { min: hx - 160, max: hx + 30 }, y: { min: hy - 140, max: hy }, lifespan: 1600, speedY: { min: -30, max: -10 },
        scale: { start: 1, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0x8ff3ff, 0x3fb8d8], blendMode: 'ADD', frequency: 90 });
      this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.9);
      // title
      var tx = VW * 0.66;
      var t1 = txt(this, tx, 118, 'Echo Run', 132, GOLD, 'Jacquard'); t1.setShadow(4, 6, '#3a0a14', 0, true, true);
      this.tweens.add({ targets: t1, y: 112, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      var orn = this.add.graphics(); orn.fillStyle(0xd89a3a, 0.9).fillRect(tx - 170, 186, 340, 2); orn.fillStyle(0xffd27a, 1).fillRect(tx - 5, 182, 10, 10);
      txt(this, tx, 210, 'THE  THORNBOUND  CITADEL', 20, PALE);
      txt(this, tx, 244, 'Every death leaves an Echo. Climb upon your past.', 15, DIM);
      var cont = Save.data.unlocked > 1 || Object.keys(Save.data.stars).length;
      var by = 306;
      button(this, tx, by, 280, 50, cont ? 'Continue' : 'Begin', function () {
        var next = Math.min(LEVELS.length - 1, Save.data.unlocked - 1);
        fadeTo(self, 'Game', { level: next });
      }, { size: 24, color: GOLD });
      button(this, tx, by + 62, 280, 44, 'Chambers', function () { fadeTo(self, 'Select'); });
      button(this, tx - 72, by + 118, 136, 40, 'Settings', function () { openSettings(self); }, { size: 17 });
      button(this, tx + 72, by + 118, 136, 40, 'Credits', function () { openCredits(self); }, { size: 17 });
      txt(this, tx, VH - 28, '\u2605 ' + Save.totalStars() + ' / ' + LEVELS.length * 3 + '      \u2190 \u2192 move  \u00b7  SPACE jump  \u00b7  X sacrifice', 14, DIM);
      this.cameras.main.fadeIn(500, 5, 3, 10);
      if (this.sound.locked) this.sound.once('unlocked', function () { Snd.musicFor('music_menu', self); }); else Snd.musicFor('music_menu', this);
      if (this.showCredits) this.time.delayedCall(300, function () { openCredits(self); });
      this.input.keyboard.once('keydown-ENTER', function () { fadeTo(self, 'Game', { level: Math.min(LEVELS.length - 1, Save.data.unlocked - 1) }); });
    }
  });

  // ---------------- Level select ----------------
  var Select = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Select() { Phaser.Scene.call(this, { key: 'Select' }); },
    init: function () { this._leaving = false; },
    create: function () {
      var self = this;
      backdrop(this, 'nave', null);
      this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.9);
      txt(this, VW / 2, 52, 'Chambers of the Citadel', 54, GOLD, 'Jacquard');
      txt(this, VW / 2, 92, '\u2605 ' + Save.totalStars() + ' / ' + LEVELS.length * 3, 16, DIM);
      WINGS.forEach(function (w, wi) {
        var y = 160 + wi * 128;
        txt(self, 140, y + 2, ROMAN[wi], 40, GOLD, 'Jacquard');
        txt(self, 140, y + 36, w.name, 13, DIM);
        LEVELS.forEach(function (lv, i) {
          if (lv.wing !== wi) return;
          var col = i - wi * 4, x = 300 + col * 158, unlocked = i < Save.data.unlocked, stars = Save.data.stars[i] || 0;
          var c = self.add.container(x, y + 10);
          var g = self.add.graphics();
          function draw(h) {
            g.clear(); g.fillStyle(0x000000, 0.4).fillRoundedRect(-62, -44, 128, 98, 8);
            g.fillStyle(unlocked ? (h ? 0x3a2560 : 0x22163a) : 0x120c1e, 1).fillRoundedRect(-64, -48, 128, 96, 8);
            g.lineStyle(2, unlocked ? (h ? 0xffd27a : 0xb07a2a) : 0x3a2f52, 1).strokeRoundedRect(-64, -48, 128, 96, 8);
          }
          draw(false);
          c.add(g);
          if (unlocked) {
            c.add(txt(self, 0, -18, String(i + 1), 40, PALE, 'Jacquard'));
            var sg = self.add.graphics(); for (var s = 0; s < 3; s++) starShape(sg, (s - 1) * 26, 18, 10, s < stars); c.add(sg);
            c.add(txt(self, 0, 38, lv.name, 11, DIM));
            c.setSize(128, 96).setInteractive({ useHandCursor: true });
            c.on('pointerover', function () { draw(true); Snd.play('uimove', 0.25); self.tweens.add({ targets: c, scale: 1.05, duration: 90 }); });
            c.on('pointerout', function () { draw(false); self.tweens.add({ targets: c, scale: 1, duration: 90 }); });
            c.on('pointerup', function () { Snd.play('uiselect', 0.5); fadeTo(self, 'Game', { level: i }); });
          } else {
            var lg = self.add.graphics(); lg.fillStyle(0x3a2f52, 1).fillRoundedRect(-12, -6, 24, 20, 3); lg.lineStyle(4, 0x3a2f52, 1).strokeCircle(0, -8, 8); c.add(lg);
          }
        });
      });
      button(this, 90, VH - 40, 130, 40, '\u25c2 Back', function () { fadeTo(self, 'Title'); }, { size: 18 });
      this.input.keyboard.once('keydown-ESC', function () { fadeTo(self, 'Title'); });
      this.cameras.main.fadeIn(350, 5, 3, 10);
      if (this.sound.locked) this.sound.once('unlocked', function () { Snd.musicFor('music_menu', self); }); else Snd.musicFor('music_menu', this);
    }
  });

  // ---------------- start ----------------
  function start() {
    if (isTouch()) { var r = document.getElementById('rotate'); r && r.classList.add('touch'); }
    var cfg = {
      type: Phaser.AUTO, parent: 'game', width: VW, height: VH, backgroundColor: '#07050d', pixelArt: true, roundPixels: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 4 }, fps: { target: 60, smoothStep: true },
      scene: [Boot, Title, Select, Game, Hud]
    };
    window.game = new Phaser.Game(cfg);
  }
  var fontsReady = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('32px Jacquard'), document.fonts.load('16px DotGothic')]) : Promise.resolve();
  var portalReady = window.Portal ? window.Portal.init() : Promise.resolve();
  var started = false;
  function go() { if (!started) { started = true; start(); } }
  Promise.all([fontsReady, portalReady]).then(go, go);
  setTimeout(go, 3000);
})();
