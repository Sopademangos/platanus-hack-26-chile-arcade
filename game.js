// Combinación: Hora Punta — Platanus Hack 26, Santiago
// You are the manual dispatcher of the Santiago Metro. Flip the switches at the
// transfer stations so every train leaves through the line of its own colour.

const W = 800;
const H = 600;
const BG = 0x090b11;
const GREY = 0x2b3040; // colour of lines that are not inaugurated yet
const STORE_KEY = 'combinacion-hora-punta-top';
const START_LIVES = 3;
const MAX_LIVES = 5;
const LIFE_BONUS = 500; // survival bonus per life held when a rush hour ends
const BASE_POINTS = 100; // points for a correctly routed train, before the combo
const COMBO_STEP = 5; // consecutive trains needed to raise the multiplier
// One neon colour per multiplier tier, x1..x5. Its length is the multiplier cap.
const COMBO_COLORS = [0x3d8bff, 0x17d68a, 0xffc928, 0xff8a3d, 0xff4fd8];
const MAX_COMBO = COMBO_COLORS.length;
const START_LINES = 2; // how many entries of LINES are open when a game begins
const FIRST_CALM = 15; // seconds from the start of a game to the first rush hour
const NEXT_CALM = 25; // seconds of normal play after each inauguration
const RUSH_SECONDS = 10; // rush hour length
const FONT = 'monospace';

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const normKey = (k) => (typeof k === 'string' && k ? (k === ' ' ? 'space' : k.toLowerCase()) : '');
const KEY_TO_CODE = {};
for (const [code, keys] of Object.entries(CABINET_KEYS)) {
  for (const k of keys) KEY_TO_CODE[normKey(k)] = code;
}

// ---------------------------------------------------------------------------
// THE MAP — a directed graph. Everything below is data; the engine reads it.
//
// HOW TO ADD A LINE:   add an entry to LINES (colour + badge label). The ORDER
//   of LINES is the inauguration order: the first START_LINES are open from
//   the start, each following one opens after a survived rush hour.
// HOW TO ADD A SWITCH: add an entry to NODES, then make edges start/end on it.
//   A switch only becomes active once both lines through it are open.
//   keys: arcade code suffixes that flip it ('L' = joystick left of either
//         player, '1' = button 1 of either player, etc.)
//   tx/ty/ta: name label offset and horizontal anchor (0 left, 1 right)
//   bx/by: control hint badge offset; dir: joystick arrow angle in degrees
//          (leave dir out for button-only switches)
// HOW TO ADD TRACK:    add an entry to EDGES. Trains only travel pts[0] -> last.
//   from: null means "spawn point" (start it off-screen)
//   to:   null means "terminal" (trains score there if their colour matches)
//   An edge that ends on a node must end exactly on the node's x/y, and an edge
//   that leaves a node must start on it. Each node needs exactly two incoming
//   and two outgoing edges, one per line, and the graph must have no loops.
// ---------------------------------------------------------------------------
const LINES = {
  L1: { color: 0xff3347, label: 'L1' },
  L2: { color: 0xffc928, label: 'L2' },
  L5: { color: 0x17d68a, label: 'L5' },
  L6: { color: 0xa35bff, label: 'L6' },
  L4: { color: 0x3d8bff, label: 'L4' },
};

const NODES = {
  LH: { x: 250, y: 320, name: 'LOS HÉROES', keys: ['L', '1'], btn: '1', tx: -10, ty: -30, ta: 1, bx: 34, by: 38, dir: 180 },
  SA: { x: 400, y: 170, name: 'SANTA ANA', keys: ['U', 'D', '2'], btn: '2', tx: -12, ty: -30, ta: 1, bx: 0, by: 46, dir: -90 },
  BQ: { x: 550, y: 320, name: 'BAQUEDANO', keys: ['R', '3'], btn: '3', tx: 12, ty: -30, ta: 0, bx: -34, by: 38, dir: 0 },
  FR: { x: 190, y: 470, name: 'FRANKLIN', keys: ['4'], btn: '4', tx: 12, ty: -30, ta: 0, bx: 30, by: 36 },
  NU: { x: 610, y: 470, name: 'ÑUBLE', keys: ['5'], btn: '5', tx: 12, ty: -30, ta: 0, bx: -30, by: 36 },
  TB: { x: 680, y: 320, name: 'TOBALABA', keys: ['6'], btn: '6', tx: 12, ty: -30, ta: 0, bx: -30, by: 36 },
};

const EDGES = [
  // Línea 1 (red): west -> east
  { line: 'L1', from: null, to: 'LH', pts: [[-30, 400], [90, 400], [170, 320], [250, 320]] },
  { line: 'L1', from: 'LH', to: 'BQ', pts: [[250, 320], [550, 320]] },
  { line: 'L1', from: 'BQ', to: 'TB', pts: [[550, 320], [680, 320]] },
  { line: 'L1', from: 'TB', to: null, pts: [[680, 320], [770, 320]] },
  // Línea 2 (yellow): north -> south
  { line: 'L2', from: null, to: 'SA', pts: [[830, 90], [480, 90], [400, 170]] },
  { line: 'L2', from: 'SA', to: 'LH', pts: [[400, 170], [250, 320]] },
  { line: 'L2', from: 'LH', to: 'FR', pts: [[250, 320], [190, 380], [190, 470]] },
  { line: 'L2', from: 'FR', to: null, pts: [[190, 470], [190, 560]] },
  // Línea 5 (green): west -> south-east
  { line: 'L5', from: null, to: 'SA', pts: [[-30, 170], [400, 170]] },
  { line: 'L5', from: 'SA', to: 'BQ', pts: [[400, 170], [550, 320]] },
  { line: 'L5', from: 'BQ', to: 'NU', pts: [[550, 320], [610, 380], [610, 470]] },
  { line: 'L5', from: 'NU', to: null, pts: [[610, 470], [610, 560]] },
  // Línea 6 (purple): west -> east along the south
  { line: 'L6', from: null, to: 'FR', pts: [[-30, 470], [190, 470]] },
  { line: 'L6', from: 'FR', to: 'NU', pts: [[190, 470], [610, 470]] },
  { line: 'L6', from: 'NU', to: null, pts: [[610, 470], [740, 470]] },
  // Línea 4 (blue): north-east -> south-east
  { line: 'L4', from: null, to: 'TB', pts: [[830, 190], [740, 190], [680, 250], [680, 320]] },
  { line: 'L4', from: 'TB', to: null, pts: [[680, 320], [680, 360], [720, 400], [770, 400]] },
];

