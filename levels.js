/* Echo Run - level definitions. Legend: # stone  = ledge  ^ spikes  v ceiling spikes  P start  E exit
   a-f pressure plates  A-F gates (opened by the plate of the same letter unless configured)
   < > arrow launchers  1-9 moving platforms  T torch */
(function (root) {
  'use strict';
  function B(w, h) {
    var g = [], x, y;
    for (y = 0; y < h; y++) { g.push([]); for (x = 0; x < w; x++) g[y].push('.'); }
    var o = {
      r: function (x0, y0, x1, y1, c) { c = c || '#'; for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) if (g[yy] && xx >= 0 && xx < w) g[yy][xx] = c; return o; },
      p: function (x, y, c) { g[y][x] = c; return o; },
      t: function (list) { list.forEach(function (q) { if (g[q[1]][q[0]] === '.') g[q[1]][q[0]] = 'T'; }); return o; },
      border: function (floorless) { o.r(0, 0, w - 1, 0); o.r(0, 0, 0, h - 1); o.r(w - 1, 0, w - 1, h - 1); return o; },
      done: function () { return g.map(function (r) { return r.join(''); }); }
    };
    return o.border();
  }
  var WINGS = [
    { name: 'The Sunken Nave', theme: 'nave' },
    { name: 'The Rune Forge', theme: 'forge' },
    { name: 'The Spire of Sighs', theme: 'spire' }
  ];
  var L = [];

  // 1 ─ Thornbound: move, jump, first Sacrifice
  L.push({ name: 'Thornbound', wing: 0, par: 1, maxEchoes: 3,
    intro: 'The Thornbrand curse will not let you die. Each death leaves an Echo behind.',
    hint: 'Stand next to the tall wall and press X (or the skull button) to Sacrifice. Then jump onto your Echo.',
    tips: [{ x: 4, y: 11, text: '\u2190 \u2192  move' }, { x: 11, y: 10, text: 'SPACE  jump' },
      { x: 20, y: 8, text: 'Too high? Press X to Sacrifice.\nYour Echo stays behind.' }, { x: 31, y: 7, text: 'Climb upon your past self.' }],
    map: B(44, 17).r(0, 15, 25, 16).r(18, 15, 19, 16, '.').r(10, 13, 13, 14).r(26, 11, 43, 16)
      .p(3, 14, 'P').p(40, 10, 'E').t([[6, 11], [16, 10], [23, 11], [33, 7], [41, 7]]).done() });

  // 2 ─ Bed of Thorns: dying on spikes makes a stepping stone
  L.push({ name: 'Bed of Thorns', wing: 0, par: 1, maxEchoes: 3,
    hint: 'Walk into the first spikes. Your Echo will stand there, and its head is safe ground.',
    tips: [{ x: 7, y: 10, text: 'Where you fall, your Echo stands.' }],
    map: B(40, 17).r(0, 15, 39, 16).r(14, 14, 18, 14, '^').p(3, 14, 'P').p(35, 14, 'E')
      .t([[5, 11], [12, 10], [21, 10], [30, 11]]).done() });

  // 3 ─ The Warden's Seal: plates and gates
  L.push({ name: "The Warden's Seal", wing: 0, par: 1, maxEchoes: 3,
    hint: 'The gate only stays open while the plate is held. Sacrifice on the plate.',
    tips: [{ x: 7, y: 11, text: 'A warden plate.\nSomething must hold it down.' }],
    map: B(40, 17).r(0, 15, 39, 16).p(9, 14, 'a').r(24, 1, 25, 10).r(24, 11, 24, 14, 'A').p(3, 14, 'P').p(35, 14, 'E')
      .t([[5, 11], [15, 10], [22, 11], [29, 10], [37, 11]]).done() });

  // 4 ─ A Stair of Selves: stack Echoes
  L.push({ name: 'A Stair of Selves', wing: 0, par: 2, maxEchoes: 3,
    hint: 'Sacrifice by the wall, then stand on that Echo and Sacrifice again. Two Echoes make a stair.',
    tips: [{ x: 8, y: 10, text: 'An Echo can stand upon an Echo.' }],
    map: B(36, 17).r(0, 15, 35, 16).r(22, 9, 35, 16).p(3, 14, 'P').p(31, 8, 'E')
      .t([[6, 11], [14, 9], [20, 7], [27, 5]]).done() });

  // 5 ─ Iron Rain: arrows, ducking, Echo shields
  L.push({ name: 'Iron Rain', wing: 1, par: 1, maxEchoes: 3,
    hint: 'Duck into the trenches as arrows pass. Sacrifice at the far end: your Echo will block the arrows for good.',
    tips: [{ x: 2, y: 9, text: 'Echoes stop arrows.' }],
    launchers: [{ period: 120, offset: 40, speed: 3 }],
    map: B(40, 17).r(0, 15, 39, 16).r(1, 1, 31, 11).r(1, 7, 6, 11, '.').r(11, 15, 12, 15, '.').r(18, 15, 19, 15, '.').r(25, 15, 26, 15, '.')
      .r(36, 11, 38, 11).p(38, 13, '<').r(1, 13, 4, 14).p(2, 12, 'P').p(37, 10, 'E').t([[3, 9], [34, 6]]).done() });

  // 6 ─ The Lift Engine: plate-driven lift, timed by an Echo
  L.push({ name: 'The Lift Engine', wing: 1, par: 1, maxEchoes: 2,
    hint: 'Hold the plate to lower the lift. Your Echo can hold it for you, then step off just as you board.',
    tips: [{ x: 5, y: 10, text: 'The plate lowers the lift.' }],
    movers: { 1: { dx: 0, dy: 9, speed: 1.6, plate: 'a', w: 2 } },
    map: B(34, 17).r(0, 15, 33, 16).p(3, 14, 'a').r(16, 15, 17, 16, '.').p(16, 6, '1').r(18, 7, 32, 7).p(30, 6, 'E').p(6, 14, 'P')
      .t([[9, 10], [21, 4], [27, 4]]).done() });

  // 7 ─ Frozen in Air: an Echo freezes where it ended, even mid-air
  L.push({ name: 'Frozen in Air', wing: 1, par: 1, maxEchoes: 2,
    hint: 'Ride the platform to the top and Sacrifice there. Your Echo stays in the air when the platform leaves.',
    tips: [{ x: 3, y: 10, text: 'An Echo stays where it ended.' }],
    movers: { 1: { at: [10, 15], dx: 0, dy: -6, speed: 0.9, wait: 50 } },
    map: B(30, 17).r(0, 15, 29, 16).r(10, 15, 19, 15, '^').r(14, 5, 29, 5).p(27, 4, 'E').p(4, 14, 'P')
      .t([[7, 10], [22, 2], [16, 8]]).done() });

  // 8 ─ Two Wardens: two plates, a spike well
  L.push({ name: 'Two Wardens', wing: 1, par: 2, maxEchoes: 3,
    hint: 'One Echo on the first plate. Drop into the well between the thorns and Sacrifice on the second plate.',
    tips: [{ x: 21, y: 10, text: 'Two seals. Two of you.' }],
    map: B(44, 17).r(0, 15, 43, 16).p(6, 14, 'a').r(18, 1, 19, 10).r(18, 11, 18, 14, 'A')
      .r(22, 13, 30, 16).r(26, 13, 29, 15, '.').p(26, 15, '^').p(29, 15, '^').p(27, 15, 'b').p(28, 15, 'b')
      .r(34, 1, 35, 10).r(34, 11, 34, 14, 'B').p(3, 14, 'P').p(40, 14, 'E')
      .t([[9, 10], [22, 10], [31, 10], [39, 10]]).done() });

  // 9 ─ Ride the Past: stand on an Echo while it jumps
  L.push({ name: 'Ride the Past', wing: 2, par: 1, maxEchoes: 1,
    hint: 'Wait by the cliff, jump straight up, land, then Sacrifice. Next time stand on your Echo before it jumps, and leap from the top.',
    tips: [{ x: 4, y: 10, text: 'Only one Echo may linger here.\nIt repeats all you did.' }],
    map: B(30, 17).r(0, 15, 29, 16).r(18, 8, 29, 16).p(3, 14, 'P').p(26, 7, 'E').t([[8, 10], [14, 9], [22, 4]]).done() });

  // 10 ─ Inverted Seal: an Echo that holds a plate for a while, then leaves
  L.push({ name: 'Inverted Seal', wing: 2, par: 1, maxEchoes: 2,
    hint: 'The plate opens the far gate but shuts the near one. Let your Echo reach the plate late, after you are through.',
    tips: [{ x: 3, y: 10, text: 'Some seals answer in reverse.' }],
    gates: { B: { invert: true, plates: ['a'] }, A: { plates: ['a'] } },
    map: B(34, 17).r(0, 15, 33, 16).r(1, 1, 32, 10).r(1, 7, 5, 10, '.').p(8, 14, 'a').r(14, 11, 14, 14, 'B').r(24, 11, 24, 14, 'A')
      .p(3, 14, 'P').p(30, 14, 'E').t([[3, 8], [11, 12], [19, 12], [28, 12]]).done() });

  // 11 ─ Gauntlet of Hours: arrows, then a climb that needs two Echoes
  L.push({ name: 'Gauntlet of Hours', wing: 2, par: 2, maxEchoes: 3,
    hint: 'Reach the shaft and Sacrifice: that Echo shields the hall. Then stand on it and Sacrifice again to build a stair.',
    launchers: [{ period: 130, offset: 30, speed: 3 }],
    map: B(40, 17).r(0, 15, 39, 16).r(1, 1, 31, 11).r(1, 7, 6, 11, '.').r(11, 15, 12, 15, '.').r(18, 15, 19, 15, '.').r(25, 15, 26, 15, '.')
      .r(36, 9, 38, 11).p(38, 13, '<').r(32, 1, 38, 2).p(37, 8, 'E').r(1, 13, 4, 14).p(2, 12, 'P').r(33, 3, 34, 3, 'v')
      .t([[3, 9], [9, 13], [22, 13], [35, 5]]).done() });

  // 12 ─ The Spire Crown: plate + a cliff that rewards the vault
  L.push({ name: 'The Spire Crown', wing: 2, par: 2, maxEchoes: 4,
    hint: 'Hold the seal with one Echo. For the cliff, ride an Echo as it jumps: stacking works too, but costs more.',
    map: B(40, 17).r(0, 15, 39, 16).p(5, 14, 'a').r(12, 1, 13, 10).r(12, 11, 12, 14, 'A').r(26, 7, 39, 16).r(30, 5, 39, 6, '.')
      .p(3, 14, 'P').p(36, 6, 'E').t([[8, 10], [17, 9], [22, 6], [33, 3]]).done() });

  var api = { levels: L, wings: WINGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EchoLevels = api;
})(typeof window !== 'undefined' ? window : this);
