"use strict";
// Интерфейс поверх холста (DOM): так текст остаётся чётким на любом экране, а вёрстка подстраивается под ориентацию.

const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" fill="#f1ecff"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="#f1ecff" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M18 6a8.5 8.5 0 0 1 0 12" stroke="#f1ecff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="#a79ec4"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#a79ec4" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_SKULL = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#e9e2d0" d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.7 1.3 4.6 3 5.8V19a1 1 0 0 0 1 1h1.5v-2h1.5v2h3v-2h1.5v2H16.5a1 1 0 0 0 1-1v-3c1.7-1.2 3-3.1 3-5.8C20.5 5.6 17 2 12 2z"/><circle cx="8.6" cy="11" r="2.2" fill="#1a1430"/><circle cx="15.4" cy="11" r="2.2" fill="#1a1430"/><path d="M12 13.2l-1.2 2.2h2.4z" fill="#1a1430"/></svg>');

const UI = {
  el: {},
  spellEls: [],
  shownXp: -1,

  init() {
    const ids = ["hud", "btn-sound", "wave-label", "xp-bar", "xp-label", "btn-cta-top", "kill-count", "boss-bar", "spells",
      "banner", "spell-pop", "hint", "stick", "endcard", "end-title", "end-stats", "btn-cta", "btn-retry", "toast", "loading"];
    for (const id of ids) this.el[id] = document.getElementById(id);
    for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = T(node.getAttribute("data-i18n"));
    document.querySelector("#kills .skull").style.backgroundImage = 'url("' + ICON_SKULL + '")';
    this.el["btn-sound"].innerHTML = ICON_SOUND_ON;
    this.el["btn-sound"].addEventListener("click", () => {
      Sound.unlock();
      const on = Sound.toggle();
      this.el["btn-sound"].innerHTML = on ? ICON_SOUND_ON : ICON_SOUND_OFF;
    });
    const cta = () => {
      Sound.play("click", 0.6);
      Ad.cta();
    };
    this.el["btn-cta-top"].addEventListener("click", cta);
    this.el["btn-cta"].addEventListener("click", cta);
    this.el["btn-retry"].addEventListener("click", () => {
      Sound.play("click", 0.6);
      this.hideEnd();
      Game.start();
    });
  },

  reset() {
    this.el.spells.innerHTML = "";
    this.spellEls = [];
    this.shownXp = -1;
    this.bossBar(false);
    this.hideEnd();
    this.el.hud.classList.remove("hidden");
  },

  hideLoading() {
    this.el.loading.classList.add("hidden");
  },

  setWave(text) {
    this.el["wave-label"].textContent = text;
  },

  setXp(frac, label) {
    const w = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    if (w !== this.shownXp) {
      this.shownXp = w;
      this.el["xp-bar"].firstElementChild.style.width = w + "%";
    }
    if (this.el["xp-label"].textContent !== label) this.el["xp-label"].textContent = label;
  },

  setKills(n) {
    this.el["kill-count"].textContent = n;
  },

  // Слот заклинания внизу экрана: две руны рецепта в круге цвета заклинания, сверху — сектор перезарядки.
  addSpell(id) {
    const node = spellIcon(id);
    this.el.spells.appendChild(node);
    this.spellEls.push(node);
  },

  updateSpells(slots) {
    for (let i = 0; i < slots.length && i < this.spellEls.length; i++) {
      this.spellEls[i].style.setProperty("--cd", slots[i].cdFrac.toFixed(3));
    }
  },

  banner(title, sub, glow) {
    const b = this.el.banner;
    b.innerHTML = "";
    b.appendChild(document.createTextNode(title));
    if (sub) {
      const s = document.createElement("small");
      s.textContent = sub;
      b.appendChild(s);
    }
    b.style.setProperty("--banner-glow", glow || "#8b5cf6");
    b.classList.remove("show");
    void b.offsetWidth;
    b.classList.add("show");
  },

  spellPop(text, color) {
    const p = this.el["spell-pop"];
    p.textContent = text;
    p.style.setProperty("--pop-color", color);
    p.classList.remove("show");
    void p.offsetWidth;
    p.classList.add("show");
  },

  hint(show, text) {
    this.el.hint.classList.toggle("hidden", !show);
    if (text) this.el.hint.querySelector(".hint-text").textContent = text;
  },

  stick(show, x, y, kx, ky) {
    const s = this.el.stick;
    s.classList.toggle("hidden", !show);
    if (!show) return;
    s.style.left = x + "px";
    s.style.top = y + "px";
    s.firstElementChild.style.transform = "translate(" + kx + "px," + ky + "px)";
  },

  bossBar(show, frac) {
    this.el["boss-bar"].classList.toggle("hidden", !show);
    if (show) this.el["boss-bar"].querySelector("i").style.width = Math.max(0, frac) * 100 + "%";
  },

  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove("show"), 2200);
  },

  showEnd(victory, stats) {
    this.el.hud.classList.add("hidden");
    this.el.banner.classList.remove("show");
    this.el["spell-pop"].classList.remove("show");
    this.hint(false);
    this.stick(false);
    const e = this.el.endcard;
    this.el["end-title"].textContent = T(victory ? "victory" : "defeat");
    e.style.setProperty("--end-glow", victory ? "#f5c451" : "#8b5cf6");
    const st = this.el["end-stats"];
    st.innerHTML = "";
    for (const [key, val] of [["stat_kills", stats.kills], ["stat_spells", stats.spells], ["stat_time", stats.time]]) {
      const d = document.createElement("div");
      d.appendChild(document.createTextNode(T(key) + ": "));
      const b = document.createElement("b");
      b.textContent = val;
      d.appendChild(b);
      st.appendChild(d);
    }
    e.classList.remove("hidden");
  },

  hideEnd() {
    this.el.endcard.classList.add("hidden");
  },
};

function spellColors(id) {
  const col = SPELLS[id].color;
  return { c1: mixHex(col, "#000000", 0.6), c2: mixHex(col, "#000000", 0.2), c3: mixHex(col, "#ffffff", 0.35) };
}

function spellIcon(id) {
  const node = document.createElement("div");
  node.className = "spell";
  const cols = spellColors(id);
  node.style.setProperty("--c1", cols.c1);
  node.style.setProperty("--c2", cols.c2);
  node.style.setProperty("--c3", cols.c3);
  node.textContent = SPELLS[id].runes.map((r) => RUNES[r].glyph).join("");
  return node;
}

// Самоцвет руны в DOM (крафт): шестигранник с символом футарка, как RuneGem в игре.
function gemElement(rune) {
  const col = RUNES[rune].color;
  const g = document.createElement("div");
  g.className = "gem";
  g.dataset.rune = rune;
  g.style.setProperty("--col", col);
  g.style.setProperty("--dark", mixHex(col, "#000000", 0.55));
  g.style.setProperty("--mid", mixHex(col, "#000000", 0.2));
  g.style.setProperty("--light", mixHex(col, "#ffffff", 0.3));
  g.innerHTML = '<div class="hex"></div><div class="hex-in"></div><div class="glyph"></div><div class="label"></div>';
  g.querySelector(".glyph").textContent = RUNES[rune].glyph;
  g.querySelector(".label").textContent = T("rune_" + rune);
  return g;
}
