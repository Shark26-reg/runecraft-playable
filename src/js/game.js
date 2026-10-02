"use strict";
// Сценарий плейбла (~40 с): волна скелетов → крафт «Цепной молнии» → орда → крафт двух заклинаний из 4 рун
// → Костяной король → финальный экран с кнопкой магазина.

const DIRS = { n: -Math.PI / 2, s: Math.PI / 2, e: 0, w: Math.PI };
// [время от начала этапа, тип, сколько, откуда (n/s/e/w/ring/rand), расстояние от героя]
const WAVE_1 = [[0.2, "minion", 3, "n", 7], [1.6, "minion", 3, "e", 7.5], [3.0, "minion", 3, "w", 7.5],
  [4.4, "minion", 4, "s", 7], [6.2, "minion", 5, "ring", 8], [8.4, "minion", 4, "rand", 7.5]];
const WAVE_2 = [[0.4, "minion", 10, "ring", 8], [2.2, "rogue", 5, "e", 8], [3.6, "minion", 12, "ring", 9],
  [5.4, "rogue", 6, "w", 8], [5.6, "minion", 4, "n", 8], [7.4, "minion", 14, "ring", 9], [9.6, "rogue", 8, "rand", 8]];

const STAGES = {
  w1: { plan: WAVE_1, trickle: 0.8, xp: 10, drops: { 2: "arrow", 6: "lightning" }, runes: 2 },
  w2: { plan: WAVE_2, trickle: 0.45, xp: 32, drops: { 3: "fire", 8: "wind", 13: "ice", 18: "arcane" }, runes: 4 },
  boss: { plan: [], trickle: 1.3, xp: 0, drops: {}, runes: 0 },
};

