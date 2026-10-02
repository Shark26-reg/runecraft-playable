"use strict";
// Отрисовка: проекция мира на экран, спрайты из атласов, кэш свечений и самоцветов рун.
// Мир: x — вправо, z — к зрителю (вниз по экрану), h — высота. Камера ортогональная под тем же углом,
// под которым отрендерены спрайты (tools/render/render_sprites.gd), поэтому земля и персонажи совпадают.
const R = {
  canvas: null,
  ctx: null,
  W: 0,
  H: 0,
  dpr: 1,
  U: 32,          // CSS-пикселей на единицу мира (с учётом приближения)
  baseU: 32,
  zoom: 1,
  SY: 0.64,       // сжатие земли по вертикали (синус наклона камеры)
  HY: 0.77,       // как высота переходит в экранную вертикаль (косинус наклона)
  camX: 0,
  camZ: 0,
  shakeX: 0,
  shakeY: 0,
  trauma: 0,
  time: 0,
  focusX: 0.5,    // в какой точке экрана (доли ширины и высоты) стоит то, за чем следит камера
  focusY: 0.54,
  glowCache: {},
  gemCache: {},
  sil: {},

  init() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    const p = (Assets.sprites.pitch * Math.PI) / 180;
    this.SY = Math.sin(p);
    this.HY = Math.cos(p);
    this.buildSilhouettes();
    this.resize();
  },

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.dpr = Math.min(CONFIG.maxDpr, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.W = W;
    this.H = H;
    // Портрет — по ширине, альбом — по глубине; на больших мониторах не раздуваем спрайты.
    this.baseU = Math.min(W / CONFIG.viewWidth, H / (CONFIG.viewDepth * this.SY), 64);
    this.U = this.baseU * this.zoom;
    this.gemCache = {};
  },

  begin() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.imageSmoothingEnabled = true;
    if (this.trauma > 0) {
      const k = this.trauma * this.trauma * 9;
      this.shakeX = (Math.random() * 2 - 1) * k;
      this.shakeY = (Math.random() * 2 - 1) * k;
    } else {
      this.shakeX = this.shakeY = 0;
    }
  },

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  },

  update(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  },

  sx(x) {
    return (x - this.camX) * this.U + this.W * this.focusX + this.shakeX;
  },

  sy(z, h = 0) {
    return (z - this.camZ) * this.U * this.SY - h * this.U * this.HY + this.H * this.focusY + this.shakeY;
  },

  // Границы видимой части мира (с запасом) — для отсечения.
  visible(x, z, margin = 2) {
    const left = (this.W * this.focusX) / this.U + margin;
    const right = (this.W * (1 - this.focusX)) / this.U + margin;
    const top = (this.H * this.focusY) / (this.U * this.SY) + margin + 4;
    const bottom = (this.H * (1 - this.focusY)) / (this.U * this.SY) + margin;
    return x > this.camX - left && x < this.camX + right && z > this.camZ - top && z < this.camZ + bottom;
  },

  // ——— Спрайты персонажей ———

  // Силуэты для вспышек (белый — попадание, голубой — заморозка, красный — урон по герою).
  // Половинное разрешение: вспышка короткая, детали не нужны, а память на слабых телефонах дорога.
  buildSilhouettes() {
    const make = (img, color) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(img.width / 2);
      c.height = Math.ceil(img.height / 2);
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, c.width, c.height);
      x.globalCompositeOperation = "source-in";
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      return c;
    };
    for (const id of ["hero", "minion", "rogue", "boss"]) {
      const img = Assets.images[id];
      this.sil[id] = { white: make(img, "#ffffff") };
      if (id === "minion" || id === "rogue") this.sil[id].ice = make(img, "#7fd8ff");
      if (id === "hero") this.sil[id].red = make(img, "#ff3b3b");
    }
  },

  // dir — одно из 8 направлений: 0 — к зрителю, 2 — вправо, 4 — от зрителя, 6 — влево.
  drawChar(id, animName, dir, t, x, z, o = {}) {
    const set = Assets.sprites.characters[id];
    const a = set.anims[animName];
    let d = dir;
    let flip = false;
    if (a.south) {
      d = 0;
      flip = !!o.flip;
    } else if (set.dirs !== 8 && dir > 4) {
      d = 8 - dir;
      flip = true;
    }
    const f = a.loop ? Math.floor((t / a.len) * a.n) % a.n : Math.min(a.n - 1, Math.floor((t / a.len) * a.n));
    const idx = (a.south ? 0 : d) * a.n + Math.max(0, f);
    const cw = a.cell[0];
    const ch = a.cell[1];
    const srcX = (idx % a.cols) * cw;
    const srcY = a.y + Math.floor(idx / a.cols) * ch;
    const s = (this.U / set.k) * (o.scale || 1);
    const c = this.ctx;
    c.save();
    c.translate(this.sx(x), this.sy(z, o.h || 0));
    if (flip) c.scale(-1, 1);
    const dx = -a.feet[0] * s;
    const dy = -a.feet[1] * s;
    c.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    c.drawImage(Assets.images[id], srcX, srcY, cw, ch, dx, dy, cw * s, ch * s);
    const sil = this.sil[id];
    for (const kind of ["ice", "red", "white"]) {
      const amount = o[kind];
      if (amount > 0.01 && sil[kind]) {
        c.globalAlpha = Math.min(1, amount) * (o.alpha === undefined ? 1 : o.alpha);
        c.drawImage(sil[kind], srcX / 2, srcY / 2, cw / 2, ch / 2, dx, dy, cw * s, ch * s);
      }
    }
    c.restore();
  },

  drawDecor(id, x, z, alpha = 1) {
    const d = Assets.sprites.decor[id];
    const s = this.U / d.k;
    const r = d.rect;
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.drawImage(Assets.images.decor, r[0], r[1], r[2], r[3], this.sx(x) - d.feet[0] * s, this.sy(z) - d.feet[1] * s, r[2] * s, r[3] * s);
    c.globalAlpha = 1;
  },

  // Экранный прямоугольник декора — чтобы понять, закрывает ли дерево героя.
  decorRect(id, x, z) {
    const d = Assets.sprites.decor[id];
    const s = this.U / d.k;
    const r = d.rect;
    return { x: this.sx(x) - d.feet[0] * s, y: this.sy(z) - d.feet[1] * s, w: r[2] * s, h: r[3] * s };
  },

  // ——— Свечения и тени ———

  glow(color) {
    let g = this.glowCache[color];
    if (!g) {
      g = document.createElement("canvas");
      g.width = g.height = 64;
      const x = g.getContext("2d");
      const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.18, color);
      grad.addColorStop(0.5, hexA(color, 0.35));
      grad.addColorStop(1, hexA(color, 0));
      x.fillStyle = grad;
      x.fillRect(0, 0, 64, 64);
      this.glowCache[color] = g;
    }
    return g;
  },

  drawGlow(color, px, py, size, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.drawImage(this.glow(color), px - size / 2, py - size / 2, size, size);
  },

  shadowTex: null,
  drawShadow(x, z, r, alpha = 1) {
    if (!this.shadowTex) {
      const g = document.createElement("canvas");
      g.width = g.height = 64;
      const x2 = g.getContext("2d");
      const grad = x2.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(10,6,20,0.55)");
      grad.addColorStop(0.6, "rgba(10,6,20,0.3)");
      grad.addColorStop(1, "rgba(10,6,20,0)");
      x2.fillStyle = grad;
      x2.fillRect(0, 0, 64, 64);
      this.shadowTex = g;
    }
    const w = r * 2.4 * this.U;
    const h = w * this.SY;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.shadowTex, this.sx(x) - w / 2, this.sy(z) - h / 2, w, h);
    this.ctx.globalAlpha = 1;
  },

  // ——— Самоцвет руны (как RuneGem в интерфейсе игры) ———

  gem(rune, size) {
    const key = rune + "|" + Math.round(size);
    let g = this.gemCache[key];
    if (g) return g;
    const px = Math.round(size * this.dpr);
    g = document.createElement("canvas");
    g.width = g.height = px;
    drawGemShape(g.getContext("2d"), rune, px);
    this.gemCache[key] = g;
    return g;
  },
};

