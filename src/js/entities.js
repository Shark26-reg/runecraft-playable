"use strict";
// Герой, враги, босс, снаряды и руны на земле.

// Направление движения -> одно из 8 направлений спрайта (0 — к зрителю, 2 — вправо, 4 — от зрителя, 6 — влево).
function dir8(dx, dz) {
  const a = Math.atan2(dx, dz);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

class Hero {
  constructor() {
    this.x = 0;
    this.z = 0;
    this.r = HERO_DEF.radius;
    this.hp = this.maxHp = HERO_DEF.hp;
    this.dir = 0;
    this.anim = "idle";
    this.animT = 0;
    this.atkT = 0.6;
    this.hurt = 0;
    this.dead = false;
    this.deathT = 0;
    this.cheer = false;
    this.spells = [];
    this.castGlow = 0;
    this.invuln = 0;
    this.regenT = 0;
  }

  setAnim(a) {
    if (this.anim !== a) {
      this.anim = a;
      this.animT = 0;
    }
  }

  update(dt, mx, mz) {
    this.animT += dt;
    this.hurt = Math.max(0, this.hurt - dt * 4);
    this.castGlow = Math.max(0, this.castGlow - dt * 5);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.dead) {
      this.deathT += dt;
      return;
    }
    if (this.cheer) return;
    const len = Math.hypot(mx, mz);
    if (len > 0.12) {
      const k = Math.min(1, len) / len;
      this.x += mx * k * HERO_DEF.speed * dt;
      this.z += mz * k * HERO_DEF.speed * dt;
      this.dir = dir8(mx, mz);
      this.setAnim("run");
    } else {
      this.setAnim("idle");
    }
    World.resolve(this, this.r);
    World.clampArena(this, this.r);
    // Лёгкая регенерация: плейбл должен прощать ошибки, игрок только знакомится с игрой.
    this.regenT += dt;
    if (this.regenT > 1) {
      this.regenT = 0;
      this.hp = Math.min(this.maxHp, this.hp + 2);
    }
    this.atkT -= dt;
    if (this.atkT <= 0) {
      const t = Game.nearestEnemy(this.x, this.z, HERO_DEF.attack.range);
      if (t) {
        this.atkT = HERO_DEF.attack.cd;
        if (this.anim === "idle") this.dir = dir8(t.x - this.x, t.z - this.z);
        Game.projectiles.push(new Bolt(this, t));
        this.castGlow = 1;
        Sound.play(Math.random() < 0.5 ? "shoot" : "shoot2", 0.35);
      } else {
        this.atkT = 0.1;
      }
    }
    for (const s of this.spells) s.update(dt, this);
  }

  damage(amount) {
    if (this.dead || this.invuln > 0 || Game.stage === "won") return;
    this.hp -= amount;
    this.hurt = 1;
    this.invuln = 0.12;
    FX.number(this.x, this.z, 1.9, amount, "#ff6b6b");
    Sound.play("hurt", 0.5);
    R.shake(0.18);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathT = 0;
      Game.onHeroDeath();
    }
  }

  // Точка на навершии посоха — откуда летят снаряды и молнии.
  staff() {
    return [this.x + 0.25, this.z, 1.5];
  }

  draw() {
    const anim = this.dead ? "death" : this.cheer ? "cheer" : this.anim;
    const t = this.dead ? this.deathT : this.animT;
    R.drawChar("hero", anim, this.dir, t, this.x, this.z, { red: this.hurt * 0.7 });
    if (this.castGlow > 0 && !this.dead) {
      const s = this.staff();
      R.ctx.globalCompositeOperation = "lighter";
      R.drawGlow("#c9a2ff", R.sx(s[0]), R.sy(s[1], s[2]), R.U * 1.4 * this.castGlow, 0.9);
      R.ctx.globalCompositeOperation = "source-over";
      R.ctx.globalAlpha = 1;
    }
  }

  drawBar() {
    if (this.dead || this.cheer) return;
    const w = R.U * 1.25;
    const h = Math.max(4, R.U * 0.13);
    const x = R.sx(this.x) - w / 2;
    const y = R.sy(this.z, 2.75);
    const c = R.ctx;
    c.fillStyle = "rgba(13,10,26,0.85)";
    c.fillRect(x - 1, y - 1, w + 2, h + 2);
    const k = this.hp / this.maxHp;
    c.fillStyle = k > 0.35 ? "#4ade80" : "#f05252";
    c.fillRect(x, y, w * k, h);
  }
}