const BASS = [110, 0, 110, 0, 165, 0, 110, 131, 110, 0, 110, 0, 196, 0, 165, 147];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const pad6 = (n) => String(n).padStart(6, '0');
const rnd = Math.random;
const pick = (a) => a[Math.floor(rnd() * a.length)];
// Blend two 0xRRGGBB colours (k = 0 gives a, k = 1 gives b).
const mix = (a, b, k) => {
  const f = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (f(16) << 16) | (f(8) << 8) | f(0);
};

// Leaderboard storage: the arcade bridge when present, localStorage when
// testing locally, and silently nothing if neither is available.
function getStorage() {
  const st = window.platanusArcadeStorage;
  return {
    async get(key) {
      if (st) return st.get(key);
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? { found: false, value: null } : { found: true, value: JSON.parse(raw) };
      } catch (err) {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      if (st) return st.set(key, value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* no storage: the board stays in memory */
      }
    },
  };
}

class HoraPunta extends Phaser.Scene {
  constructor() {
    super('main');
  }

  // No external assets: train sprites are drawn once into textures here.
  preload() {
    for (const [id, line] of Object.entries(LINES)) {
      for (let ex = 0; ex < 2; ex++) {
        const w = ex ? 34 : 26;
        const h = 14;
        const p = 10;
        const g = this.make.graphics({ add: false });
        for (let i = 4; i > 0; i--) {
          g.fillStyle(line.color, 0.09);
          g.fillRoundedRect(p - i * 2, p - i * 2, w + i * 4, h + i * 4, 4 + i * 2);
        }
        g.fillStyle(BG, 1);
        g.fillRoundedRect(p - 2, p - 2, w + 4, h + 4, 5);
        g.fillStyle(line.color, 1);
        g.fillRoundedRect(p, p, w, h, 3);
        g.fillStyle(0xffffff, 1);
        g.fillRect(p + w - 5, p + 3, 3, h - 6); // headlight
        if (ex) g.fillRect(p + 4, p + 5, w - 12, 4); // express: white-hot stripe
        g.generateTexture('t' + id + ex, w + p * 2, h + p * 2);
        g.destroy();
      }
    }
  }

  create() {
    this.trains = [];
    this.scores = [];
    this.mode = 'boot';
    this.now = 0; // ms of simulated time (stops while paused)
    this.sm = 1; // smoothed speed multiplier (2 during rush hour)
    this.score = 0;
    this.comboMultiplier = 1; // "Racha de Pasajeros": x1..x5
    this.consecutiveTrains = 0; // progress toward the next multiplier tier
    this.lives = START_LIVES;
    this.t = 0;
    // phase: calm -> rush -> clear -> bonus -> reward -> inaug -> calm ...
    this.phase = 'calm';
    this.ph = 0; // phase timer (seconds)
    this.cyc = 0; // seconds into the current calm/rush period
    this.rush = false;
    this.spawnT = 500;
    this.demoT = 0;
    this.beat = 0;
    this.beatT = 0;
    this.blink = null;
    this.v1 = new Phaser.Math.Vector2();
    this.v2 = new Phaser.Math.Vector2();

    this.buildMap();
    this.buildHud();
    this.ui = this.add.container(0, 0).setDepth(30);
    this.bindInput();
    this.loadScores();
    this.showTitle();
  }

  // ---------------------------------------------------------------- map ---
  buildMap() {
    const dots = this.add.graphics();
    dots.fillStyle(0x161b28, 1);
    for (let x = 20; x < W; x += 40) for (let y = 60; y < H; y += 40) dots.fillRect(x, y, 2, 2);
    this.rushBg = this.add.rectangle(W / 2, H / 2, W, H, 0xff1f4b).setAlpha(0);

    // Runtime copy of every line: on = inaugurated, k = 0 (grey) .. 1 (neon).
    this.lines = {};
    this.lineList = [];
    for (const [id, d] of Object.entries(LINES)) {
      const L = Object.assign({ id, on: false, k: 0, edges: [] }, d);
      L.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      L.g = this.add.graphics();
      this.lines[id] = L;
      this.lineList.push(L);
    }

    this.nodes = {};
    this.nodeList = [];
    for (const [id, d] of Object.entries(NODES)) {
      const n = Object.assign({ id, state: 0, active: false, ins: [], outs: [], lines: [], objs: [], last: -1e9 }, d);
      this.nodes[id] = n;
      this.nodeList.push(n);
    }

    const unit = (a, b) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    };

