"use strict";
// Эффекты: частицы, молнии, кольца ударных волн, предупреждения об атаке, всплывающий урон.
// Всё рисуется процедурно (градиенты и линии), картинок не нужно.
const FX = {
  parts: [],
  rings: [],
  bolts: [],
  marks: [],      // круги на земле: предупреждения об атаке босса
  numbers: [],
  cones: [],
  flash: 0,
  flashColor: "#ffffff",

  reset() {
    this.parts.length = this.rings.length = this.bolts.length = 0;
    this.marks.length = this.numbers.length = this.cones.length = 0;
    this.flash = 0;
  },

  // ——— Частицы ———
  // kind: glow — светящаяся точка (аддитивно), bone — косточка, smoke — дымка.
  spawn(p) {
    if (this.parts.length > 420) this.parts.shift();
    p.t = 0;
    p.vx = p.vx || 0;
    p.vz = p.vz || 0;
    p.vh = p.vh || 0;
    p.h = p.h || 0;
    p.grav = p.grav === undefined ? 0 : p.grav;
    p.drag = p.drag === undefined ? 1.5 : p.drag;
    p.kind = p.kind || "glow";
    p.size2 = p.size2 === undefined ? p.size * 0.2 : p.size2;
    this.parts.push(p);
  },

  burst(x, z, h, color, count, speed, life = 0.6, size = 0.5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.spawn({ x, z, h, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vh: (Math.random() - 0.3) * speed * 0.8,
        life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color, grav: -4 });
    }
  },

  bones(x, z) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 3;
      this.spawn({ kind: "bone", x, z, h: 0.6 + Math.random() * 0.6, vx: Math.cos(a) * s, vz: Math.sin(a) * s,
        vh: 3 + Math.random() * 4, grav: -16, drag: 0.6, life: 0.7 + Math.random() * 0.4, size: 0.22, color: "#efe6d2",
        rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18 });
    }
  },

  // ——— Кольца, конусы, круги на земле ———

  ring(x, z, r0, r1, dur, color, width = 0.35, fill = 0.25) {
    this.rings.push({ x, z, r0, r1, t: 0, dur, color, width, fill });
  },

  cone(x, z, dirA, halfAngle, range, color) {
    this.cones.push({ x, z, dirA, half: halfAngle, range, color, t: 0, dur: 0.35 });
  },

  mark(x, z, r, dur, color) {
    const m = { x, z, r, t: 0, dur, color };
    this.marks.push(m);
    return m;
  },

  // ——— Молния: ломаная между точками, перерисовывается с дрожанием ———
  bolt(points, color, dur = 0.22, width = 1) {
    this.bolts.push({ points, color, t: 0, dur, width, seed: Math.random() * 1000, jag: null, jagT: -1 });
  },

  number(x, z, h, value, color, big = false) {
    if (this.numbers.length > 40) this.numbers.shift();
    this.numbers.push({ x: x + (Math.random() - 0.5) * 0.5, z, h, text: String(Math.round(value)), color, t: 0, dur: big ? 0.9 : 0.65, big });
  },

  screenFlash(color, amount) {
    this.flashColor = color;
    this.flash = Math.max(this.flash, amount);
  },

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.parts.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vh = p.vh * k + p.grav * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.h += p.vh * dt;
      if (p.kind === "bone") {
        p.rot += p.spin * dt;
        if (p.h < 0.05) {
          p.h = 0.05;
          p.vh = -p.vh * 0.35;
          p.vx *= 0.6;
          p.vz *= 0.6;
          p.spin *= 0.5;
        }
      }
    }
    for (const list of [this.rings, this.bolts, this.marks, this.numbers, this.cones]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].t += dt;
        if (list[i].t >= list[i].dur) list.splice(i, 1);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
  },

  // Слой на земле: рисуется до персонажей.
  drawGround() {
    const c = R.ctx;
    for (const m of this.marks) {
      const k = m.t / m.dur;
      c.save();
      c.translate(R.sx(m.x), R.sy(m.z));
      c.scale(1, R.SY);
      const rad = m.r * R.U;
      c.globalAlpha = 0.25 + 0.2 * Math.sin(m.t * 18);
      c.fillStyle = m.color;
      c.beginPath();
      c.arc(0, 0, rad, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 0.55;
      c.beginPath();
      c.arc(0, 0, rad * k, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 0.95;
      c.lineWidth = 3 / R.SY;
      c.strokeStyle = m.color;
      c.beginPath();
      c.arc(0, 0, rad, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    c.globalCompositeOperation = "lighter";
    for (const r of this.rings) {
      const k = r.t / r.dur;
      const e = 1 - Math.pow(1 - k, 3);
      const rad = (r.r0 + (r.r1 - r.r0) * e) * R.U;
      c.save();
      c.translate(R.sx(r.x), R.sy(r.z));
      c.scale(1, R.SY);
      const a = 1 - k;
      if (r.fill > 0) {
        const g = c.createRadialGradient(0, 0, rad * 0.3, 0, 0, rad);
        g.addColorStop(0, hexA(r.color, 0));
        g.addColorStop(1, hexA(r.color, r.fill * a));
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, rad, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = hexA(r.color, 0.9 * a);
      c.lineWidth = r.width * R.U * (1 - k * 0.6);
      c.beginPath();
      c.arc(0, 0, rad, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = hexA("#ffffff", 0.6 * a);
      c.lineWidth = r.width * R.U * 0.3;
      c.stroke();
      c.restore();
    }
    for (const q of this.cones) {
      const k = q.t / q.dur;
      c.save();
      c.translate(R.sx(q.x), R.sy(q.z));
      c.scale(1, R.SY);
      const rad = q.range * R.U * (0.5 + 0.5 * k);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, hexA(q.color, 0.55 * (1 - k)));
      g.addColorStop(1, hexA(q.color, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, rad, q.dirA - q.half, q.dirA + q.half);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.globalCompositeOperation = "source-over";
  },

  // Слой в воздухе: после персонажей.
  drawAir() {
    const c = R.ctx;
    for (const p of this.parts) {
      if (p.kind !== "bone") continue;
      const a = 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
      c.save();
      c.globalAlpha = a;
      c.translate(R.sx(p.x), R.sy(p.z, p.h));
      c.rotate(p.rot);
      const w = p.size * R.U;
      c.fillStyle = p.color;
      c.fillRect(-w / 2, -w * 0.14, w, w * 0.28);
      c.fillRect(-w / 2 - w * 0.08, -w * 0.22, w * 0.2, w * 0.44);
      c.fillRect(w / 2 - w * 0.12, -w * 0.22, w * 0.2, w * 0.44);
      c.restore();
    }
    c.globalCompositeOperation = "lighter";
    for (const p of this.parts) {
      if (p.kind === "bone") continue;
      const k = p.t / p.life;
      const size = (p.size + (p.size2 - p.size) * k) * R.U;
      const a = p.kind === "smoke" ? 0.35 * (1 - k) : 1 - k * k;
      R.drawGlow(p.color, R.sx(p.x), R.sy(p.z, p.h), size, a);
    }
    for (const b of this.bolts) {
      if (b.t - b.jagT > 0.045 || !b.jag) {
        b.jagT = b.t;
        b.jag = jagged(b.points);
      }
      const a = 1 - b.t / b.dur;
      const pts = b.jag.map((p) => [R.sx(p[0]), R.sy(p[1], p[2])]);
      const line = (w, col, alpha) => {
        c.globalAlpha = alpha * a;
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        c.stroke();
      };
      c.lineJoin = "round";
      c.lineCap = "round";
      line(R.U * 0.55 * b.width, b.color, 0.18);
      line(R.U * 0.22 * b.width, b.color, 0.55);
      line(R.U * 0.07 * b.width, "#ffffff", 1);
      for (const p of b.points) R.drawGlow(b.color, R.sx(p[0]), R.sy(p[1], p[2]), R.U * 1.6, 0.8 * a);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    // Всплывающие цифры урона.
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const n of this.numbers) {
      const k = n.t / n.dur;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
      const size = (n.big ? 0.62 : 0.44) * R.U * pop;
      const px = R.sx(n.x);
      const py = R.sy(n.z, n.h + k * 1.1);
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.font = "700 " + Math.round(size) + 'px "RC UI", sans-serif';
      c.lineWidth = Math.max(2, size * 0.16);
      c.strokeStyle = "rgba(20,10,30,0.9)";
      c.strokeText(n.text, px, py);
      c.fillStyle = n.color;
      c.fillText(n.text, px, py);
    }
    c.globalAlpha = 1;
  },

  drawScreen() {
    if (this.flash <= 0) return;
    const c = R.ctx;
    c.globalAlpha = Math.min(0.6, this.flash);
    c.fillStyle = this.flashColor;
    c.fillRect(0, 0, R.W, R.H);
    c.globalAlpha = 1;
  },
};

// Ломаная молнии: между соседними точками — 5–7 изломов со случайным сдвигом поперёк.
function jagged(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const steps = 5 + Math.floor(Math.random() * 3);
    for (let s = 1; s < steps; s++) {
      const k = s / steps;
      const off = (Math.random() - 0.5) * Math.min(1.1, len * 0.22);
      out.push([a[0] + dx * k + nx * off, a[1] + dz * k + nz * off, a[2] + (b[2] - a[2]) * k + (Math.random() - 0.5) * 0.3]);
    }
    out.push(b);
  }
  return out;
}