class Enemy {
  constructor(type, x, z, opts = {}) {
    const def = ENEMY_DEFS[type];
    this.type = type;
    this.def = def;
    this.sprite = def.sprite;
    this.x = x;
    this.z = z;
    this.r = def.radius;
    this.hp = this.maxHp = def.hp * (opts.hpMul || 1);
    this.speed = def.speed * (0.88 + Math.random() * 0.24);
    this.dir = 0;
    this.state = "run";
    this.animT = Math.random();
    this.atkT = 0;
    this.cool = 0.4;
    this.hit = false;
    this.flash = 0;
    this.slowT = 0;
    this.slowK = 0;
    this.dead = false;
    this.deathT = 0;
    this.flip = Math.random() < 0.5;
    this.kx = 0;
    this.kz = 0;
    this.age = 0;
  }

  get alive() {
    return !this.dead;
  }

  slow(k, time) {
    this.slowK = Math.max(this.slowK, k);
    this.slowT = Math.max(this.slowT, time);
  }

  knock(dx, dz, power) {
    const d = Math.hypot(dx, dz) || 1;
    this.kx += (dx / d) * power;
    this.kz += (dz / d) * power;
  }

  update(dt, hero) {
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.dead) {
      this.deathT += dt;
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slowK = 0;
    }
    const sm = 1 - this.slowK;
    this.animT += dt * sm;
    const dx = hero.x - this.x;
    const dz = hero.z - this.z;
    const d = Math.hypot(dx, dz) || 0.001;
    if (this.state === "attack") {
      this.atkT += dt * sm;
      if (!this.hit && this.atkT >= this.def.windup) {
        this.hit = true;
        if (d < this.def.reach + 0.35 && !hero.dead) hero.damage(this.def.dmg);
      }
      if (this.atkT >= Assets.sprites.characters[this.sprite].anims.attack.len) {
        this.state = "run";
        this.cool = this.def.atkCd;
      }
    } else {
      this.cool -= dt;
      if (d < this.def.reach && this.cool <= 0 && !hero.dead && Game.stage !== "won") {
        this.state = "attack";
        this.atkT = 0;
        this.hit = false;
        this.dir = dir8(dx, dz);
      } else if (d > this.def.reach * 0.8) {
        const v = this.speed * sm;
        this.x += (dx / d) * v * dt;
        this.z += (dz / d) * v * dt;
        this.dir = dir8(dx, dz);
      }
    }
    if (this.kx || this.kz) {
      this.x += this.kx * dt;
      this.z += this.kz * dt;
      const k = Math.exp(-9 * dt);
      this.kx *= k;
      this.kz *= k;
      if (Math.abs(this.kx) + Math.abs(this.kz) < 0.05) this.kx = this.kz = 0;
    }
    World.resolve(this, this.r);
  }

  get removable() {
    return this.dead && this.deathT > 1.6;
  }

  draw() {
    let anim = "run";
    let t = this.animT * (this.speed / this.def.speed);
    if (this.dead) {
      anim = "death";
      t = this.deathT;
    } else if (this.state === "attack") {
      anim = "attack";
      t = this.atkT;
    }
    const alpha = this.dead ? Math.max(0, 1 - Math.max(0, this.deathT - 1.1) / 0.5) : Math.min(1, this.age / 0.3);
    R.drawChar(this.sprite, anim, this.dir, t, this.x, this.z, {
      flip: this.flip, white: this.flash, ice: this.slowT > 0 ? 0.42 : 0, alpha,
    });
  }
}

