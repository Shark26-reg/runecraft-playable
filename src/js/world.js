"use strict";
// Арена: бесшовная земля, светящееся рунное кольцо (как край арены в игре), лес вокруг,
// камни-препятствия внутри и мелкий декор. Расстановка детерминированная, сцена всегда одна и та же.

// Старший футарк по кругу арены. prepare_fonts.py берёт символы рунического блока из всех JS-файлов.
const RING_GLYPHS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, list) {
  let total = 0;
  for (const it of list) total += it[1];
  let r = rand() * total;
  for (const it of list) {
    r -= it[1];
    if (r <= 0) return it[0];
  }
  return list[list.length - 1][0];
}

const TREE_SET = [["tree_oak", 3], ["tree_default", 3], ["tree_pine", 3], ["tree_fat", 2], ["tree_oak_dark", 2], ["tree_pine_round", 2], ["bush_large", 2]];
const FLAT_SET = [["grass_large", 6], ["grass", 5], ["grass_leafs", 3], ["flower_red", 2], ["flower_yellow", 2], ["flower_purple", 2],
  ["mushrooms", 1], ["bush", 2], ["stone_small", 1], ["stump", 1]];
// Препятствия внутри арены: [модель, угол, расстояние от центра].
const OBSTACLE_LAYOUT = [["stone_large", 0.5, 8.2], ["obelisk", 2.2, 6.4], ["stone_tall", 3.5, 9.2], ["log", 4.5, 7.4], ["stone_large", 5.6, 9.6]];

const World = {
  trees: [],
  obstacles: [],
  flats: [],

  generate(seed) {
    const rand = makeRng(seed);
    this.trees = [];
    this.obstacles = [];
    this.flats = [];
    for (const [id, a, r] of OBSTACLE_LAYOUT) {
      const meta = Assets.sprites.decor[id];
      this.obstacles.push({ id, x: Math.cos(a) * r, z: Math.sin(a) * r, r: Math.min(1.5, meta.radius * 0.7), deco: true });
    }
    // Лес за кольцом: деревья не ближе 1.7 друг к другу.
    for (let tries = 0; tries < 900 && this.trees.length < 120; tries++) {
      const a = rand() * Math.PI * 2;
      const r = ARENA_RADIUS + 1.6 + Math.pow(rand(), 0.85) * 10;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 1.7 * 1.7)) continue;
      this.trees.push({ id: pickWeighted(rand, TREE_SET), x, z, fade: 1, deco: true });
    }
    // Трава, цветы, грибы — под ногами, рисуются до персонажей.
    for (let tries = 0; tries < 600 && this.flats.length < 170; tries++) {
      const a = rand() * Math.PI * 2;
      const r = 1.8 + Math.sqrt(rand()) * (ARENA_RADIUS + 7);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.obstacles.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + 0.8) ** 2)) continue;
      if (Math.abs(r - ARENA_RADIUS - 0.6) < 0.7) continue;
      this.flats.push({ id: pickWeighted(rand, FLAT_SET), x, z });
    }
    this.flats.sort((p, q) => p.z - q.z);
  },

  drawGround() {
    const img = Assets.images.ground;
    const tile = Assets.sprites.ground.tile;
    const tw = tile * R.U;
    const th = tile * R.U * R.SY;
    const x0 = R.camX - (R.W * R.focusX) / R.U - 1;
    const x1 = R.camX + (R.W * (1 - R.focusX)) / R.U + 1;
    const z0 = R.camZ - (R.H * R.focusY) / (R.U * R.SY) - 1;
    const z1 = R.camZ + (R.H * (1 - R.focusY)) / (R.U * R.SY) + 1;
    const c = R.ctx;
    for (let i = Math.floor(x0 / tile); i <= Math.floor(x1 / tile); i++) {
      for (let j = Math.floor(z0 / tile); j <= Math.floor(z1 / tile); j++) {
        // Округление и перехлёст в пиксель — иначе между плитками видны швы.
        const px = Math.floor(R.sx(i * tile));
        const py = Math.floor(R.sy(j * tile));
        c.drawImage(img, px, py, Math.ceil(tw) + 1, Math.ceil(th) + 1);
      }
    }
  },

  // Затемнение за кольцом и само кольцо: яркость бежит волной по кругу, как у шейдера земли в игре.
  drawRing() {
    const c = R.ctx;
    const cx = R.sx(0);
    const cy = R.sy(0);
    const rad = ARENA_RADIUS * R.U;
    c.save();
    c.translate(cx, cy);
    c.scale(1, R.SY);
    const g = c.createRadialGradient(0, 0, rad + 0.4 * R.U, 0, 0, rad + 11 * R.U);
    g.addColorStop(0, "rgba(10,6,22,0)");
    g.addColorStop(1, "rgba(10,6,22,0.62)");
    c.fillStyle = g;
    c.fillRect(-cx - 20, -cy / R.SY - 20, R.W + 40, R.H / R.SY + 40);
    c.globalCompositeOperation = "lighter";
    const seg = 60;
    const t = R.time;
    c.lineCap = "round";
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      const px = Math.cos(mid) * (ARENA_RADIUS + 0.6);
      const pz = Math.sin(mid) * (ARENA_RADIUS + 0.6);
      if (!R.visible(px, pz, 3)) continue;
      const k = 0.8 + 0.4 * Math.sin(t * 2 + mid * 9);
      // Широкая полоса — обычным наложением (иначе на траве цвет выгорает в белый), сердцевина — свечением.
      c.beginPath();
      c.arc(0, 0, rad + 0.6 * R.U, a0, a1 + 0.01);
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = "rgba(124,58,237," + 0.32 * k + ")";
      c.lineWidth = 1.0 * R.U;
      c.stroke();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = "rgba(150,90,255," + 0.55 * k + ")";
      c.lineWidth = 0.28 * R.U;
      c.stroke();
      c.strokeStyle = "rgba(225,205,255," + 0.6 * k + ")";
      c.lineWidth = 0.07 * R.U;
      c.stroke();
    }
    c.restore();
    // Руны вдоль кольца, снаружи.
    c.globalCompositeOperation = "lighter";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = Math.round(0.8 * R.U) + 'px "RC Runic", serif';
    const n = RING_GLYPHS.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * (ARENA_RADIUS + 1.6);
      const z = Math.sin(a) * (ARENA_RADIUS + 1.6);
      if (!R.visible(x, z, 1)) continue;
      c.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + a * 9);
      c.fillStyle = "#c9a8ff";
      c.fillText(RING_GLYPHS[i], R.sx(x), R.sy(z, 0.1));
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  },

  drawFlats() {
    for (const f of this.flats) {
      if (R.visible(f.x, f.z, 1)) R.drawDecor(f.id, f.x, f.z);
    }
  },

  // Выталкивание из камней (герой и враги — круги).
  resolve(o, r) {
    for (const ob of this.obstacles) {
      const dx = o.x - ob.x;
      const dz = o.z - ob.z;
      const min = r + ob.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const k = (min - d) / d;
        o.x += dx * k;
        o.z += dz * k;
      }
    }
  },

  clampArena(o, r) {
    const d = Math.hypot(o.x, o.z);
    const max = ARENA_RADIUS - r - 0.3;
    if (d > max) {
      o.x *= max / d;
      o.z *= max / d;
    }
  },
};
