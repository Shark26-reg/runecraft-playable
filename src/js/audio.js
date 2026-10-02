"use strict";
// Звук на Web Audio. Браузеры разрешают звук только после касания, поэтому контекст
// создаётся при первом жесте игрока (Sound.unlock), тогда же стартует музыка.
const SOUND_NAMES = ["shoot", "shoot2", "hit", "hit2", "bones", "bones2", "pickup", "craft", "levelup", "zap", "boom",
  "boom_big", "ice", "hurt", "click", "fire", "bell", "win", "lose", "wave", "music"];

const Sound = {
  ctx: null,
  master: null,
  sfx: null,
  musicGain: null,
  buffers: {},
  last: {},
  voices: 0,
  muted: false,
  networkMuted: false,
  musicSource: null,
  wantMusic: false,

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.8;
      this.sfx.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.applyMute();
      this.loadAll();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  loadAll() {
    for (const name of SOUND_NAMES) {
      Assets.bytes("audio/" + name + ".mp3")
        .then((buf) => new Promise((ok, fail) => this.ctx.decodeAudioData(buf, ok, fail)))
        .then((decoded) => {
          this.buffers[name] = decoded;
          if (name === "music" && this.wantMusic) this.startMusic();
        })
        .catch(() => {});
    }
  },

  play(name, vol = 1, rate = 1) {
    if (!this.ctx || !this.buffers[name] || this.voices > 14) return;
    const now = this.ctx.currentTime;
    // Один и тот же звук не чаще раза в 45 мс: при залпе по толпе иначе получается каша.
    if (this.last[name] && now - this.last[name] < 0.045) return;
    this.last[name] = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfx);
    this.voices++;
    src.onended = () => this.voices--;
    src.start();
  },

  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || this.musicSource || !this.buffers.music) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.music;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.musicSource = src;
  },

  duckMusic(level, time = 0.4) {
    if (!this.musicGain) return;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(level, this.ctx.currentTime, time / 3);
  },

  toggle() {
    this.muted = !this.muted;
    this.applyMute();
    return !this.muted;
  },

  setNetworkMuted(m) {
    this.networkMuted = m;
    this.applyMute();
  },

  applyMute() {
    if (this.master) this.master.gain.value = this.muted || this.networkMuted ? 0 : 1;
  },

  suspend() {
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
  },

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
};