class Boss extends Enemy {
  constructor(x, z) {
    super("boss", x, z);
    this.speed = this.def.speed;
    this.slamCd = 2.4;
    this.summoned = false;
    this.taunt = 0;
    this.entered = false;
    this.mark = null;
    this.slamX = 0;
    this.slamZ = 0;
  }

  update(dt, hero) {
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.animT += dt;
    if (this.dead) {
      this.deathT += dt;
      return;
    }
    const dx = hero.x - this.x;
    const dz = hero.z - this.z;
    const d = Math.hypot(dx, dz) || 0.001;
    if (this.taunt > 0) {
      this.taunt -= dt;
      return;
    }
    if (!this.entered && Math.hypot(this.x, this.z) < ARENA_RADIUS - 1.5) {
      // Вышел из леса на арену — рык и дрожь земли.
      this.entered = true;
      this.taunt = 1.05;
      this.animT = 0;
      Sound.play("boom_big", 0.7);
      R.shake(0.45);
      FX.ring(this.x, this.z, 0.5, 5, 0.6, "#b06bff", 0.4, 0.3);
      return;
    }
    if (!this.summoned && this.hp < this.maxHp * 0.55) {
      this.summoned = true;
      this.taunt = 1.05;
      this.animT = 0;
      Game.summonAround(this.x, this.z, 8);
      return;
    }
    if (this.state === "attack") {
      this.atkT += dt;
      if (!this.hit && this.atkT >= this.def.windup) {
        this.hit = true;
        Sound.play("boom_big", 0.8);
        R.shake(0.5);
        FX.ring(this.slamX, this.slamZ, 0.3, 3.4, 0.5, "#c084fc", 0.55, 0.45);
        FX.burst(this.slamX, this.slamZ, 0.3, "#b06bff", 26, 7, 0.7, 0.7);
        FX.screenFlash("#b06bff", 0.18);
        if (Math.hypot(hero.x - this.slamX, hero.z - this.slamZ) < 2.9) hero.damage(this.def.dmg);
      }
      if (this.atkT >= 1.3) {
        this.state = "run";
        this.slamCd = 2.3;
        this.animT = 0;
      }
      return;
    }
    this.slamCd -= dt;
    if (this.slamCd <= 0 && d < 8 && !hero.dead && Game.stage !== "won") {
      this.state = "attack";
      this.atkT = 0;
      this.hit = false;
      this.slamX = hero.x;
      this.slamZ = hero.z;
      this.dir = dir8(dx, dz);
      this.mark = FX.mark(this.slamX, this.slamZ, 2.9, this.def.windup, "#ff3b5c");
      return;
    }
    if (d > 2.2) {
      this.x += (dx / d) * this.speed * dt;
      this.z += (dz / d) * this.speed * dt;
      this.dir = dir8(dx, dz);
    }
    World.resolve(this, this.r);
  }

  // Тело короля рассыпается не сразу: сначала доигрывает анимация падения.
  get removable() {
    return this.dead && this.deathT > 3;
  }

  draw() {
    let anim = "walk";
    let t = this.animT;
    if (this.dead) {
      anim = "death";
      t = this.deathT;
    } else if (this.taunt > 0) {
      anim = "taunt";
    } else if (this.state === "attack") {
      anim = "attack";
      t = this.atkT;
    }
    // Аура босса — фиолетовое свечение под ногами, как светящийся контур в игре.
    if (!this.dead) {
      R.ctx.globalCompositeOperation = "lighter";
      R.drawGlow("#8b3dff", R.sx(this.x), R.sy(this.z, 0.2), R.U * 4.2, 0.35 + 0.1 * Math.sin(R.time * 4));
      R.ctx.globalCompositeOperation = "source-over";
      R.ctx.globalAlpha = 1;
    }
    const alpha = this.dead ? Math.max(0, 1 - Math.max(0, this.deathT - 2.2) / 0.8) : 1;
    // По боссу бьют постоянно — вспышка слабая, иначе он всё время белый.
    R.drawChar("boss", anim, this.dir, t, this.x, this.z, { white: this.flash * 0.3, alpha });
  }
}