    this.entries = [];
    for (const d of EDGES) {
      const p = d.pts;
      const L = this.lines[d.line];
      // Each edge is a Phaser path; trains follow it with path.getPoint().
      const path = new Phaser.Curves.Path(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) path.lineTo(p[i][0], p[i][1]);
      const e = {
        L,
        line: d.line,
        color: L.color,
        pts: p,
        path,
        len: path.getLength(),
        from: this.nodes[d.from] || null,
        to: this.nodes[d.to] || null,
        outDir: unit(p[0], p[1]), // direction trains leave the start node
        inDir: unit(p[p.length - 1], p[p.length - 2]), // direction trains arrive from
        ex: p[p.length - 1][0],
        ey: p[p.length - 1][1],
        st: [], // small decorative stations along the edge
      };
      L.edges.push(e);
      for (const n of [e.from, e.to]) if (n && !n.lines.includes(d.line)) n.lines.push(d.line);
      if (e.from) e.from.outs.push(e);
      else this.entries.push(e);
      if (e.to) e.to.ins.push(e);

      for (let s = 70; s < e.len - 45; s += 75) {
        const q = path.getPoint(s / e.len, this.v1);
        if (q && q.x > 12 && q.x < W - 12) e.st.push([q.x, q.y]);
      }
      if (!e.to) {
        // Terminal badge: trains of this colour must end here.
        e.badge = [
          this.add.circle(e.ex, e.ey, 21, e.color, 0.18).setDepth(7),
          this.add.circle(e.ex, e.ey, 16, e.color).setDepth(7),
          this.add.text(e.ex, e.ey, L.label, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#0a0c12' }).setOrigin(0.5).setDepth(7),
        ];
      }
      if (!e.from) {
        const q = path.getPoint(48 / e.len, this.v1);
        e.sx = q.x;
        e.sy = q.y;
      }
    }

    for (const n of this.nodeList) {
      n.g = this.add.graphics({ x: n.x, y: n.y }).setDepth(5);
      const name = this.add.text(n.x + n.tx, n.y + n.ty, n.name, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#e8ecf5' }).setOrigin(n.ta, 1).setDepth(7);

      // Control hint: joystick direction (when it has one) + button number.
      const joy = n.dir !== undefined;
      const hw = joy ? 23 : 13;
      const b = this.add.graphics({ x: n.x + n.bx, y: n.y + n.by }).setDepth(7);
      b.fillStyle(0x10141f, 0.95);
      b.fillRoundedRect(-hw, -11, hw * 2, 22, 6);
      b.lineStyle(1, 0x55607a, 1);
      b.strokeRoundedRect(-hw, -11, hw * 2, 22, 6);
      if (joy) {
        const a = Phaser.Math.DegToRad(n.dir);
        const tri = [0, 2.3, -2.3].map((o) => [Math.cos(a + o) * 7 - 11, Math.sin(a + o) * 7]);
        b.fillStyle(0xffffff, 1);
        b.fillTriangle(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1]);
      }
      const num = this.add.text(n.x + n.bx + (joy ? 11 : 0), n.y + n.by, n.btn, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffe14d' }).setOrigin(0.5).setDepth(7);

      // Mouse/touch works too (handy for testing; the cabinet has no mouse).
      const zone = this.add.circle(n.x, n.y, 36, 0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.mode === 'play') this.toggle(n);
      });
      n.objs = [n.g, name, b, num, zone];
    }
  }

  // Redraws one line at its current brightness k (0 = dim grey, 1 = neon).
  drawLine(L) {
    const k = L.k;
    const col = mix(GREY, L.color, k);
    L.glow.clear().setDepth(k > 0 ? 0.9 : 0.5);
    L.g.clear().setDepth(k > 0 ? 1 : 0.6);
    for (const e of L.edges) {
      if (k > 0) {
        L.glow.lineStyle(18, L.color, 0.12 * k);
        e.path.draw(L.glow);
      }
      L.g.lineStyle(6, col, 1);
      e.path.draw(L.g);
      L.g.fillStyle(col, 1);
      for (const p of e.pts) L.g.fillCircle(p[0], p[1], 3);
      for (const s of e.st) {
        L.g.fillStyle(BG, 1);
        L.g.fillCircle(s[0], s[1], 4.5);
        L.g.lineStyle(2, 0xffffff, 0.2 + 0.65 * k);
        L.g.strokeCircle(s[0], s[1], 4.5);
      }
      if (!e.from) {
        L.g.fillStyle(BG, 1);
        L.g.fillCircle(e.sx, e.sy, 7);
        L.g.lineStyle(3, col, 1);
        L.g.strokeCircle(e.sx, e.sy, 7);
      }
      if (e.badge) {
        e.badge[0].setFillStyle(L.color, 0.18 * k);
        e.badge[1].setFillStyle(col).setStrokeStyle(3, 0xffffff, 0.15 + 0.85 * k);
        e.badge[2].setAlpha(0.35 + 0.65 * k);
      }
    }
  }

  // Opens the first `count` lines instantly (game start and attract mode).
  openLines(count) {
    this.lineList.forEach((L, i) => {
      L.on = i < count;
      L.k = L.on ? 1 : 0;
      this.drawLine(L);
    });
    this.refreshNodes(false);
  }

  // A switch exists only while every line through it is open.
  refreshNodes(pop) {
    for (const n of this.nodeList) {
      const act = n.lines.every((id) => this.lines[id].on && this.lines[id].k === 1);
      const fresh = act && !n.active;
      n.active = act;
      if (!act) n.state = 0;
      for (const o of n.objs) o.setVisible(act);
      this.drawNode(n);
      if (fresh && pop) {
        n.g.setScale(0);
        this.tweens.add({ targets: n.g, scale: 1, duration: 420, ease: 'Back.easeOut' });
        this.ping(n.x, n.y, 0xffffff, 70);
        this.tone(880, 0.12, 'triangle', 0.08);
      }
    }
  }

  // The switching rule. state 0: stay on your own line. state 1: take the other one.
  // Switches that are not active yet always let trains straight through.
  route(n, inEdge) {
    const same = n.outs.find((o) => o.line === inEdge.line) || n.outs[0];
    if (!n.active) return same;
    const other = n.outs.find((o) => o !== same) || same;
    return n.state ? other : same;
  }

  // Terminal colours a train entering edge e can still reach.
  reach(e) {
    const n = e.to;
    if (!n) return [e.line];
    const outs = n.active ? n.outs : n.outs.filter((o) => o.line === e.line);
    return [...new Set(outs.flatMap((o) => this.reach(o)))];
  }

  // A node shows, for each incoming line, a connector in that line's colour
  // bending toward the exit it currently feeds, ending in an arrowhead.
  drawNode(n) {
    const g = n.g;
    const R = 21;
    const V = Phaser.Math.Vector2;
    g.clear();
    g.fillStyle(0x0a0c12, 1);
    g.fillCircle(0, 0, R + 2);
    for (const e of n.ins) {
      const o = this.route(n, e);
      const ux = o.outDir.x;
      const uy = o.outDir.y;
      g.fillStyle(0x0a0c12, 1);
      g.fillTriangle(ux * (R + 23), uy * (R + 23), ux * (R + 1) - uy * 12, uy * (R + 1) + ux * 12, ux * (R + 1) + uy * 12, uy * (R + 1) - ux * 12);
      g.fillStyle(e.color, 1);
      g.fillTriangle(ux * (R + 18), uy * (R + 18), ux * (R + 4) - uy * 8, uy * (R + 4) + ux * 8, ux * (R + 4) + uy * 8, uy * (R + 4) - ux * 8);
      // Connector: a quadratic curve from the entry side to the exit side,
      // pulled toward the node centre and drawn as short straight pieces.
      const c = new Phaser.Curves.QuadraticBezier(new V(e.inDir.x * R * 0.85, e.inDir.y * R * 0.85), new V(0, 0), new V(ux * R * 0.85, uy * R * 0.85));
      g.lineStyle(5, e.color, 1);
      let a = c.getPoint(0);
      for (let i = 1; i <= 8; i++) {
        const b = c.getPoint(i / 8);
        g.lineBetween(a.x, a.y, b.x, b.y);
        a = b;
      }
    }
    g.lineStyle(3, n.state ? 0xff4fd8 : 0xffffff, 1);
    g.strokeCircle(0, 0, R);
  }

  toggle(n) {
    if (!n.active) return;
    n.state ^= 1;
    this.drawNode(n);
    n.g.setScale(1.35);
    this.tweens.add({ targets: n.g, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tone(n.state ? 620 : 440, 0.05, 'square', 0.05);
  }

  // ---------------------------------------------------------------- hud ---
  buildHud() {
    const d = 20;
    this.add.rectangle(W / 2, 23, W, 46, 0x0d1019, 0.92).setDepth(d);
    this.add.rectangle(W / 2, 46, W, 2, 0x232a3d).setDepth(d);
    this.scoreTxt = this.label(16, 23, '000000', 26, '#ffffff', 0).setDepth(d);
    // Combo bar ("Racha de Pasajeros"): a dark background rectangle, a neon
    // foreground rectangle that fills as trains are routed in a row (plus a
    // soft glow copy of it), four dividers marking the five steps, and a label.
    const bx = 130;
    const bw = 140;
    this.add.rectangle(bx, 31, bw, 9, 0x1b2030).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a4460).setDepth(d);
    this.comboGlow = this.add.rectangle(bx, 31, bw, 19, COMBO_COLORS[0], 0.25).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
    this.comboFg = this.add.rectangle(bx, 31, bw, 9, COMBO_COLORS[0]).setOrigin(0, 0.5).setDepth(d);
    this.comboGlow.scaleX = this.comboFg.scaleX = 0;
    for (let i = 1; i < COMBO_STEP; i++) this.add.rectangle(bx + (bw * i) / COMBO_STEP, 31, 2, 9, 0x0d1019).setDepth(d);
    this.comboTxt = this.label(bx, 14, 'COMBO: x1', 14, hex(COMBO_COLORS[0]), 0).setDepth(d);
    this.rushLbl = this.label(W / 2, 33, '', 12, '#aab3c8').setDepth(d);
    this.bar = this.add.graphics().setDepth(d);
    this.livesLbl = this.label(704, 12, 'VIDAS', 11, '#aab3c8').setDepth(d);
    this.pips = this.add.graphics({ x: 704, y: 31 }).setDepth(d);
    this.rushTxt = this.label(W / 2, 525, '¡HORA PUNTA!', 40, '#ff4d6d').setDepth(d).setAlpha(0);
    this.rushTxt.setShadow(0, 0, '#ff1f4b', 18, false, true);
    this.drawHud();
  }

  label(x, y, s, size, color, ox) {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color: color || '#ffffff', align: 'center' }).setOrigin(ox === undefined ? 0.5 : ox, 0.5);
  }

  pipX(i) {
    return (i - (MAX_LIVES - 1) / 2) * 22;
  }

  drawHud() {
    this.scoreTxt.setText(pad6(this.score));
    const g = this.pips;
    g.clear();
    for (let i = 0; i < MAX_LIVES; i++) {
      const x = this.pipX(i);
      if (i < this.lives) {
        g.fillStyle(0xff4d6d, 1);
        g.fillCircle(x, 0, 7);
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(x - 2, -2, 2);
      } else {
        g.lineStyle(2, 0x55607a, 1);
        g.strokeCircle(x, 0, 6);
      }
    }
  }

  // ---------------------------------------------- racha de pasajeros ---
  // A correctly routed train adds one step to the combo.
  // COMBO_STEP steps raise the multiplier by one tier, up to MAX_COMBO.
  comboStep() {
    let up = false;
    if (this.comboMultiplier < MAX_COMBO && ++this.consecutiveTrains >= COMBO_STEP) {
      this.comboMultiplier++;
      this.consecutiveTrains = 0;
      up = true;
    }
    this.updateComboUI(up);
  }

  // A misrouted train or a collision throws the whole combo away.
  comboReset() {
    const had = this.comboMultiplier > 1 || this.consecutiveTrains > 0;
    this.comboMultiplier = 1;
    this.consecutiveTrains = 0;
    this.updateComboUI(false);
    if (had) {
      this.comboTxt.setColor('#ff4d6d');
      this.time.delayedCall(350, () => this.comboTxt.setColor(hex(COMBO_COLORS[this.comboMultiplier - 1])));
    }
  }

  // Syncs the combo bar and label with comboMultiplier / consecutiveTrains.
  // levelUp = true plays the tier-up juice (flash, new colour, small shake).
  updateComboUI(levelUp) {
    const m = this.comboMultiplier;
    const maxed = m >= MAX_COMBO;
    const col = COMBO_COLORS[m - 1];
    const fill = maxed ? 1 : this.consecutiveTrains / COMBO_STEP; // 1 train = 20 %, 2 = 40 %...
    const bars = [this.comboFg, this.comboGlow];
    const paint = () => {
      this.comboFg.setFillStyle(col);
      this.comboGlow.setFillStyle(col, 0.25);
    };
    this.comboTxt.setText('COMBO: x' + m + (maxed ? ' MAX' : '')).setColor(hex(col));
    this.tweens.killTweensOf(bars);
    if (levelUp) {
      // Top the bar off in the old colour, then restart it in the new one.
      this.tweens.add({
        targets: bars,
        scaleX: 1,
        duration: 130,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          paint();
          this.comboFg.scaleX = this.comboGlow.scaleX = fill;
        },
      });
      this.comboTxt.setColor('#ffffff').setScale(1.7);
      this.tweens.add({ targets: this.comboTxt, scale: 1, duration: 380, ease: 'Back.easeOut' });
      this.time.delayedCall(260, () => this.comboTxt.setColor(hex(COMBO_COLORS[this.comboMultiplier - 1])));
      this.cameras.main.shake(140, 0.004);
      this.float(200, 74, '¡RACHA x' + m + '!', hex(col), 20);
      [0, 1, 2].forEach((i) => this.tone(520 + m * 80 + i * 180, 0.09, 'square', 0.05, 0, i * 0.06));
    } else {
      paint();
      this.tweens.add({ targets: bars, scaleX: fill, duration: 220, ease: 'Cubic.easeOut' });
    }
  }

  // Makes the score jump and flash gold when a bonus lands.
  bumpScore() {
    this.scoreTxt.setScale(1.45).setColor('#ffe14d');
    this.tweens.add({ targets: this.scoreTxt, scale: 1, duration: 450, ease: 'Back.easeOut' });
    this.time.delayedCall(700, () => this.scoreTxt.setColor('#ffffff'));
  }

  // Makes the lives counter jump so the change is noticed.
  bumpLives(color, from) {
    this.pips.setScale(from);
    this.tweens.add({ targets: this.pips, scale: 1, duration: 450, ease: 'Back.easeOut' });
    this.livesLbl.setColor(color);
    this.time.delayedCall(900, () => this.livesLbl.setColor('#aab3c8'));
  }

  drawRushBar() {
    const g = this.bar;
    const P = this.phase;
    const f = P === 'rush' ? 1 - this.cyc / RUSH_SECONDS : P === 'calm' ? this.cyc / this.calmLen : 0;
    g.clear();
    g.fillStyle(0x1b2030, 1);
    g.fillRoundedRect(290, 10, 220, 10, 5);
    g.fillStyle(this.rush ? 0xff3347 : f > 0.85 ? 0xff8a3d : 0xffc928, 1);
    if (f > 0.03) g.fillRoundedRect(290, 10, 220 * Math.min(1, f), 10, 5);
    let s = '';
    if (this.mode !== 'title') {
      if (P === 'rush') s = '¡HORA PUNTA!  x2';
      else if (P === 'calm') s = 'HORA PUNTA EN ' + Math.ceil(this.calmLen - this.cyc);
      else if (P === 'clear') s = 'DESPEJA LAS VÍAS  x2';
      else s = P === 'inaug' ? 'NUEVA LÍNEA' : P === 'bonus' ? 'BONO DE SUPERVIVENCIA' : 'RESPIRO';
    }
    if (s !== this.rushLbl.text) this.rushLbl.setText(s).setColor(this.rush ? '#ff4d6d' : '#aab3c8');
  }

  // -------------------------------------------------------------- input ---
  bindInput() {
    const held = {};
    const down = (ev) => {
      const c = KEY_TO_CODE[normKey(ev.key)];
      if (!c) return;
      ev.preventDefault();
      if (!held[c]) {
        held[c] = 1;
        this.onCode(c);
      }
    };
    const up = (ev) => {
      const c = KEY_TO_CODE[normKey(ev.key)];
      if (c) held[c] = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    });
    this.input.on('pointerdown', () => {
      if (this.mode === 'title' || this.mode === 'over') this.onCode('START1');
    });
  }

  // All game input arrives here as arcade codes (P1_L, P2_3, START1...).
  onCode(c) {
    const ctx = this.sound.context;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    const m = this.mode;
    const start = c === 'START1' || c === 'START2';
    const btn = /_[1-6]$/.test(c);
    const k = c.slice(3); // 'L', 'U', '1'... shared by both players
    if (m === 'title') {
      if (start || btn) this.startGame();
    } else if (m === 'play') {
      if (start) this.setPause(true);
      else for (const n of this.nodeList) if (n.keys.includes(k)) this.toggle(n);
    } else if (m === 'pause') {
      if (start) this.setPause(false);
    } else if (this.time.now < this.lockUntil) {
      return;
    } else if (m === 'name') {
      const ne = this.ne;
      if (k === 'U' || k === 'D') ne.l[ne.p] = (ne.l[ne.p] + (k === 'U' ? 1 : 25)) % 26;
      else if (k === 'L') ne.p = Math.max(0, ne.p - 1);
      else if (k === 'R' || start || btn) {
        if (ne.p < 2) ne.p++;
        else if (k !== 'R') return this.submitName();
      }
      this.tone(520, 0.04, 'square', 0.04);
      this.drawName();
    } else if (m === 'over' && start) {
      this.startGame();
    }
  }

  // ------------------------------------------------------------ screens ---
  clearUi() {
    this.ui.removeAll(true);
    this.blink = null;
  }

  dim(a) {
    this.ui.add(this.add.rectangle(W / 2, H / 2 + 23, W, H - 46, 0x05060a, a));
  }

  uiText(x, y, s, size, color, ox) {
    const t = this.label(x, y, s, size, color, ox);
    this.ui.add(t);
    return t;
  }

  board(y, mark) {
    this.uiText(W / 2, y, 'MEJORES DESPACHADORES', 14, '#4de3ff');
    for (let i = 0; i < 5; i++) {
      const s = this.scores[i];
      const me = s && mark && s === mark;
      this.uiText(W / 2, y + 26 + i * 22, i + 1 + '. ' + (s ? s.n + '  ' + pad6(s.s) : '---  ------'), 16, me ? '#ffe14d' : s ? '#e8ecf5' : '#55607a');
    }
  }

  resetRound() {
    this.clearTrains();
    this.clearUi();
    for (const n of this.nodeList) {
      n.state = 0;
      n.last = -1e9;
    }
    this.score = 0;
    this.comboMultiplier = 1;
    this.consecutiveTrains = 0;
    this.updateComboUI(false);
    this.lives = START_LIVES;
    this.t = 0;
    this.cyc = 0;
    this.calmLen = FIRST_CALM; // wave 1 arrives fast; resume() sets NEXT_CALM
    this.ph = 0;
    this.phase = 'calm';
    this.rush = false;
    this.sm = 1;
    this.warn = 0;
  }

  showTitle() {
    this.resetRound();
    this.openLines(this.lineList.length); // attract mode shows the whole network
    this.mode = 'title';
    this.spawnT = 300;
    this.drawHud();
    this.dim(0.8);
    this.uiText(W / 2, 104, 'COMBINACIÓN', 60, '#ffffff').setShadow(0, 0, '#ff3347', 20, false, true);
    this.uiText(W / 2, 162, 'HORA PUNTA', 40, '#ffc928').setShadow(0, 0, '#ff8a3d', 16, false, true);
    this.uiText(W / 2, 206, 'ERES EL DESPACHADOR DEL METRO DE SANTIAGO', 14, '#17d68a');
    this.uiText(W / 2, 244, 'CADA TREN DEBE SALIR POR LA LÍNEA DE SU COLOR', 15, '#e8ecf5');
    this.uiText(W / 2, 266, 'CAMBIA CADA DESVÍO CON SU BOTÓN (1 A 6) O LA PALANCA', 15, '#e8ecf5');
    this.uiText(W / 2, 288, 'TREN MAL DESPACHADO: -1 VIDA  ·  CHOQUE: FIN DEL TURNO', 15, '#e8ecf5');
    this.uiText(W / 2, 310, 'SUPERA LA HORA PUNTA: BONO POR VIDA, +1 VIDA Y NUEVA LÍNEA', 15, '#ffe14d');
    this.board(356);
    this.blink = this.uiText(W / 2, 540, 'PRESIONA START', 24, '#ffffff');
  }

  startGame() {
    this.resetRound();
    this.openLines(START_LINES);
    this.spawnT = 700;
    this.mode = 'play';
    this.drawHud();
    this.tone(440, 0.08, 'square', 0.05);
    this.tone(660, 0.08, 'square', 0.05, 0, 0.09);
    this.tone(880, 0.14, 'square', 0.05, 0, 0.18);
  }

  setPause(on) {
    this.clearUi();
    this.mode = on ? 'pause' : 'play';
    if (on) {
      this.dim(0.7);
      this.uiText(W / 2, 280, 'PAUSA', 56, '#ffffff');
      this.blink = this.uiText(W / 2, 340, 'START PARA SEGUIR', 18, '#aab3c8');
    }
  }

  gameOver(title, sub) {
    this.goTitle = title;
    this.goSub = sub;
    const top = this.scores;
    const hi = this.score > 0 && (top.length < 5 || this.score > top[4].s);
    this.overPanel(hi, null);
  }

  overPanel(entry, mark) {
    this.clearUi();
    this.lockUntil = this.time.now + 700;
    this.idle = 0;
    this.dim(0.82);
    this.uiText(W / 2, 112, this.goTitle, 52, '#ff4d6d').setShadow(0, 0, '#ff1f4b', 18, false, true);
    this.uiText(W / 2, 160, this.goSub, 15, '#aab3c8');
    this.uiText(W / 2, 212, 'PUNTOS  ' + pad6(this.score), 30, '#ffffff');
    if (entry) {
      this.mode = 'name';
      this.uiText(W / 2, 270, '¡NUEVO RÉCORD!  INGRESA TUS INICIALES', 16, '#ffe14d');
      this.ne = { l: [0, 0, 0], p: 0, t: [0, 1, 2].map((i) => this.uiText(W / 2 - 60 + i * 60, 340, 'A', 60, '#ffffff')) };
      this.ne.c = this.add.rectangle(0, 380, 44, 5, 0xffe14d);
      this.ui.add(this.ne.c);
      this.uiText(W / 2, 430, 'PALANCA: ELEGIR LETRA   ·   BOTÓN: SIGUIENTE', 14, '#aab3c8');
      this.drawName();
    } else {
      this.mode = 'over';
      this.board(278, mark);
      this.blink = this.uiText(W / 2, 540, 'START: OTRO TURNO', 24, '#ffffff');
    }
  }

  drawName() {
    const ne = this.ne;
    ne.t.forEach((t, i) => t.setText(String.fromCharCode(65 + ne.l[i])).setColor(i === ne.p ? '#ffe14d' : '#ffffff'));
    ne.c.x = W / 2 - 60 + ne.p * 60;
  }

  submitName() {
    const s = { n: this.ne.l.map((i) => String.fromCharCode(65 + i)).join(''), s: this.score };
    this.scores.push(s);
    this.scores.sort((a, b) => b.s - a.s);
    this.scores.length = Math.min(5, this.scores.length);
    getStorage().set(STORE_KEY, this.scores).catch(() => {});
    this.tone(660, 0.1, 'square', 0.05);
    this.tone(990, 0.2, 'square', 0.05, 0, 0.1);
    this.overPanel(false, s);
  }

  loadScores() {
    getStorage()
      .get(STORE_KEY)
      .then((r) => {
        if (!r || !r.found || !Array.isArray(r.value)) return;
        // Storage outlives releases: only trust entries with the expected shape.
        this.scores = r.value
          .filter((v) => v && typeof v.n === 'string' && Number.isFinite(v.s))
          .map((v) => ({ n: v.n.slice(0, 3).toUpperCase(), s: Math.floor(v.s) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, 5);
        if (this.mode === 'title') this.showTitle();
      })
      .catch(() => {});
  }

  // --------------------------------------------------------------- loop ---
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const m = this.mode;
    if (this.blink) this.blink.setAlpha(0.55 + 0.45 * Math.sin(time / 180));
    if (m === 'title') this.tick(dt, true);
    else if (m === 'play') this.tick(dt, false);
    else if (m === 'over' && (this.idle += dt) > 20) this.showTitle();

    const on = this.rush && (m === 'play' || m === 'pause');
    this.rushBg.setAlpha(on ? 0.07 + 0.06 * Math.sin(time / 90) : 0);
    this.rushTxt.setAlpha(on ? 0.55 + 0.45 * Math.sin(time / 70) : 0);
    this.drawRushBar();
  }

  baseSpeed() {
    return 95 + Math.min(65, this.t * 0.5); // px per second, ramps up over ~2 min
  }

  // One simulation step. demo = attract mode behind the title (no scoring, no crashes).
  tick(dt, demo) {
    this.now += dt * 1000;
    if (demo) {
      if ((this.demoT -= dt) <= 0) {
        this.demoT = 0.9;
        const n = pick(this.nodeList);
        n.state ^= 1;
        this.drawNode(n);
      }
    } else {
      this.t += dt;
      this.stepPhase(dt);
      this.music(dt);
    }

    // Rush hour doubles both train speed and spawn rate.
    this.sm += ((this.rush ? 2 : 1) - this.sm) * Math.min(1, dt * 4);
    // Trains only spawn in the calm and rush phases; the breather, the reward
    // and the inauguration all keep the spawner switched off.
    if (demo || this.phase === 'calm' || this.phase === 'rush') {
      this.spawnT -= dt * 1000 * (this.rush ? 2 : 1);
      if (this.spawnT <= 0) this.spawnT = this.spawn(demo) ? (demo ? 1100 : Math.max(1050, 3000 - this.t * 20)) : 200;
    }

    const v = this.baseSpeed() * this.sm;
    for (const tr of this.trains.slice()) {
      tr.d += v * tr.k * dt;
      while (!tr.dead && tr.d >= tr.e.len) {
        const n = tr.e.to;
        if (!n) {
          this.arrive(tr, demo);
          break;
        }
        // Reached a switch: the node decides the next path right now.
        tr.d -= tr.e.len;
        tr.e = this.route(n, tr.e);
        if (!demo && n.active) {
          // NEAR MISS: another train went through this node a moment ago.
          if (((this.now - n.last) / 1000) * v < 48) this.nearMiss(n);
          n.last = this.now;
        }
      }
      if (!tr.dead) this.place(tr);
    }

    if (demo) return;
    // Collisions: two trains overlapping on the same piece of track.
    const ts = this.trains;
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i];
        const b = ts[j];
        if (a.e === b.e && Math.abs(a.d - b.d) < (a.len + b.len) / 2 - 3) return this.crash(a, b);
      }
    }
  }

  // ------------------------------------------------- rush hour sequence ---
  // calm (15 s first, 25 s after) -> rush (10 s) -> clear (no spawning, but
  // still 2x speed until the map is empty) -> bonus (lives x 500 tally) ->
  // reward (+1 vida) -> inaug (next line lights up) -> calm again.
  // Instead of Phaser timers, every step runs on `cyc`/`ph`, which only
  // advance while the game is running. That way pausing is safe at any
  // point and no two announcements can overlap.
  stepPhase(dt) {
    const P = this.phase;
    if (P === 'calm') {
      this.cyc += dt;
      const left = Math.ceil(this.calmLen - this.cyc);
      if (left <= 0) this.startRush();
      else if (left <= 3 && left !== this.warn) {
        this.warn = left;
        this.tone(880, 0.1, 'square', 0.06);
      }
    } else if (P === 'rush') {
      if ((this.cyc += dt) >= RUSH_SECONDS) this.endRush();
    } else if (P === 'clear') {
      // Rush hour stays on (2x speed, pulse, x2 points) until the last rush
      // train has left the map; then the celebration starts straight away.
      if (!this.trains.length) this.bonus();
    } else if (P === 'bonus') {
      this.ph += dt;
      const B = this.tally;
      // Count the lives one by one so the maths visibly adds up.
      while (B.n < B.lives && this.ph >= (B.n + 1) * 0.18) {
        B.n++;
        if (B.txt.active) B.txt.setText(B.n + ' x ' + LIFE_BONUS + ' = ' + B.n * LIFE_BONUS);
        this.tone(500 + B.n * 90, 0.07, 'square', 0.05);
      }
      // 4. Apply the points one second in, and make the score jump.
      if (!B.paid && this.ph >= 1) {
        B.paid = true;
        this.score += B.pts;
        this.drawHud();
        this.bumpScore();
        this.tone(880, 0.1, 'triangle', 0.09);
        this.tone(1320, 0.18, 'triangle', 0.09, 0, 0.08);
      }
      // 5. The tally has faded by now; the reward follows a second after the payout.
      if (this.ph >= 2.1) this.reward();
    } else {
      if (P === 'inaug') {
        // Fade the new line from grey to neon; its switches appear at full glow.
        const L = this.newLine;
        if (L.k < 1) {
          L.k = Math.min(1, L.k + dt / 1.1);
          this.drawLine(L);
          if (L.k === 1) this.refreshNodes(true);
        }
      }
      if ((this.ph -= dt) <= 0) {
        if (P === 'reward' && this.lineList.some((L) => !L.on)) this.inaugurate();
        else this.resume();
      }
    }
  }

  startRush() {
    this.phase = 'rush';
    this.rush = true;
    this.cyc = 0;
    this.cameras.main.flash(250, 255, 60, 90);
    this.banner('¡HORA PUNTA!', 300, 76, '#ffffff', '#ff1f4b', 500);
    for (let i = 0; i < 3; i++) this.tone(500, 0.3, 'sawtooth', 0.07, 1000, i * 0.3);
  }

  // 1. The 10 s are up: only spawning stops. `rush` stays true, so the
  // trains still on the map keep their 2x speed and the screen keeps pulsing.
  endRush() {
    this.phase = 'clear';
    this.cyc = 0;
    this.ph = 0;
    this.tone(330, 0.25, 'triangle', 0.08, 220);
  }

  // 2 + 3. The map is empty: rush hour really ends here (speed back to 1x,
  // pulse off). Bono de Supervivencia: 500 points for every life held right
  // now. The life granted afterwards by reward() is deliberately not counted.
  bonus() {
    const lives = this.lives;
    this.rush = false;
    this.sm = 1;
    this.phase = 'bonus';
    this.ph = 0;
    this.banner('BONO DE SUPERVIVENCIA', 266, 32, '#ffe14d', '#ff8a3d', 1450);
    this.tally = { lives, n: 0, paid: false, pts: lives * LIFE_BONUS, txt: this.banner('0 x ' + LIFE_BONUS + ' = 0', 322, 48, '#ffffff', '#ffe14d', 1450) };
  }

  // 5. The reward: celebratory text, +1 life (capped) and a HUD bump.
  reward() {
    const more = this.lineList.some((L) => !L.on);
    this.phase = 'reward';
    // The banner lasts about 1.8 s; the inauguration starts 1 s after it fades.
    this.ph = more ? 2.8 : 2.2;
    const got = this.lives < MAX_LIVES;
    if (got) this.lives++;
    this.drawHud();
    this.banner('¡HORA PUNTA SUPERADA!', 262, 40, '#ffffff', '#17d68a', 1300);
    this.banner(got ? '+1 VIDA' : 'VIDAS AL MÁXIMO', 322, 54, '#17d68a', '#17d68a', 1300);
    if (got) {
      this.bumpLives('#17d68a', 2);
      this.ping(704 + this.pipX(this.lives - 1), 31, 0x17d68a, 46, 21);
    }
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, 0, i * 0.1));
  }

  // 6. The inauguration: announce the next grey line and light it up.
  inaugurate() {
    const L = this.lineList.find((x) => !x.on);
    L.on = true;
    this.newLine = L;
    this.phase = 'inaug';
    this.ph = 2.4;
    this.banner('¡INAUGURACIÓN LÍNEA ' + L.label.slice(1) + '!', 290, 42, hex(L.color), hex(L.color), 1500);
    for (const e of L.edges) {
      if (!e.from) this.ping(e.sx, e.sy, L.color, 80);
      if (!e.to) this.ping(e.ex, e.ey, L.color, 80);
    }
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'square', 0.05, 0, i * 0.12));
  }

  // Back to normal: spawner on (new line included), and the countdown to
  // the next rush hour restarts at NEXT_CALM (25 s).
  resume() {
    this.phase = 'calm';
    this.calmLen = NEXT_CALM;
    this.cyc = 0;
    this.warn = 0;
    this.spawnT = 500;
  }

  place(tr) {
    const e = tr.e;
    const p = e.path.getPoint(Math.min(0.9999, tr.d / e.len), this.v1);
    const q = e.path.getPoint(Math.min(1, (tr.d + 6) / e.len), this.v2);
    if (!p) return;
    tr.img.setPosition(p.x, p.y);
    if (q && (q.x !== p.x || q.y !== p.y)) tr.img.rotation = Math.atan2(q.y - p.y, q.x - p.x);
  }

  spawn(demo) {
    const ex = !demo && this.t > 45 && rnd() < 0.18; // express trains: 40% faster
    // Only open lines spawn trains. Never spawn on top of a train, and never
    // put an express behind a slower one.
    const free = this.entries.filter((e) => e.L.on && !this.trains.some((t) => t.e === e && (ex || t.d < 75)));
    if (!free.length) return false;
    const e = pick(free);
    // Early on most trains simply belong on the line they arrive on.
    const own = !demo && rnd() < Math.max(0.3, 0.75 - this.t * 0.006);
    const reach = this.reach(e);
    const others = reach.filter((l) => l !== e.line);
    const line = own || !others.length ? e.line : pick(demo ? reach : others);
    const tr = { e, d: 0, k: ex ? 1.4 : 1, len: ex ? 34 : 26, line, color: LINES[line].color, dead: false };
    tr.img = this.add.image(-99, -99, 't' + line + (ex ? 1 : 0)).setDepth(6);
    this.trains.push(tr);
    this.place(tr);
    if (!demo) {
      this.ping(e.sx, e.sy, tr.color, 26);
      if (ex) {
        this.float(Phaser.Math.Clamp(e.sx, 60, W - 60), e.sy - 22, 'EXPRESO', '#ffffff', 13);
        this.tone(1200, 0.12, 'sawtooth', 0.04, 1800);
      }
    }
    return true;
  }

  kill(tr) {
    tr.dead = true;
    tr.img.destroy();
    const i = this.trains.indexOf(tr);
    if (i >= 0) this.trains.splice(i, 1);
  }

  clearTrains() {
    for (const tr of this.trains) tr.img.destroy();
    this.trains = [];
  }

  arrive(tr, demo) {
    const e = tr.e;
    this.kill(tr);
    if (demo) return;
    if (e.line === tr.line) {
      // Success: score Base Points x comboMultiplier (doubled in rush hour),
      // then count the train toward the next combo tier.
      const pts = BASE_POINTS * this.comboMultiplier * (this.rush ? 2 : 1);
      this.score += pts;
      this.ping(e.ex, e.ey, tr.color, 44);
      this.float(e.ex, e.ey - 30, '+' + pts, hex(tr.color), 20);
      this.tone(520 + this.comboMultiplier * 60, 0.09, 'triangle', 0.09);
      this.tone(780 + this.comboMultiplier * 90, 0.14, 'triangle', 0.09, 0, 0.07);
      this.comboStep();
    } else {
      // Wrong terminal: lose a life and the whole combo.
      this.lives--;
      this.comboReset();
      this.ping(e.ex, e.ey, 0xff3347, 44);
      this.float(Phaser.Math.Clamp(e.ex, 70, W - 70), e.ey - 30, 'RECLAMO  -1 VIDA', '#ff4d6d', 16);
      this.bumpLives('#ff4d6d', 0.5);
      this.cameras.main.shake(160, 0.006);
      this.tone(160, 0.3, 'sawtooth', 0.09, 70);
      if (this.lives <= 0) {
        this.mode = 'crash';
        this.time.delayedCall(800, () => this.gameOver('LÍNEA SUSPENDIDA', 'TE QUEDASTE SIN VIDAS'));
      }
    }
    this.drawHud();
  }

  // Near miss: bonus points only; the combo bar moves on delivered trains.
  nearMiss(n) {
    const pts = BASE_POINTS * this.comboMultiplier;
    this.score += pts;
    this.float(n.x, n.y - 58, '¡POR UN PELO! +' + pts, '#4de3ff', 18);
    this.ping(n.x, n.y, 0x4de3ff, 60);
    this.tone(1320, 0.07, 'square', 0.05);
    this.tone(1760, 0.1, 'square', 0.05, 0, 0.06);
    this.drawHud();
  }

  crash(a, b) {
    this.mode = 'crash';
    this.comboReset();
    const x = (a.img.x + b.img.x) / 2;
    const y = (a.img.y + b.img.y) / 2;
    const cols = [a.color, b.color, 0xffffff, 0xff8a3d];
    this.kill(a);
    this.kill(b);
    this.cameras.main.shake(750, 0.035);
    this.cameras.main.flash(180, 255, 255, 255);
    this.ping(x, y, 0xffffff, 240);
    this.ping(x, y, 0xff8a3d, 140);
    // Explosion made of plain shapes: squares, circles and triangles.
    for (let i = 0; i < 54; i++) {
      const s = 5 + rnd() * 11;
      const c = pick(cols);
      const o = i % 3 === 0 ? this.add.rectangle(x, y, s, s, c) : i % 3 === 1 ? this.add.circle(x, y, s / 2, c) : this.add.triangle(x, y, 0, s, s / 2, 0, s, s, c);
      const ang = rnd() * 6.283;
      const dist = 50 + rnd() * 260;
      o.setDepth(9);
      this.tweens.add({ targets: o, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, angle: rnd() * 720 - 360, alpha: 0, scale: 0.3, duration: 600 + rnd() * 900, ease: 'Cubic.easeOut', onComplete: () => o.destroy() });
    }
    this.noise(0.9, 0.3);
    this.tone(220, 0.8, 'sawtooth', 0.14, 30);
    this.time.delayedCall(1500, () => this.gameOver('¡COLISIÓN!', 'DOS TRENES EN LA MISMA VÍA'));
  }

  // ----------------------------------------------------------------- fx ---
  ping(x, y, color, size, depth) {
    const c = this.add.circle(x, y, 10).setStrokeStyle(3, color).setDepth(depth || 8);
    this.tweens.add({ targets: c, scale: size / 10, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
  }

  float(x, y, s, color, size) {
    const t = this.label(x, y, s, size, color).setDepth(9);
    t.setStroke('#05060a', 4);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 1000, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
  }

  // Big centre-screen announcement: zooms in, holds for `hold` ms, fades out.
  banner(s, y, size, color, glow, hold) {
    const t = this.label(W / 2, y, s, size, color).setDepth(25).setScale(1.8).setAlpha(0);
    t.setStroke('#05060a', 6);
    t.setPadding(30); // room for the glow, otherwise it is clipped into a box
    if (glow) t.setShadow(0, 0, glow, 18, false, true);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 250, ease: 'Cubic.easeOut', yoyo: true, hold, onComplete: () => t.destroy() });
    return t;
  }

  // -------------------------------------------------------------- audio ---
  // All sound is synthesised with Web Audio oscillators; no audio files.
  tone(f, dur, type, vol, to, at) {
    const c = this.sound.context;
    if (!c) return;
    try {
      const t = c.currentTime + (at || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (err) {
      /* audio is optional */
    }
  }

  noise(dur, vol) {
    const c = this.sound.context;
    if (!c) return;
    try {
      if (!this.nbuf) {
        this.nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
      }
      const s = c.createBufferSource();
      const g = c.createGain();
      s.buffer = this.nbuf;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      s.connect(g);
      g.connect(c.destination);
      s.start();
      s.stop(c.currentTime + dur);
    } catch (err) {
      /* audio is optional */
    }
  }

  // Tiny step sequencer: a bass pulse that speeds up and gains an alarm in
  // rush hour (including the clear-out), and drops to a slow heartbeat
  // during the bonus, reward and inauguration.
  music(dt) {
    if ((this.beatT -= dt) > 0) return;
    const calm = this.phase === 'calm';
    this.beatT += this.rush ? 0.11 : calm ? Math.max(0.15, 0.21 - this.t * 0.0004) : 0.28;
    const i = this.beat++ % 16;
    if (BASS[i]) this.tone(BASS[i] * (this.rush ? 1.5 : 1), 0.16, 'sawtooth', 0.04);
    if (i % 2 && (calm || this.rush)) this.noise(0.03, 0.02);
    if (this.rush && i % 4 === 0) this.tone(i % 8 ? 660 : 880, 0.09, 'square', 0.03);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#090b11',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: HoraPunta,
});
