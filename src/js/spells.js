"use strict";
// Заклинания из рун. Каждое кастуется само по перезарядке, как в игре, — игрок только бегает.

class SpellSlot {
  constructor(id) {
    this.id = id;
    this.def = SPELLS[id];
    this.timer = 0.25;
  }

  get cdFrac() {
    return Math.max(0, Math.min(1, this.timer / this.def.cd));
  }

  update(dt, hero) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = castSpell(this.id, hero) ? this.def.cd : 0.15;
  }
}

function castSpell(id, hero) {
  const s = SPELLS[id];
  switch (s.type) {
    case "chain": return castChain(s, hero);
    case "cone": return castCone(s, hero);
    case "nova": return castNova(s, hero);
    case "zone": return castZone(s, hero);
  }
  return false;
}

// Цепная молния: от посоха к ближайшему врагу и дальше к соседям.
function castChain(s, hero) {
  let target = Game.nearestEnemy(hero.x, hero.z, s.range);
  if (!target) return false;
  const hit = [];
  const pts = [hero.staff()];
  for (let i = 0; i <= s.jumps && target; i++) {
    hit.push(target);
    pts.push([target.x, target.z, 0.9]);
    Game.damage(target, s.dmg * (1 - i * 0.08), s.color);
    target.flash = 1;
    FX.burst(target.x, target.z, 0.9, s.color, 5, 3, 0.35, 0.45);
    let next = null;
    let best = 4.8 * 4.8;
    for (const e of Game.enemies) {
      if (e.dead || hit.includes(e)) continue;
      const d2 = (e.x - target.x) ** 2 + (e.z - target.z) ** 2;
      if (d2 < best) {
        best = d2;
        next = e;
      }
    }
    target = next;
  }
  FX.bolt(pts, s.color, 0.24, 1);
  hero.castGlow = 1;
  Sound.play(s.sfx, 0.45);
  R.shake(0.06);
  return true;
}

// Огненная волна: конус в сторону ближайшего врага.
function castCone(s, hero) {
  const target = Game.nearestEnemy(hero.x, hero.z, s.range + 0.5);
  if (!target) return false;
  const a = Math.atan2(target.z - hero.z, target.x - hero.x);
  const half = (s.angle * Math.PI) / 360;
  for (const e of Game.enemies) {
    if (e.dead) continue;
    const dx = e.x - hero.x;
    const dz = e.z - hero.z;
    const d = Math.hypot(dx, dz);
    if (d > s.range + e.r) continue;
    let da = Math.atan2(dz, dx) - a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < half + 0.15) {
      Game.damage(e, s.dmg, s.color);
      e.knock(dx, dz, 5);
    }
  }
  FX.cone(hero.x, hero.z, a, half, s.range, s.color);
  for (let i = 0; i < 34; i++) {
    const pa = a + (Math.random() * 2 - 1) * half;
    const sp = 6 + Math.random() * 9;
    FX.spawn({ x: hero.x, z: hero.z, h: 0.7, vx: Math.cos(pa) * sp, vz: Math.sin(pa) * sp, vh: Math.random() * 2,
      drag: 2.2, life: 0.45 + Math.random() * 0.25, size: 0.9, size2: 1.5, color: Math.random() < 0.5 ? "#ff5a1f" : "#ffb02e" });
  }
  hero.castGlow = 1;
  Sound.play(s.sfx, 0.35);
  R.shake(0.1);
  return true;
}

// Нова: вокруг героя (self) или по врагу (target).
function castNova(s, hero) {
  let cx = hero.x;
  let cz = hero.z;
  if (s.origin === "target") {
    const t = Game.densestEnemy(hero.x, hero.z, 9);
    if (!t) return false;
    cx = t.x;
    cz = t.z;
  } else if (!Game.nearestEnemy(hero.x, hero.z, s.radius)) {
    return false;
  }
  for (const e of Game.enemies) {
    if (e.dead) continue;
    const dx = e.x - cx;
    const dz = e.z - cz;
    if (dx * dx + dz * dz < (s.radius + e.r) ** 2) {
      Game.damage(e, s.dmg, s.color);
      if (s.slow) e.slow(s.slow, 2.2);
      e.knock(dx, dz, s.origin === "self" ? 6 : 3);
    }
  }
  FX.ring(cx, cz, 0.3, s.radius, 0.45, s.color, 0.4, 0.35);
  const n = s.origin === "self" ? 36 : 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
    const sp = s.radius * (2.2 + Math.random() * 1.2);
    FX.spawn({ x: cx, z: cz, h: 0.4, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vh: 1 + Math.random() * 2, drag: 3.2,
      life: 0.5 + Math.random() * 0.3, size: 0.8, size2: 0.3, color: Math.random() < 0.3 ? "#ffffff" : s.color });
  }
  if (s.origin === "target") {
    FX.burst(cx, cz, 0.8, s.color, 14, 4, 0.5, 1.4);
    R.shake(0.16);
  } else {
    R.shake(0.12);
  }
  hero.castGlow = 1;
  Sound.play(s.sfx, 0.45);
  return true;
}

function castZone(s, hero) {
  const t = Game.densestEnemy(hero.x, hero.z, 9);
  if (!t) return false;
  Game.zones.push(new Zone(s, t.x, t.z));
  hero.castGlow = 1;
  Sound.play(s.sfx, 0.4);
  return true;
}

// Зона на земле (метель): бьёт тиками и замедляет.
class Zone {
  constructor(s, x, z) {
    this.s = s;
    this.x = x;
    this.z = z;
    this.t = 0;
    this.tick = 0;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.s.duration) {
      this.dead = true;
      return;
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = this.s.tick;
      for (const e of Game.enemies) {
        if (e.dead) continue;
        if ((e.x - this.x) ** 2 + (e.z - this.z) ** 2 < (this.s.radius + e.r) ** 2) {
          Game.damage(e, this.s.dmg, this.s.color);
          e.slow(this.s.slow, 0.8);
        }
      }
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.s.radius;
      FX.spawn({ x: this.x + Math.cos(a) * r, z: this.z + Math.sin(a) * r, h: 2.2 + Math.random(), vx: 2.5, vh: -4,
        drag: 0, life: 0.55, size: 0.3, color: "#e6f7ff" });
    }
  }

  draw() {
    const k = Math.min(1, this.t / 0.25) * Math.min(1, (this.s.duration - this.t) / 0.4);
    const c = R.ctx;
    c.save();
    c.translate(R.sx(this.x), R.sy(this.z));
    c.scale(1, R.SY);
    const rad = this.s.radius * R.U;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, hexA(this.s.color, 0.12 * k));
    g.addColorStop(0.8, hexA(this.s.color, 0.3 * k));
    g.addColorStop(1, hexA(this.s.color, 0));
    c.globalCompositeOperation = "lighter";
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rad, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = hexA("#ffffff", 0.5 * k);
    c.lineWidth = 2 / R.SY;
    c.setLineDash([10, 8]);
    c.lineDashOffset = -this.t * 40;
    c.beginPath();
    c.arc(0, 0, rad * 0.96, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
}
