"use strict";
// Запуск, ввод и главный цикл.

// Плавающий джойстик: где палец коснулся экрана, там и центр. Клавиатура (WASD и стрелки) — для проверки на компьютере.
const Input = {
  active: false,
  id: null,
  ox: 0,
  oy: 0,
  mx: 0,
  mz: 0,
  keys: {},
  RADIUS: 48,

  init() {
    const app = document.getElementById("app");
    const unlock = () => {
      Sound.unlock();
      Sound.startMusic();
    };
    for (const ev of ["pointerdown", "pointerup", "touchend", "keydown"]) window.addEventListener(ev, unlock, { passive: true });
    app.addEventListener("pointerdown", (e) => {
      if (Game.state !== "play" || e.target.closest("button, #craft, #endcard")) return;
      this.active = true;
      this.id = e.pointerId;
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.mx = this.mz = 0;
      UI.stick(true, this.ox, this.oy, 0, 0);
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.active || e.pointerId !== this.id) return;
      let dx = e.clientX - this.ox;
      let dy = e.clientY - this.oy;
      const len = Math.hypot(dx, dy);
      if (len > this.RADIUS) {
        // Основание тянется за пальцем — не нужно возвращать палец к центру.
        this.ox += (dx / len) * (len - this.RADIUS);
        this.oy += (dy / len) * (len - this.RADIUS);
        dx = e.clientX - this.ox;
        dy = e.clientY - this.oy;
      }
      this.mx = dx / this.RADIUS;
      this.mz = dy / this.RADIUS;
      UI.stick(true, this.ox, this.oy, dx, dy);
    });
    const end = (e) => {
      if (e.pointerId === this.id) this.release();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.code] = false));
    window.addEventListener("blur", () => (this.keys = {}));
  },

  release() {
    this.active = false;
    this.id = null;
    this.mx = this.mz = 0;
    UI.stick(false);
  },

  vector() {
    const k = this.keys;
    let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let z = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    if (x || z) return [x, z];
    // Мёртвая зона в 15% радиуса: дрожь пальца не двигает героя.
    const len = Math.hypot(this.mx, this.mz);
    if (len < 0.15) return [0, 0];
    return [this.mx, this.mz];
  },
};

// Бот для проверки (?bot=1): держит дистанцию от толпы, обходит удары босса, подбирает руны.
const Bot = {
  vector() {
    const h = Game.hero;
    let x = 0;
    let z = 0;
    for (const e of Game.enemies) {
      if (e.dead) continue;
      const dx = h.x - e.x;
      const dz = h.z - e.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 36) {
        const w = (e === Game.boss ? 6 : 1) / Math.max(0.5, d2);
        x += dx * w;
        z += dz * w;
      }
    }
    for (const m of FX.marks) {
      const dx = h.x - m.x;
      const dz = h.z - m.z;
      const d = Math.hypot(dx, dz) || 0.01;
      if (d < m.r + 1) {
        x += (dx / d) * 4;
        z += (dz / d) * 4;
      }
    }
    for (const p of Game.pickups) {
      x += (p.x - h.x) * 0.3;
      z += (p.z - h.z) * 0.3;
    }
    // Тянемся к центру и кружим, чтобы не упереться в край арены.
    const r = Math.hypot(h.x, h.z);
    x += -h.x * 0.02 * r - h.z * 0.04;
    z += -h.z * 0.02 * r + h.x * 0.04;
    const len = Math.hypot(x, z);
    return len < 0.05 ? [0, 0] : [x / len, z / len];
  },
};

let lastTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const speed = Number(CONFIG.debug.speed) || 1;
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000)) * speed;
  lastTime = now;
  Game.update(dt);
  Game.draw();
}

async function boot() {
  try {
    await Assets.loadAll();
  } catch (e) {
    document.getElementById("loading").textContent = String(e && e.message ? e.message : e);
    return;
  }
  R.init();
  UI.init();
  Input.init();
  window.addEventListener("resize", () => R.resize());
  window.addEventListener("orientationchange", () => setTimeout(() => R.resize(), 200));
  const pause = () => {
    Game.paused = true;
    Sound.suspend();
  };
  const resume = () => {
    Game.paused = false;
    lastTime = performance.now();
    Sound.resume();
  };
  Ad.onPause = pause;
  Ad.onResume = resume;
  Ad.onVolume = (on) => Sound.setNetworkMuted(!on);
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : Ad.viewable && resume()));
  Ad.ready(() => {
    UI.hideLoading();
    Game.start();
    lastTime = performance.now();
    requestAnimationFrame(frame);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
