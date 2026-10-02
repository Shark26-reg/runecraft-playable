"use strict";
// Игровые данные — подмножество game/scripts/autoload/game_data.gd основной игры.
// Цифры подогнаны под плейбл: он длится меньше минуты, а не 5 минут, поэтому скелеты хрупче, а заклинания чаще.

const RUNES = {
  fire:      { glyph: "ᚠ", color: "#ff6a3d" },
  arrow:     { glyph: "ᛏ", color: "#f2d49b" },
  lightning: { glyph: "ᛋ", color: "#ffe14d" },
  ice:       { glyph: "ᛁ", color: "#7fdcff" },
  wind:      { glyph: "ᚱ", color: "#c7f0e6" },
  arcane:    { glyph: "ᛞ", color: "#ff7ad9" },
};

// type: chain — молния с перескоками, cone — конус перед героем, nova — удар по площади
// (origin self — вокруг героя, target — по врагу), zone — зона на земле, бьёт тиками.
const SPELLS = {
  lightning_bolt: { runes: ["lightning", "arrow"], type: "chain", dmg: 32, cd: 1.4, jumps: 4, range: 9, color: "#ffe14d", sfx: "zap" },
  flame_wave:     { runes: ["fire", "wind"], type: "cone", dmg: 30, cd: 1.7, range: 6.5, angle: 80, color: "#ff5a1f", sfx: "fire" },
  steam:          { runes: ["fire", "ice"], type: "nova", origin: "self", dmg: 14, cd: 1.0, radius: 3.4, color: "#e8f4ff", sfx: "boom" },
  arcane_flame:   { runes: ["arcane", "fire"], type: "nova", origin: "target", dmg: 40, cd: 1.9, radius: 2.9, color: "#ff7ad9", sfx: "boom" },
  blizzard:       { runes: ["ice", "wind"], type: "zone", dmg: 7, tick: 0.4, duration: 3, cd: 2.8, radius: 3.3, slow: 0.45, color: "#bfeaff", sfx: "ice" },
  frost_nova:     { runes: ["arcane", "ice"], type: "nova", origin: "self", dmg: 28, cd: 2.2, radius: 5.0, slow: 0.5, color: "#9ee8ff", sfx: "ice" },
};

function recipeFor(a, b) {
  for (const id in SPELLS) {
    const r = SPELLS[id].runes;
    if ((r[0] === a && r[1] === b) || (r[0] === b && r[1] === a)) return id;
  }
  return null;
}

const HERO_DEF = {
  hp: 160, speed: 5.4, radius: 0.42,
  // Базовая атака мага — арканный снаряд в ближайшего врага (как в игре: 15 урона, 0.8 с).
  attack: { dmg: 16, cd: 0.55, range: 9.5, speed: 17, color: "#c9a2ff" },
};

const ENEMY_DEFS = {
  minion: { sprite: "minion", hp: 14, speed: 2.6, dmg: 5, radius: 0.42, reach: 1.15, atkCd: 1.3, windup: 0.45 },
  rogue:  { sprite: "rogue", hp: 12, speed: 4.3, dmg: 4, radius: 0.4, reach: 1.1, atkCd: 1.0, windup: 0.3 },
  boss:   { sprite: "boss", hp: 800, speed: 2.0, dmg: 24, radius: 1.25, reach: 2.2, atkCd: 3.2, windup: 1.0 },
};

const ARENA_RADIUS = 13;
