"use strict";
// Ресурсы. В собранном файле они лежат прямо в HTML: window.__ASSETS__ (data:-URI) и window.__SPRITES__ (разметка атласов).
// При разработке грузятся из src/assets (нужен локальный сервер: python -m http.server).
const Assets = {
  images: {},
  sprites: null,

  url(path) {
    return (window.__ASSETS__ && window.__ASSETS__[path]) || "assets/" + path;
  },

  async loadAll() {
    this.sprites = window.__SPRITES__ || (await (await fetch("assets/sprites/sprites.json")).json());
    const names = ["hero", "minion", "rogue", "boss", "decor", "ground"];
    await Promise.all(names.map((n) => this.loadImage(n, "sprites/" + n + ".webp")));
    // Шрифты ждём недолго: если сеть или webview тормозят, лучше начать с системным шрифтом.
    if (document.fonts && document.fonts.load) {
      const fonts = Promise.all([
        document.fonts.load('700 20px "RC UI"'),
        document.fonts.load('20px "RC Title"'),
        document.fonts.load('20px "RC Runic"', "ᚠᛏᛋᛁᚱᛞ"),
      ]).catch(() => {});
      await Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]);
    }
  },

  loadImage(name, path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images[name] = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error("Не загрузилась картинка " + path));
      img.src = this.url(path);
    });
  },

  // Байты файла: из data:-URI без сети (fetch на data: в некоторых webview запрещён) или с диска при разработке.
  async bytes(path) {
    const embedded = window.__ASSETS__ && window.__ASSETS__[path];
    if (embedded) {
      const b64 = embedded.slice(embedded.indexOf(",") + 1);
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    return (await fetch("assets/" + path)).arrayBuffer();
  },
};
