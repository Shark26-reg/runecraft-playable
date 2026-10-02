"use strict";
// Связь с рекламной сетью. Заранее неизвестно, где покажут плейбл, поэтому ищем известные API:
//   MRAID (AppLovin, Unity Ads, Vungle, Mintegral и др.) — mraid.open(url), события ready и viewableChange;
//   ironSource DAPI — dapi.openStoreUrl(), события viewableChange и audioVolumeChange;
//   Google Ads (HTML5) — ExitApi.exit();
//   Meta — FbPlayableAd.onCTAClick();
//   Mintegral — window.install(), window.gameReady() и window.gameEnd();
//   TikTok / Pangle — window.openAppStore().
// Без рекламной сети (обычная страница) кнопка открывает CONFIG.storeUrl, а если ссылки нет — показывает подсказку.
const Ad = {
  network: "none",
  viewable: true,
  onPause: null,
  onResume: null,
  onVolume: null,

  ready(start) {
    let started = false;
    const go = () => { if (!started) { started = true; start(); } };
    const mraid = window.mraid;
    const dapi = window.dapi;
    if (mraid && typeof mraid.getState === "function") {
      this.network = "mraid";
      const init = () => {
        mraid.addEventListener("viewableChange", (v) => this.setViewable(!!v));
        if (typeof mraid.isViewable === "function" && !mraid.isViewable()) {
          this.viewable = false;
          const wait = (v) => { if (v) { mraid.removeEventListener("viewableChange", wait); go(); } };
          mraid.addEventListener("viewableChange", wait);
        } else {
          go();
        }
      };
      if (mraid.getState() === "loading") mraid.addEventListener("ready", init);
      else init();
      return;
    }
    if (dapi && typeof dapi.isReady === "function") {
      this.network = "dapi";
      const init = () => {
        dapi.addEventListener("viewableChange", (e) => this.setViewable(!!(e && e.isViewable)));
        dapi.addEventListener("audioVolumeChange", (vol) => this.onVolume && this.onVolume(vol > 0));
        if (typeof dapi.getAudioVolume === "function" && this.onVolume) this.onVolume(dapi.getAudioVolume() > 0);
        if (dapi.isViewable()) go();
        else {
          this.viewable = false;
          dapi.addEventListener("viewableChange", (e) => { if (e && e.isViewable) go(); });
        }
      };
      if (dapi.isReady()) init();
      else dapi.addEventListener("ready", init);
      return;
    }
    if (window.ExitApi) this.network = "google";
    else if (window.FbPlayableAd) this.network = "meta";
    else if (typeof window.install === "function") this.network = "mintegral";
    if (typeof window.gameReady === "function") window.gameReady();
    go();
  },

  setViewable(v) {
    if (v === this.viewable) return;
    this.viewable = v;
    const cb = v ? this.onResume : this.onPause;
    if (cb) cb();
  },

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  },

  storeUrl() {
    return this.isIOS() ? CONFIG.storeUrl.ios || CONFIG.storeUrl.android : CONFIG.storeUrl.android || CONFIG.storeUrl.ios;
  },

  cta() {
    const url = this.storeUrl();
    try {
      if (window.mraid && typeof mraid.open === "function") { mraid.open(url); return; }
      if (window.dapi && typeof dapi.openStoreUrl === "function") { dapi.openStoreUrl(); return; }
      if (window.ExitApi && typeof ExitApi.exit === "function") { ExitApi.exit(); return; }
      if (window.FbPlayableAd && typeof FbPlayableAd.onCTAClick === "function") { FbPlayableAd.onCTAClick(); return; }
      if (typeof window.install === "function") { window.install(); return; }
      if (typeof window.openAppStore === "function") { window.openAppStore(); return; }
    } catch (e) {
      // SDK сети упал — пробуем открыть ссылку сами.
    }
    if (url) window.open(url, "_blank");
    else UI.toast(T("demo_store"));
  },

  gameEnd() {
    if (typeof window.gameEnd === "function") window.gameEnd();
  },
};
