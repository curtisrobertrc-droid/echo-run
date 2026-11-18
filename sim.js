/* Echo Run - deterministic simulation (no rendering). Shared by the game and the Node tests. */
(function (root) {
  'use strict';
  var T = 16;
  var P = { grav: 0.42, maxFall: 7.2, run: 1.95, accel: 0.4, decel: 0.55, airAccel: 0.3, airDecel: 0.12,
    jumpV: -6.75, jumpCut: 0.45, coyote: 6, buffer: 8, w: 12, h: 30, echoTopW: 20 };

  function parse(def) {
    var rows = def.map, H = rows.length, W = 0, i, x, y;
    for (i = 0; i < H; i++) W = Math.max(W, rows[i].length);
    var L = { def: def, W: W, H: H, pw: W * T, ph: H * T, solid: [], oneway: [], spikes: [], plates: [], gates: {},
      launchers: [], movers: [], torches: [], start: null, exit: null, tips: def.tips || [] };
    for (y = 0; y < H; y++) {
      L.solid.push([]); L.oneway.push([]);
      for (x = 0; x < W; x++) {
        var c = rows[y][x] || '.';
        var s = (c === '#' || c === '<' || c === '>'), ow = (c === '=');
        L.solid[y].push(s); L.oneway[y].push(ow);
        if (c === '^') L.spikes.push({ x: x * T, y: y * T, up: true, r: { x: x * T + 2, y: y * T + 8, w: 12, h: 8 } });
        else if (c === 'v') L.spikes.push({ x: x * T, y: y * T, up: false, r: { x: x * T + 2, y: y * T, w: 12, h: 8 } });
        else if (c === 'P') L.start = { x: x * T + T / 2 - P.w / 2, y: (y + 1) * T - P.h };
        else if (c === 'E') L.exit = { x: x * T, y: y * T, r: { x: x * T - 2, y: y * T - 20, w: 20, h: 36 } };
        else if (c === 'T') L.torches.push({ x: x * T + 8, y: y * T + 8 });
        else if (c >= 'a' && c <= 'f') L.plates.push({ id: c, x: x * T, y: y * T, pressed: false });
        else if (c >= 'A' && c <= 'F') {
          var g = L.gates[c] || (L.gates[c] = { id: c, cells: [], invert: false, open: 0 });
          g.cells.push({ x: x, y: y });
        } else if (c === '<' || c === '>') L.launchers.push({ x: x * T, y: y * T, dir: c === '>' ? 1 : -1 });
        else if (c >= '1' && c <= '9') L.movers.push({ id: c, x0: x * T, y0: y * T });
      }
    }
    // gates: bounding columns (each gate is a vertical strip; allow multi columns)
    Object.keys(L.gates).forEach(function (k) {
      var g = L.gates[k], minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
      g.cells.forEach(function (c) { minx = Math.min(minx, c.x); maxx = Math.max(maxx, c.x); miny = Math.min(miny, c.y); maxy = Math.max(maxy, c.y); });
      g.x = minx * T; g.y = miny * T; g.w = (maxx - minx + 1) * T; g.h = (maxy - miny + 1) * T;
      var gd = (def.gates || {})[k] || {};
      g.invert = !!gd.invert; g.plates = gd.plates || [k.toLowerCase()]; g.all = !!gd.all;
    });
    L.launchers.forEach(function (l, i) {
      var ld = (def.launchers || [])[i] || {};
      l.period = ld.period || 70; l.offset = ld.offset || 0; l.speed = ld.speed || 3.2; l.plate = ld.plate || null;
    });
    Object.keys(def.movers || {}).forEach(function (id) {
      var md = def.movers[id]; if (md.at) L.movers.push({ id: id, x0: md.at[0] * T, y0: md.at[1] * T });
    });
    L.movers.forEach(function (m) {
      var md = (def.movers || {})[m.id] || {};
      m.dx = (md.dx || 0) * T; m.dy = (md.dy || 0) * T; m.speed = md.speed || 0.8; m.wait = md.wait == null ? 40 : md.wait;
      m.plate = md.plate || null; m.w = (md.w || 2) * T; m.dist = Math.sqrt(m.dx * m.dx + m.dy * m.dy);
    });
    if (!L.start) throw new Error('level has no P');
    return L;
  }

  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function World(def) {
    this.L = parse(def);
    this.maxEchoes = def.maxEchoes || 6;
    this.echoes = [];
    this.echoesUsed = 0;
    this.totalFrames = 0;
    this.won = false;
    this.newAttempt(true);
  }
  var W = World.prototype;

  W.newAttempt = function (first) {
    var L = this.L;
    this.t = 0;
    this.events = [];
    this.arrows = [];
    this.dead = false; this.deathCause = null; this.ended = false; this.sacAir = false;
    var p = this.p = { x: L.start.x, y: L.start.y, vx: 0, vy: 0, grounded: true, coyote: 0, buffer: 0, flip: false,
      jumpHeld: false, ground: null, state: 'idle', animT: 0, stepT: 0 };
    this.rec = [];
    Object.keys(L.gates).forEach(function (k) { L.gates[k].open = L.gates[k].invert ? 1 : 0; });
    L.movers.forEach(function (m) { m.p = 0; m.x = m.x0; m.y = m.y0; m.ddx = 0; m.ddy = 0; });
    L.plates.forEach(function (pl) { pl.pressed = false; });
    this.echoes.forEach(function (e) { e.idx = 0; e.x = e.rec[0][0]; e.y = e.rec[0][1]; e.ddx = 0; e.ddy = 0; e.frozen = true; e.gone = e.cause === 'pit'; });
    this.updatePlates();
    this.updateGates(true);
  };

  // How the attempt ended. A mid-air Sacrifice below the bottom of the chamber counts as the abyss (no Echo).
  W.endCause = function () {
    if (this.dead) return this.deathCause === 'pit' ? 'pit' : 'death';
    return this.p.y + P.h > this.L.ph ? 'pit' : 'sacrifice';
  };
  // The pose an Echo takes when it forms: exactly where (and how) this attempt ended.
  W.echoFrame = function (cause) {
    var p = this.p, last = this.rec[this.rec.length - 1] || [p.x, p.y, 0, p.flip ? 1 : 0, 0];
    var st = cause === 'sacrifice' ? (this.sacAir ? last[2] : STATES.indexOf('kneel')) : (last[2] === STATES.indexOf('dead') ? 0 : last[2]);
    return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, st, p.flip ? 1 : 0, cause === 'sacrifice' && !this.sacAir ? 0 : last[4]];
  };
  // turn the attempt that just ended into an Echo (cause: 'death' | 'pit' | 'sacrifice').
  // Echoes no longer replay the attempt: they form at the spot it ended and are stone from the first frame.
  W.commitEcho = function (cause) {
    var f = this.echoFrame(cause);
    var e = { rec: [f], cause: cause, idx: 0, x: f[0], y: f[1], ddx: 0, ddy: 0, frozen: true, gone: cause === 'pit', id: this.echoesUsed };
    this.echoes.push(e);
    this.echoesUsed++;
    var removed = null;
    var alive = this.echoes.filter(function (x) { return !x.released; });
    if (alive.length > this.maxEchoes) { removed = alive[0]; removed.released = true; }
    this.echoes = this.echoes.filter(function (x) { return !x.released; });
    return removed;
  };

  W.releaseLastEcho = function () { if (this.echoes.length) { this.echoes.pop(); return true; } return false; };

  W.solidTile = function (tx, ty) {
    var L = this.L;
    if (tx < 0 || tx >= L.W) return true;      // side walls
    if (ty < 0) return false;                  // open sky
    if (ty >= L.H) return false;               // pits fall out
    return L.solid[ty][tx];
  };

  W.gateRect = function (g) { var h = g.h * (1 - g.open); return { x: g.x, y: g.y, w: g.w, h: h }; };

  W.hitsSolid = function (r) {
    var x0 = Math.floor(r.x / T), x1 = Math.floor((r.x + r.w - 0.001) / T), y0 = Math.floor(r.y / T), y1 = Math.floor((r.y + r.h - 0.001) / T);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
    var gs = this.L.gates;
    for (var k in gs) { var g = gs[k]; if (g.open < 0.999 && overlap(r, this.gateRect(g))) return true; }
    return false;
  };

  // one-way surfaces: returns list of {y, x, w, ref}
  W.surfaces = function () {
    var out = [], L = this.L, self = this;
    L.movers.forEach(function (m) { out.push({ x: m.x, y: m.y, w: m.w, ref: m }); });
    this.echoes.forEach(function (e) {
      if (e.gone) return;
      out.push({ x: e.x + P.w / 2 - P.echoTopW / 2, y: e.y, w: P.echoTopW, ref: e });
    });
    return out;
  };

  W.echoBody = function (e) { return { x: e.x, y: e.y, w: P.w, h: P.h }; };

  W.updatePlates = function () {
    var L = this.L, self = this;
    L.plates.forEach(function (pl) {
      var was = pl.pressed, zone = { x: pl.x + 1, y: pl.y + 8, w: 14, h: 9 }, on = false;
      if (!self.dead) { var pr = { x: self.p.x, y: self.p.y, w: P.w, h: P.h }; if (overlap(pr, zone)) on = true; }
      self.echoes.forEach(function (e) { if (!e.gone && overlap(self.echoBody(e), zone)) on = true; });
      pl.pressed = on;
      if (on !== was) self.events.push({ type: 'plate', on: on, x: pl.x + 8, y: pl.y + 14, id: pl.id });
    });
  };
  W.platePressed = function (id) { return this.L.plates.some(function (p) { return p.id === id && p.pressed; }); };

  W.updateGates = function (instant) {
    var L = this.L, self = this;
    Object.keys(L.gates).forEach(function (k) {
      var g = L.gates[k];
      var pressed = g.all ? g.plates.every(function (id) { return self.platePressed(id); }) : g.plates.some(function (id) { return self.platePressed(id); });
      var wantOpen = pressed !== g.invert;
      var before = g.open;
      if (instant) { g.open = wantOpen ? 1 : 0; return; }
      if (wantOpen) g.open = Math.min(1, g.open + 0.08);
      else if (g.open > 0) {
        var nv = Math.max(0, g.open - 0.06), r = { x: g.x, y: g.y, w: g.w, h: g.h * (1 - nv) };
        var pr = { x: self.p.x, y: self.p.y, w: P.w, h: P.h };
        if (self.dead || !overlap(pr, r)) g.open = nv;
      }
      if (before === 0 && g.open > 0) self.events.push({ type: 'gate', open: true, x: g.x + g.w / 2, y: g.y });
      if (before > 0 && g.open === 0) self.events.push({ type: 'gate', open: false, x: g.x + g.w / 2, y: g.y + g.h });
    });
  };

  W.updateMovers = function () {
    var self = this;
    this.L.movers.forEach(function (m) {
      var ox = m.x, oy = m.y, p;
      if (m.plate) {
        var on = self.platePressed(m.plate);
        m.p = Math.max(0, Math.min(m.dist, m.p + (on ? m.speed : -m.speed)));
        p = m.dist ? m.p / m.dist : 0;
      } else {
        var travel = m.dist / m.speed, cyc = 2 * (travel + m.wait), tt = self.t % cyc;
        if (tt < m.wait) p = 0; else if (tt < m.wait + travel) p = (tt - m.wait) / travel;
        else if (tt < 2 * m.wait + travel) p = 1; else p = 1 - (tt - 2 * m.wait - travel) / travel;
        // ease
        p = p * p * (3 - 2 * p);
      }
      m.x = m.x0 + m.dx * p; m.y = m.y0 + m.dy * p; m.ddx = m.x - ox; m.ddy = m.y - oy;
    });
  };

  W.updateEchoes = function () {
    // Echoes are static stone: they hold their pose where they formed.
    this.echoes.forEach(function (e) { e.ddx = 0; e.ddy = 0; e.idx = 0; e.frozen = true; if (e.cause === 'pit') e.gone = true; });
  };

  W.updateArrows = function () {
    var self = this, L = this.L, t = this.t;
    L.launchers.forEach(function (l) {
      if (l.plate && self.platePressed(l.plate)) return;
      if (t >= l.offset && (t - l.offset) % l.period === 0) {
        self.arrows.push({ x: l.dir > 0 ? l.x + 16 : l.x - 12, y: l.y + 6, w: 12, h: 4, vx: l.dir * l.speed, dir: l.dir });
        self.events.push({ type: 'arrowFire', x: l.x + 8 + l.dir * 8, y: l.y + 8 });
      }
    });
    var keep = [];
    this.arrows.forEach(function (a) {
      a.x += a.vx;
      var hit = null;
      if (self.hitsSolid(a)) hit = 'thunk';
      if (!hit) for (var i = 0; i < self.echoes.length; i++) {
        var e = self.echoes[i]; if (e.gone) continue;
        if (overlap(a, self.echoBody(e))) { hit = 'blocked'; break; }
      }
      if (!hit && !self.dead && overlap(a, { x: self.p.x + 1, y: self.p.y + 2, w: P.w - 2, h: P.h - 4 })) { hit = 'player'; self.kill('arrow'); }
      if (hit) self.events.push({ type: 'arrowHit', how: hit, x: a.x + (a.dir > 0 ? a.w : 0), y: a.y + 2, dir: a.dir });
      else if (a.x > -40 && a.x < L.pw + 40) keep.push(a);
    });
    this.arrows = keep;
  };

  W.kill = function (cause) {
    if (this.dead || this.won) return;
    this.dead = true; this.deathCause = cause;
    this.events.push({ type: 'death', cause: cause, x: this.p.x + P.w / 2, y: this.p.y + P.h / 2 });
  };

  // input: {left, right, jump (held), sac (pressed this frame)}
  W.step = function (inp) {
    if (this.won) return;
    this.t++; this.totalFrames++;
    this.events = this.events || [];
    this.updateEchoes();
    this.updateMovers();
    this.updatePlates();
    this.updateGates(false);
    if (!this.dead && !this.ended) this.stepPlayer(inp || {});
    this.updatePlates();
    this.updateArrows();
    if (!this.dead && !this.ended) {
      var p = this.p;
      this.rec.push([Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, STATES.indexOf(p.state), p.flip ? 1 : 0, p.animT]);
    }
  };
  var STATES = ['idle', 'run', 'rise', 'apex', 'fall', 'dead', 'kneel'];
  World.STATES = STATES;

  W.stepPlayer = function (inp) {
    var p = this.p, L = this.L, self = this;
    // ride platforms
    if (p.ground && p.ground.ref) {
      var g = p.ground.ref;
      if (g.ddx || g.ddy) { this.moveX(g.ddx || 0); p.y += g.ddy || 0; if (g.ddy < 0 && this.hitsSolid(this.pr())) { p.y -= g.ddy; } }
    }
    var dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) p.flip = dir < 0;
    var acc = p.grounded ? P.accel : P.airAccel, dec = p.grounded ? P.decel : P.airDecel;
    if (dir) { p.vx += dir * acc; if (Math.abs(p.vx) > P.run) p.vx = dir * P.run; }
    else { if (Math.abs(p.vx) <= dec) p.vx = 0; else p.vx -= Math.sign(p.vx) * dec; }
    // jump buffer / coyote
    if (inp.jump && !p.jumpHeld) p.buffer = P.buffer; else if (p.buffer > 0) p.buffer--;
    if (p.grounded) p.coyote = P.coyote; else if (p.coyote > 0) p.coyote--;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = P.jumpV; p.buffer = 0; p.coyote = 0; p.grounded = false; p.ground = null;
      this.events.push({ type: 'jump', x: p.x + P.w / 2, y: p.y + P.h });
    }
    if (!inp.jump && p.jumpHeld && p.vy < 0) p.vy *= P.jumpCut;
    p.jumpHeld = !!inp.jump;
    // sacrifice
    // sacrifice: on the ground you kneel; in mid-air the Echo hangs exactly where you are (v1.2)
    if (inp.sac) {
      var air = !p.grounded; this.ended = true; this.sacAir = air;
      if (!air) p.state = 'kneel';
      this.events.push({ type: 'sacrifice', air: air, x: p.x + P.w / 2, y: p.y + P.h / 2 });
      this.rec.push([p.x, p.y, STATES.indexOf(p.state), p.flip ? 1 : 0, p.animT]); return; }
    p.vy = Math.min(P.maxFall, p.vy + P.grav);
    this.moveX(p.vx);
    var wasGrounded = p.grounded, vyBefore = p.vy;
    this.moveY(p.vy);
    if (p.grounded && !wasGrounded) this.events.push({ type: 'land', x: p.x + P.w / 2, y: p.y + P.h, v: vyBefore });
    // state
    var st;
    if (p.grounded) st = Math.abs(p.vx) > 0.2 ? 'run' : 'idle';
    else st = p.vy < -1.5 ? 'rise' : (p.vy < 1.5 ? 'apex' : 'fall');
    if (st !== p.state) { p.state = st; p.animT = 0; } else p.animT++;
    if (st === 'run') { p.stepT++; if (p.stepT % 16 === 0) this.events.push({ type: 'step', x: p.x + P.w / 2, y: p.y + P.h }); }
    // hazards
    var hb = { x: p.x + 2, y: p.y + 3, w: P.w - 4, h: P.h - 3 };
    for (var i = 0; i < L.spikes.length; i++) if (overlap(hb, L.spikes[i].r)) { this.kill('spikes'); return; }
    if (p.y > L.ph + 24) { this.kill('pit'); return; }
    if (L.exit && overlap(this.pr(), L.exit.r)) { this.won = true; this.events.push({ type: 'win', x: L.exit.x + 8, y: L.exit.y }); }
  };
  W.pr = function () { return { x: this.p.x, y: this.p.y, w: P.w, h: P.h }; };

  W.moveX = function (dx) {
    var p = this.p; if (!dx) return;
    var steps = Math.ceil(Math.abs(dx) / 4), sx = dx / steps;
    for (var i = 0; i < steps; i++) {
      p.x += sx;
      if (this.hitsSolid(this.pr())) {
        // snap
        if (sx > 0) p.x = Math.floor((p.x + P.w) / T) * T - P.w - 0.001; else p.x = Math.ceil(p.x / T) * T + 0.001;
        // gates may not align: fallback step back
        if (this.hitsSolid(this.pr())) p.x -= sx;
        p.vx = 0; return;
      }
    }
  };

  W.moveY = function (dy) {
    var p = this.p, L = this.L;
    var prevBottom = p.y + P.h;
    p.grounded = false;
    var steps = Math.ceil(Math.abs(dy) / 4) || 1, sy = dy / steps;
    for (var i = 0; i < steps; i++) {
      var pb = p.y + P.h;
      p.y += sy;
      if (sy > 0) {
        // one-way tiles + surfaces
        var landY = null, ref = null, nb = p.y + P.h;
        if (this.hitsSolid(this.pr())) { landY = Math.floor(nb / T) * T; }
        var x0 = Math.floor((p.x + 0.01) / T), x1 = Math.floor((p.x + P.w - 0.01) / T), ty = Math.floor((nb - 0.001) / T);
        for (var tx = x0; tx <= x1; tx++) if (ty >= 0 && ty < L.H && tx >= 0 && tx < L.W && L.oneway[ty][tx]) {
          var top = ty * T; if (pb <= top + 0.01 && nb >= top && (landY === null || top < landY)) { landY = top; ref = null; }
        }
        var surf = this.surfaces();
        for (var s = 0; s < surf.length; s++) {
          var sf = surf[s];
          if (p.x + P.w > sf.x && p.x < sf.x + sf.w) {
            var oldTop = sf.y - (sf.ref.ddy || 0);
            if (pb <= Math.max(sf.y, oldTop) + 0.5 && nb >= sf.y - 0.01 && (landY === null || sf.y < landY)) { landY = sf.y; ref = sf; }
          }
        }
        if (landY !== null) {
          p.y = landY - P.h; p.vy = 0; p.grounded = true; p.ground = ref ? { ref: ref.ref } : { ref: null };
          if (this.hitsSolid(this.pr())) { /* wedged (e.g. under gate) - leave */ }
          return;
        }
      } else if (sy < 0) {
        if (this.hitsSolid(this.pr())) { p.y = Math.ceil(p.y / T) * T + 0.001; if (this.hitsSolid(this.pr())) p.y -= sy; p.vy = 0; return; }
      }
    }
    // still standing? (probe when vy==0)
    if (!p.grounded && dy >= 0) {
      // nothing
    }
    if (!p.grounded) p.ground = null;
  };

  var api = { World: World, parse: parse, T: T, P: P, STATES: STATES, overlap: overlap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EchoSim = api;
})(typeof window !== 'undefined' ? window : this);