const Game = {
  state: "play",     // play | craft | end
  stage: "w1",       // w1 | w2 | boss | won | lost
  hero: null,
  boss: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  zones: [],
  pending: [],
  runes: [],
  time: 0,
  stageT: 0,
  kills: 0,
  stageKills: 0,
  planIdx: 0,
  trickleT: 0,
  timeScale: 1,
  slowmoT: 0,
  endT: -1,
  victory: false,
  moved: false,
  idleT: 0,
  paused: false,
  runs: 0,

  start() {
    FX.reset();
    World.generate(Number(CONFIG.debug.seed) || 7);
    this.hero = new Hero();
    this.boss = null;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.zones = [];
    this.pending = [];
    this.runes = [];
    this.bossSpawn = null;
    this.cheerT = 0;
    R.focusX = 0.5;
    R.focusY = 0.54;
    R.zoom = 1;
    R.U = R.baseU;
    this.time = 0;
    this.kills = 0;
    this.timeScale = 1;
    this.slowmoT = 0;
    this.endT = -1;
    this.moved = false;
    this.idleT = 0;
    this.state = "play";
    R.camX = 0;
    R.camZ = 0;
    UI.reset();
    UI.setKills(0);
    UI.hint(true, T("move_hint"));
    Sound.duckMusic(0.32);
    // Отладочный этап (?stage=) — только при первом запуске, «Сыграть ещё раз» всегда начинает сначала.
    const st = this.runs++ === 0 ? CONFIG.debug.stage : undefined;
    if (st === "w2" || st === "boss" || st === "end") this.addSpell("lightning_bolt");
    if (st === "boss" || st === "end") {
      this.addSpell("frost_nova");
      this.addSpell("arcane_flame");
    }
    this.enterStage(st === "w2" || st === "boss" ? st : "w1");
    if (st === "end") {
      this.stage = "won";
      this.hero.cheer = true;
      this.kills = 87;
      this.showEnd(true);
    }
  },

  enterStage(st) {
    this.stage = st;
    this.stageT = 0;
    this.stageKills = 0;
    this.planIdx = 0;
    this.trickleT = 0;
    const cfg = STAGES[st];
    this.plan = cfg;
    if (st === "w1") {
      UI.setWave(T("wave", { n: 1 }));
      UI.banner(T("wave", { n: 1 }), T("wave_sub_1"));
    } else if (st === "w2") {
      UI.setWave(T("wave", { n: 2 }));
      UI.banner(T("wave", { n: 2 }), T("wave_sub_2"), "#ff5a1f");
      Sound.play("wave", 0.6);
    } else if (st === "boss") {
      UI.setWave(T("boss_stage"));
      UI.banner(T("boss_warn"), T("boss_name"), "#b06bff");
      Sound.play("bell", 0.7);
      R.shake(0.3);
      // Босс встаёт из большого рунного круга в 7–8 единицах от героя, ближе к центру арены.
      const h = this.hero;
      const a = Math.hypot(h.x, h.z) > 2 ? Math.atan2(-h.z, -h.x) : Math.random() * Math.PI * 2;
      const p = { x: h.x + Math.cos(a) * 7.5, z: h.z + Math.sin(a) * 7.5 };
      World.clampArena(p, 2);
      World.resolve(p, 1.4);
      this.bossSpawn = { x: p.x, z: p.z, t: 1.1 };
      FX.mark(p.x, p.z, 2.4, 1.1, "#8b3dff");
      FX.ring(p.x, p.z, 3.2, 0.6, 1.1, "#b06bff", 0.3, 0.3);
    }
  },

  // ——— Появление врагов ———

  spawnPoint(angle, dist) {
    const h = this.hero;
    for (let i = 0; i < 2; i++) {
      let x = h.x + Math.cos(angle) * dist;
      let z = h.z + Math.sin(angle) * dist;
      const r = Math.hypot(x, z);
      const max = ARENA_RADIUS - 0.8;
      if (r > max) {
        x *= max / r;
        z *= max / r;
      }
      const o = { x, z };
      World.resolve(o, 0.7);
      if (Math.hypot(o.x - h.x, o.z - h.z) > 4.5 || i === 1) return o;
      angle += Math.PI;
    }
    return { x: 0, z: 0 };
  },

  spawnGroup(type, n, where, dist) {
    const base = where === "rand" ? Math.random() * Math.PI * 2 : DIRS[where] || 0;
    for (let i = 0; i < n; i++) {
      const a = where === "ring" ? base + (i / n) * Math.PI * 2 : base + (i - (n - 1) / 2) * 0.22 + (Math.random() - 0.5) * 0.1;
      const p = this.spawnPoint(a, dist + Math.random() * 1.2);
      this.queueSpawn(type, p.x, p.z, i * 0.05);
    }
  },

  // Враг появляется из рунного круга на земле, как в игре.
  queueSpawn(type, x, z, delay = 0) {
    this.pending.push({ type, x, z, t: 0.45 + delay, fx: false });
  },

  summonAround(x, z, n) {
    Sound.play("bell", 0.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const o = { x: x + Math.cos(a) * 2.8, z: z + Math.sin(a) * 2.8 };
      World.clampArena(o, 0.5);
      this.queueSpawn("minion", o.x, o.z, i * 0.04);
    }
  },

  aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead) n++;
    return n;
  },

  // ——— Поиск целей ———

  nearestEnemy(x, z, range) {
    let best = null;
    let bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.age < 0.2) continue;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  },

  // Враг, рядом с которым больше всего других, — для взрывов по площади.
  densestEnemy(x, z, range) {
    let best = null;
    let score = -1;
    for (const e of this.enemies) {
      if (e.dead || e.age < 0.2) continue;
      if ((e.x - x) ** 2 + (e.z - z) ** 2 > range * range) continue;
      let n = e === this.boss ? 3 : 0;
      for (const o of this.enemies) if (!o.dead && (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < 6.25) n++;
      if (n > score) {
        score = n;
        best = e;
      }
    }
    return best;
  },

  // ——— Урон и награды ———

  damage(e, amount, color) {
    if (e.dead) return;
    const v = Math.round(amount * (0.9 + Math.random() * 0.2));
    e.hp -= v;
    e.flash = 1;
    FX.number(e.x, e.z, e === this.boss ? 3.6 : 1.7, v, color || "#ffffff", e === this.boss);
    if (e.hp <= 0) this.kill(e);
  },

  kill(e) {
    e.dead = true;
    e.deathT = 0;
    if (e === this.boss) {
      this.onBossDeath();
      return;
    }
    this.kills++;
    this.stageKills++;
    UI.setKills(this.kills);
    FX.bones(e.x, e.z);
    FX.burst(e.x, e.z, 0.8, "#c9a2ff", 4, 2.5, 0.4, 0.5);
    Sound.play(Math.random() < 0.5 ? "bones" : "bones2", 0.4);
    const rune = this.plan && this.plan.drops[this.stageKills];
    if (rune && (this.stage === "w1" || this.stage === "w2")) this.pickups.push(new RunePickup(rune, e.x, e.z));
  },

  collectRune(rune, x, z) {
    this.runes.push(rune);
    FX.burst(x, z, 1, RUNES[rune].color, 18, 5, 0.6, 0.7);
    FX.ring(this.hero.x, this.hero.z, 0.3, 1.8, 0.4, RUNES[rune].color, 0.25, 0.2);
    Sound.play("pickup", 0.7);
    UI.spellPop(RUNES[rune].glyph + " " + T("rune_" + rune), RUNES[rune].color);
  },

  addSpell(id) {
    this.hero.spells.push(new SpellSlot(id));
    UI.addSpell(id);
  },

  openCraft() {
    this.state = "craft";
    Input.release();
    UI.hint(false);
    Sound.duckMusic(0.14);
    const first = this.stage === "w1";
    Craft.open(this.runes.slice(), first ? 1 : 2, first ? "craft_sub" : "craft_sub2", () => {
      this.runes = [];
      this.state = "play";
      Sound.duckMusic(0.32);
      this.enterStage(first ? "w2" : "boss");
    });
  },

  onBossDeath() {
    this.stage = "won";
    this.victory = true;
    UI.bossBar(false);
    this.timeScale = 0.3;
    this.slowmoT = 1.1;
    const b = this.boss;
    R.shake(0.9);
    FX.screenFlash("#f5c451", 0.5);
    FX.ring(b.x, b.z, 0.5, 7, 0.9, "#f5c451", 0.6, 0.4);
    FX.ring(b.x, b.z, 0.3, 4.5, 0.7, "#b06bff", 0.5, 0.3);
    FX.burst(b.x, b.z, 1.5, "#f5c451", 50, 9, 1.1, 1.0);
    FX.burst(b.x, b.z, 1.5, "#b06bff", 30, 6, 1.0, 1.2);
    Sound.play("boom_big", 1);
    // Без короля армия рассыпается: остальные скелеты падают волной.
    for (const e of this.enemies) {
      if (!e.dead && e !== b) e.dieIn = 0.15 + Math.hypot(e.x - b.x, e.z - b.z) * 0.06;
    }
    setTimeout(() => Sound.play("win", 0.8), 500);
    this.cheerT = 0.9;
    this.endT = 2.6;
  },

  onHeroDeath() {
    if (this.stage === "won") return;
    this.stage = "lost";
    this.victory = false;
    Sound.play("lose", 0.8);
    Sound.duckMusic(0.12);
    UI.bossBar(false);
    this.endT = 1.8;
  },

  showEnd(victory) {
    this.state = "end";
    this.endT = -1;
    const t = Math.round(this.time);
    UI.showEnd(victory, { kills: this.kills, spells: this.hero.spells.length, time: Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0") });
    Ad.gameEnd();
  },

  // Праздник на финальном экране: золотые искры и рунный круг под героем.
  celebrate(dt) {
    const h = this.hero;
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      FX.spawn({ x: h.x + Math.cos(a) * 1.2, z: h.z + Math.sin(a) * 1.2, h: 0.2, vx: Math.cos(a) * 0.8, vz: Math.sin(a) * 0.8,
        vh: 3 + Math.random() * 3, grav: -2, life: 1.1, size: 0.45, color: Math.random() < 0.7 ? "#f5c451" : "#c9a2ff" });
    }
    this.ringT = (this.ringT || 0) - dt;
    if (this.ringT <= 0) {
      this.ringT = 1.3;
      FX.ring(h.x, h.z, 0.4, 2.2, 1.2, "#f5c451", 0.18, 0.2);
    }
  },

  // ——— Кадр ———

  update(rawDt) {
    if (this.paused) return;
    R.update(rawDt);
    if (this.state === "craft") {
      Craft.update(rawDt);
      return;
    }
    if (this.slowmoT > 0) {
      this.slowmoT -= rawDt;
      if (this.slowmoT <= 0) this.timeScale = 1;
    }
    const dt = rawDt * this.timeScale;
    const h = this.hero;
    this.time += dt;
    this.stageT += dt;

    let mx = 0;
    let mz = 0;
    if (this.state === "play" && !h.dead && this.stage !== "won") {
      const v = CONFIG.debug.bot ? Bot.vector() : Input.vector();
      mx = v[0];
      mz = v[1];
    }
    if (Math.hypot(mx, mz) > 0.2) {
      this.idleT = 0;
      if (!this.moved) {
        this.moved = true;
        UI.hint(false);
      }
    } else if (this.state === "play" && this.stage !== "won" && this.stage !== "lost") {
      // Игрок давно не трогает экран — снова показываем, как управлять.
      this.idleT += rawDt;
      if (this.idleT > 4 && this.moved) {
        this.moved = false;
        UI.hint(true, T("move_hint"));
      }
    }
    h.update(dt, mx, mz);
    if (this.cheerT > 0) {
      this.cheerT -= rawDt;
      if (this.cheerT <= 0 && !h.dead) {
        h.cheer = true;
        h.animT = 0;
        h.dir = 0;
      }
    }

    this.updateSpawns(dt);

    for (const e of this.enemies) {
      if (e.dieIn !== undefined && !e.dead) {
        e.dieIn -= dt;
        if (e.dieIn <= 0) this.kill(e);
      }
      if (!h.dead || e.dead) e.update(dt, h);
    }
    this.separate();
    this.enemies = this.enemies.filter((e) => !e.removable);
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const z of this.zones) z.update(dt);
    this.zones = this.zones.filter((z) => !z.dead);
    for (const p of this.pickups) p.update(dt, h);
    this.pickups = this.pickups.filter((p) => !p.dead);
    FX.update(dt);

    // Камера мягко догоняет героя, но не уезжает в лес: в кадре должна оставаться арена.
    // На финальном экране герой поднимается в верхнюю часть кадра, над логотипом и кнопкой.
    const ending = this.state === "end";
    const wide = R.W > R.H * 1.15;
    const fk = Math.min(1, rawDt * 3);
    R.focusX += ((ending && wide ? 0.27 : 0.5) - R.focusX) * fk;
    R.focusY += ((ending ? (wide ? 0.62 : 0.3) : 0.54) - R.focusY) * fk;
    R.zoom += ((ending ? 1.35 : 1) - R.zoom) * Math.min(1, rawDt * 3);
    R.U = R.baseU * R.zoom;
    if (ending && this.victory) this.celebrate(rawDt);
    const k = Math.min(1, rawDt * 5);
    let tx = h.x;
    let tz = h.z;
    const tr = Math.hypot(tx, tz);
    if (tr > 7) {
      tx *= 7 / tr;
      tz *= 7 / tr;
    }
    R.camX += (tx - R.camX) * k;
    R.camZ += (tz - R.camZ) * k;

    this.updateProgress();
    UI.updateSpells(h.spells);

    if (this.endT >= 0) {
      this.endT -= rawDt;
      if (this.endT < 0) this.showEnd(this.victory);
    } else if (this.state === "play" && this.time > CONFIG.maxDuration && this.stage !== "won" && this.stage !== "lost") {
      this.stage = "lost";
      this.showEnd(false);
    }
  },

  updateSpawns(dt) {
    const bs = this.bossSpawn;
    if (bs) {
      bs.t -= dt;
      if (Math.random() < dt * 30) FX.spawn({ x: bs.x + (Math.random() - 0.5) * 3, z: bs.z + (Math.random() - 0.5) * 2,
        h: 0.1, vh: 3 + Math.random() * 3, life: 0.7, size: 0.7, color: "#b06bff" });
      if (bs.t <= 0) {
        this.bossSpawn = null;
        this.boss = new Boss(bs.x, bs.z);
        this.enemies.push(this.boss);
        FX.burst(bs.x, bs.z, 0.5, "#b06bff", 40, 8, 0.8, 1);
        FX.screenFlash("#8b3dff", 0.25);
        UI.bossBar(true, 1);
      }
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (!p.fx && p.t < 0.45) {
        p.fx = true;
        FX.ring(p.x, p.z, 1.1, 0.25, 0.45, "#9b6bff", 0.12, 0.45);
      }
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        if (this.stage === "won" || this.stage === "lost") continue;
        this.enemies.push(new Enemy(p.type, p.x, p.z));
        FX.burst(p.x, p.z, 0.3, "#9b6bff", 6, 2.5, 0.45, 0.6);
      }
    }
    if (this.stage !== "w1" && this.stage !== "w2" && this.stage !== "boss") return;
    const plan = this.plan.plan;
    while (this.planIdx < plan.length && this.stageT >= plan[this.planIdx][0]) {
      const w = plan[this.planIdx++];
      this.spawnGroup(w[1], w[2], w[3], w[4]);
    }
    // После расписания — ручеёк врагов, чтобы на экране не было пусто.
    if (this.planIdx >= plan.length) {
      this.trickleT -= dt;
      const cap = this.stage === "boss" ? 16 : 34;
      if (this.trickleT <= 0 && this.aliveCount() + this.pending.length < cap) {
        this.trickleT = this.plan.trickle;
        const type = this.stage === "w2" && Math.random() < 0.3 ? "rogue" : "minion";
        this.spawnGroup(type, 1, "rand", 7.5);
      }
    }
  },

  // Враги не слипаются в одну точку и не залезают в героя.
  separate() {
    const list = this.enemies;
    const n = list.length;
    const h = this.hero;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) / d;
          const wa = a === this.boss ? 0 : b === this.boss ? 1 : 0.5;
          a.x -= dx * push * wa;
          a.z -= dz * push * wa;
          b.x += dx * push * (1 - wa);
          b.z += dz * push * (1 - wa);
        }
      }
      if (!h.dead) {
        const dx = a.x - h.x;
        const dz = a.z - h.z;
        const min = a.r + h.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          a.x += (dx / d) * (min - d);
          a.z += (dz / d) * (min - d);
        }
      }
    }
  },

  updateProgress() {
    if (this.stage === "boss" && this.boss) {
      UI.bossBar(true, this.boss.hp / this.boss.maxHp);
      UI.setXp(1 - this.boss.hp / this.boss.maxHp, T("xp_boss"));
      return;
    }
    if (this.stage !== "w1" && this.stage !== "w2") return;
    const need = this.plan.xp;
    const done = this.stageKills >= need;
    const haveRunes = this.runes.length >= this.plan.runes;
    UI.setXp(this.stageKills / need, done && !haveRunes ? T("xp_rune") : T("xp_label"));
    if (done && haveRunes && this.pickups.length === 0 && this.state === "play" && !this.hero.dead) this.openCraft();
  },

  draw() {
    R.begin();
    const c = R.ctx;
    World.drawGround();
    World.drawRing();
    World.drawFlats();
    for (const z of this.zones) z.draw();
    FX.drawGround();
    const h = this.hero;
    for (const e of this.enemies) if (!e.dead || e.deathT < 1.2) R.drawShadow(e.x, e.z, e.r * 1.1, e.dead ? 0.5 : 1);
    R.drawShadow(h.x, h.z, 0.55);
    for (const p of this.pickups) R.drawShadow(p.x, p.z, 0.35, 0.6);
    for (const o of World.obstacles) if (R.visible(o.x, o.z, 3)) R.drawShadow(o.x, o.z, o.r * 1.2, 0.8);
    for (const t of World.trees) if (R.visible(t.x, t.z, 3)) R.drawShadow(t.x, t.z, 1.3, 0.7);

    // Всё, что стоит на земле, рисуем от дальнего к ближнему.
    const list = [];
    const hx = R.sx(h.x);
    const hy = R.sy(h.z, 1);
    for (const t of World.trees) {
      if (!R.visible(t.x, t.z, 4)) continue;
      // Дерево перед героем становится полупрозрачным, чтобы герой не терялся в лесу.
      let target = 1;
      if (t.z > h.z) {
        const r = R.decorRect(t.id, t.x, t.z);
        if (hx > r.x && hx < r.x + r.w && hy > r.y && hy < r.y + r.h * 0.85) target = 0.4;
      }
      t.fade += (target - t.fade) * 0.2;
      list.push(t);
    }
    for (const o of World.obstacles) if (R.visible(o.x, o.z, 3)) list.push(o);
    for (const e of this.enemies) if (R.visible(e.x, e.z, 3)) list.push(e);
    for (const p of this.pickups) list.push(p);
    list.push(h);
    list.sort((a, b) => a.z - b.z);
    for (const o of list) {
      if (o.deco) {
        R.drawDecor(o.id, o.x, o.z, o.fade === undefined ? 1 : o.fade);
      } else {
        o.draw();
      }
    }
    c.globalCompositeOperation = "lighter";
    for (const p of this.projectiles) p.draw();
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    FX.drawAir();
    h.drawBar();
    FX.drawScreen();
  },
};