function drawGemShape(c, rune, px) {
  const col = RUNES[rune].color;
  const cx = px / 2;
  const cy = px / 2;
  const rad = px * 0.44;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const poly = (list) => {
    c.beginPath();
    list.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
  };
  poly(pts);
  c.fillStyle = mixHex(col, "#000000", 0.55);
  c.fill();
  const inner = pts.map((p) => [cx + (p[0] - cx) * 0.82, cy + (p[1] - cy) * 0.82]);
  poly(inner);
  const grad = c.createLinearGradient(0, cy - rad, 0, cy + rad);
  grad.addColorStop(0, mixHex(col, "#ffffff", 0.12));
  grad.addColorStop(1, mixHex(col, "#000000", 0.15));
  c.fillStyle = grad;
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = px * 0.035;
  c.beginPath();
  c.moveTo(inner[4][0], inner[4][1]);
  c.lineTo(inner[5][0], inner[5][1]);
  c.stroke();
  poly(pts);
  c.strokeStyle = mixHex(col, "#ffffff", 0.35);
  c.lineWidth = px * 0.025;
  c.stroke();
  const fs = Math.round(rad * 1.05);
  c.font = fs + 'px "RC Runic", serif';
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillText(RUNES[rune].glyph, cx + px * 0.02, cy + px * 0.03);
  c.fillStyle = "#fffaf0";
  c.fillText(RUNES[rune].glyph, cx, cy + px * 0.01);
}

// ——— Цвета ———

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexA(hex, a) {
  const c = hexRgb(hex);
  return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
}

function mixHex(a, b, k) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  const m = (i) => Math.round(x[i] + (y[i] - x[i]) * k);
  return "#" + ((1 << 24) | (m(0) << 16) | (m(1) << 8) | m(2)).toString(16).slice(1);
}
