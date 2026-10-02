"use strict";
// Окно крафта: перетащи руну на руну (или нажми на две по очереди) — получится заклинание.
// Если игрок медлит, палец-подсказка показывает подходящую пару, а через несколько секунд
// крафт доделывается сам: рекламу часто смотрят, не трогая экран.
const Craft = {
  root: null,
  gems: [],
  selected: null,
  crafted: 0,
  maxSpells: 1,
  idleT: 0,
  busy: false,
  done: false,
  onDone: null,
  closeT: -1,
  drag: null,

  open(runes, maxSpells, subKey, onDone) {
    this.root = document.getElementById("craft");
    this.box = document.getElementById("craft-runes");
    this.result = document.getElementById("craft-result");
    this.msg = document.getElementById("craft-msg");
    this.fight = document.getElementById("btn-fight");
    this.finger = document.getElementById("craft-finger");
    this.root.querySelector(".subtitle").textContent = T(subKey);
    this.box.innerHTML = "";
    this.box.classList.remove("hidden");
    this.result.innerHTML = "";
    this.msg.textContent = "";
    this.msg.classList.remove("bad");
    this.fight.classList.add("hidden");
    this.gems = runes.map((r) => {
      const g = gemElement(r);
      g.addEventListener("pointerdown", (e) => this.down(e, g));
      this.box.appendChild(g);
      return g;
    });
    this.fight.onclick = () => this.close();
    this.selected = null;
    this.crafted = 0;
    this.maxSpells = maxSpells;
    this.idleT = 0;
    this.busy = false;
    this.done = false;
    this.closeT = -1;
    this.onDone = onDone;
    this.root.classList.remove("hidden");
    Sound.play("levelup", 0.5);
  },

  free() {
    return this.gems.filter((g) => !g.classList.contains("used"));
  },

  // Первая пара свободных рун, из которой есть рецепт.
  validPair() {
    const f = this.free();
    for (let i = 0; i < f.length; i++) {
      for (let j = i + 1; j < f.length; j++) {
        if (recipeFor(f[i].dataset.rune, f[j].dataset.rune)) return [f[i], f[j]];
      }
    }
    return null;
  },

  down(e, g) {
    if (this.busy || this.done) return;
    Sound.unlock();
    this.idleT = 0;
    e.preventDefault();
    g.setPointerCapture(e.pointerId);
    this.drag = { g, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, target: null };
    g.classList.add("dragging");
    const move = (ev) => this.move(ev);
    const up = (ev) => {
      g.removeEventListener("pointermove", move);
      g.removeEventListener("pointerup", up);
      g.removeEventListener("pointercancel", up);
      this.up(ev);
    };
    g.addEventListener("pointermove", move);
    g.addEventListener("pointerup", up);
    g.addEventListener("pointercancel", up);
  },

  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true;
    d.g.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.1)";
    let target = null;
    for (const o of this.free()) {
      if (o === d.g) continue;
      const r = o.getBoundingClientRect();
      if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 0.75) target = o;
    }
    if (target !== d.target) {
      if (d.target) d.target.classList.remove("target");
      if (target) target.classList.add("target");
      d.target = target;
    }
  },

  up() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.g.classList.remove("dragging");
    d.g.style.transform = "";
    if (d.target) {
      d.target.classList.remove("target");
      this.tryCraft(d.g, d.target);
      return;
    }
    if (d.moved) return;
    // Касание без перетаскивания: выбор двух рун по очереди.
    Sound.play("click", 0.5);
    if (!this.selected) {
      this.selected = d.g;
      d.g.classList.add("selected");
    } else if (this.selected === d.g) {
      d.g.classList.remove("selected");
      this.selected = null;
    } else {
      const a = this.selected;
      a.classList.remove("selected");
      this.selected = null;
      this.tryCraft(a, d.g);
    }
  },

  tryCraft(a, b) {
    const id = recipeFor(a.dataset.rune, b.dataset.rune);
    this.idleT = 0;
    if (!id) {
      for (const g of [a, b]) {
        g.classList.remove("shake");
        void g.offsetWidth;
        g.classList.add("shake");
      }
      this.msg.textContent = T("no_recipe");
      this.msg.classList.add("bad");
      Sound.play("hurt", 0.3);
      return;
    }
    this.busy = true;
    if (this.selected) this.selected.classList.remove("selected");
    this.selected = null;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    a.style.transform = "translate(" + (rb.left - ra.left) + "px," + (rb.top - ra.top) + "px)";
    Sound.play("craft", 0.7);
    setTimeout(() => {
      a.classList.add("used");
      b.classList.add("used");
      a.style.transform = "";
      // Израсходованные руны убираем из ряда, когда они растворятся, — иначе остаётся пустое место.
      setTimeout(() => {
        a.classList.add("hidden");
        b.classList.add("hidden");
        if (!this.free().length) this.box.classList.add("hidden");
      }, 220);
      Sound.play("levelup", 0.6);
      const card = document.createElement("div");
      card.className = "spell-card";
      const cols = spellColors(id);
      card.style.setProperty("--c2", cols.c2);
      card.style.setProperty("--c3", cols.c3);
      card.innerHTML = '<div class="info"><div class="name"></div><div class="desc"></div></div>';
      card.insertBefore(spellIcon(id), card.firstChild);
      card.querySelector(".name").textContent = T("spell_" + id);
      card.querySelector(".desc").textContent = T("desc_" + id);
      this.result.appendChild(card);
      this.msg.textContent = T("crafted");
      this.msg.classList.remove("bad");
      Game.addSpell(id);
      this.crafted++;
      this.busy = false;
      if (this.crafted >= this.maxSpells || !this.validPair()) this.finish();
    }, 260);
  },

  finish() {
    this.done = true;
    this.finger.classList.add("hidden");
    if (this.crafted < this.maxSpells) this.msg.textContent = T("recipes_total");
    this.fight.classList.remove("hidden");
    this.closeT = this.crafted < this.maxSpells ? 2.6 : 1.6;
  },

  close() {
    if (!this.root || this.root.classList.contains("hidden")) return;
    this.root.classList.add("hidden");
    this.finger.classList.add("hidden");
    Sound.play("click", 0.5);
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  },

  update(dt) {
    if (this.done) {
      this.closeT -= dt;
      if (this.closeT <= 0) this.close();
      return;
    }
    if (this.busy || this.drag) return;
    this.idleT += dt;
    const pair = this.validPair();
    if (!pair) return;
    const auto = CONFIG.debug.bot ? 0.9 : 7;
    if (this.idleT > auto) {
      this.tryCraft(pair[0], pair[1]);
      return;
    }
    // Палец «перетаскивает» руну на пару, повторяя движение каждые 1.8 с.
    if (this.idleT < 1.4) {
      this.finger.classList.add("hidden");
      return;
    }
    const p = ((this.idleT - 1.4) % 1.8) / 1.8;
    const ra = pair[0].getBoundingClientRect();
    const rb = pair[1].getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (p - 0.15) / 0.6));
    const e = k * k * (3 - 2 * k);
    const x = ra.left + ra.width / 2 + (rb.left - ra.left) * e;
    const y = ra.top + ra.height / 2 + (rb.top - ra.top) * e;
    this.finger.classList.remove("hidden");
    this.finger.style.left = x + "px";
    this.finger.style.top = y + "px";
    this.finger.style.opacity = p < 0.08 ? p / 0.08 : p > 0.88 ? (1 - p) / 0.12 : 1;
  },
};