// Арканный снаряд мага: летит в цель и слегка доворачивает, чтобы не промахнуться по бегущему врагу.
class Bolt {
  constructor(hero, target) {
    const s = hero.staff();
    this.x = s[0];
    this.z = s[1];
    this.h = 1.2;
    this.target = target;
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vx = (dx / d) * HERO_DEF.attack.speed;
    this.vz = (dz / d) * HERO_DEF.attack.speed;
    this.life = 0.9;
    this.dead = false;
    this.trail = [];
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    const t = this.target;
    if (t && t.alive) {
      const dx = t.x - this.x;
      const dz = t.z - this.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = HERO_DEF.attack.speed;
      const k = Math.min(1, dt * 10);
      this.vx += ((dx / d) * sp - this.vx) * k;
      this.vz += ((dz / d) * sp - this.vz) * k;
    }
    this.trail.push([this.x, this.z]);
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.h += (0.9 - this.h) * dt * 4;
    for (const e of Game.enemies) {
      if (e.dead) continue;
      const rr = e.r + 0.3;
      if ((e.x - this.x) ** 2 + (e.z - this.z) ** 2 < rr * rr) {
        Game.damage(e, HERO_DEF.attack.dmg, "#e9d5ff");
        e.knock(this.vx, this.vz, 2.2);
        FX.burst(this.x, this.z, this.h, HERO_DEF.attack.color, 6, 3, 0.35, 0.45);
        Sound.play(Math.random() < 0.5 ? "hit" : "hit2", 0.3);
        this.dead = true;
        return;
      }
    }
  }

  draw() {
    const col = HERO_DEF.attack.color;
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const k = (i + 1) / (this.trail.length + 1);
      R.drawGlow(col, R.sx(p[0]), R.sy(p[1], this.h), R.U * 0.7 * k, 0.5 * k);
    }
    R.drawGlow(col, R.sx(this.x), R.sy(this.z, this.h), R.U * 1.1, 1);
  }
}

// Руна на земле: подпрыгивает при выпадении, светится и сама летит к герою.
class RunePickup {
  constructor(rune, x, z) {
    this.rune = rune;
    this.x = x;
    this.z = z;
    this.h = 0.4;
    this.vh = 6;
    this.t = 0;
    this.dead = false;
    this.speed = 0;
  }

  update(dt, hero) {
    this.t += dt;
    if (this.vh !== 0 || this.h > 0.6) {
      this.vh -= 20 * dt;
      this.h += this.vh * dt;
      if (this.h <= 0.6 && this.vh < 0) {
        this.h = 0.6;
        this.vh = 0;
      }
    }
    const dx = hero.x - this.x;
    const dz = hero.z - this.z;
    const d = Math.hypot(dx, dz);
    if (!hero.dead && (d < 2.8 || this.t > 2.2)) {
      this.speed = Math.min(16, this.speed + dt * 30);
      this.x += (dx / (d || 1)) * this.speed * dt;
      this.z += (dz / (d || 1)) * this.speed * dt;
      if (d < 0.55) {
        this.dead = true;
        Game.collectRune(this.rune, this.x, this.z);
      }
    }
    if (Math.random() < dt * 8) {
      FX.spawn({ x: this.x + (Math.random() - 0.5) * 0.6, z: this.z, h: this.h + Math.random() * 0.6, vh: 1.2,
        life: 0.6, size: 0.35, color: RUNES[this.rune].color });
    }
  }

  draw() {
    const bob = Math.sin(this.t * 4) * 0.12;
    const px = R.sx(this.x);
    const py = R.sy(this.z, this.h + bob);
    const col = RUNES[this.rune].color;
    const c = R.ctx;
    c.globalCompositeOperation = "lighter";
    R.drawGlow(col, px, py, R.U * (2 + 0.3 * Math.sin(this.t * 6)), 0.75);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    const size = R.U * 0.95;
    c.drawImage(R.gem(this.rune, size), px - size / 2, py - size / 2, size, size);
  }
}
