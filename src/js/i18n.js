"use strict";
// Тексты. Язык берётся из настроек устройства: русский для ru-*, иначе английский.
// tools/prepare_fonts.py собирает из этого файла все символы для подмножеств шрифтов.
const STRINGS = {
  ru: {
    cta: "Играть бесплатно",
    cta_short: "Скачать",
    retry: "Сыграть ещё раз",
    to_battle: "В бой!",
    move_hint: "Тяни пальцем, чтобы бежать",
    wave: "Волна {n}",
    wave_sub_1: "Скелеты идут!",
    wave_sub_2: "Орда!",
    boss_warn: "Босс!",
    boss_stage: "Финальный бой",
    boss_name: "Костяной король",
    xp_label: "Убивай врагов, чтобы открыть крафт",
    xp_rune: "Подбери руну!",
    xp_boss: "Победи Костяного короля",
    craft_title: "Крафт рун",
    craft_sub: "Перетащи одну руну на другую",
    craft_sub2: "Собери заклинания: 4 руны — 2 заклинания",
    no_recipe: "Такого рецепта нет — попробуй другую пару",
    crafted: "Новое заклинание!",
    recipes_total: "В игре 10 рун и 21 рецепт",
    victory: "Победа!",
    defeat: "Почти получилось!",
    stat_kills: "Убито",
    stat_spells: "Заклинаний",
    stat_time: "Время",
    end_pitch: "4 героя, 4 мира и 21 заклинание из 10 рун. Собери свою магию и выживи!",
    demo_store: "Демо-версия: здесь откроется страница игры в магазине",
    sound_on: "Звук включён",
    rune_fire: "Огонь", rune_arrow: "Стрела", rune_lightning: "Молния", rune_ice: "Лёд", rune_wind: "Ветер", rune_arcane: "Тайна",
    spell_lightning_bolt: "Цепная молния", desc_lightning_bolt: "Бьёт врага и перескакивает на 4 соседних",
    spell_flame_wave: "Огненная волна", desc_flame_wave: "Сжигает всех перед героем",
    spell_steam: "Пар", desc_steam: "Обжигающее облако вокруг героя",
    spell_arcane_flame: "Арканное пламя", desc_arcane_flame: "Мощный взрыв в толпе врагов",
    spell_blizzard: "Метель", desc_blizzard: "Ледяная буря замедляет и ранит",
    spell_frost_nova: "Ледяная нова", desc_frost_nova: "Волна льда: урон и замедление вокруг",
  },
  en: {
    cta: "Play for free",
    cta_short: "Install",
    retry: "Play again",
    to_battle: "Fight!",
    move_hint: "Drag to run",
    wave: "Wave {n}",
    wave_sub_1: "Skeletons are coming!",
    wave_sub_2: "The horde!",
    boss_warn: "Boss!",
    boss_stage: "Final battle",
    boss_name: "Bone King",
    xp_label: "Kill enemies to unlock crafting",
    xp_rune: "Pick up the rune!",
    xp_boss: "Defeat the Bone King",
    craft_title: "Rune crafting",
    craft_sub: "Drag one rune onto another",
    craft_sub2: "4 runes — craft 2 spells",
    no_recipe: "No such recipe — try another pair",
    crafted: "New spell!",
    recipes_total: "10 runes and 21 recipes in the game",
    victory: "Victory!",
    defeat: "So close!",
    stat_kills: "Kills",
    stat_spells: "Spells",
    stat_time: "Time",
    end_pitch: "4 heroes, 4 worlds and 21 spells from 10 runes. Craft your magic and survive!",
    demo_store: "Demo: the store page would open here",
    sound_on: "Sound on",
    rune_fire: "Fire", rune_arrow: "Arrow", rune_lightning: "Lightning", rune_ice: "Ice", rune_wind: "Wind", rune_arcane: "Arcane",
    spell_lightning_bolt: "Chain Lightning", desc_lightning_bolt: "Strikes a foe and jumps to 4 more",
    spell_flame_wave: "Flame Wave", desc_flame_wave: "Burns everything in front of the hero",
    spell_steam: "Steam", desc_steam: "A scalding cloud around the hero",
    spell_arcane_flame: "Arcane Flame", desc_arcane_flame: "A huge blast in the thick of the horde",
    spell_blizzard: "Blizzard", desc_blizzard: "An icy storm that slows and hurts",
    spell_frost_nova: "Frost Nova", desc_frost_nova: "A ring of ice: damage and slow around",
  },
};

const LANG = (() => {
  const forced = CONFIG.debug.lang;
  if (forced && STRINGS[forced]) return forced;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
  return /^(ru|be|uk|kk)/i.test(nav) ? "ru" : "en";
})();
document.documentElement.lang = LANG;

function T(key, vars) {
  let s = STRINGS[LANG][key];
  if (s === undefined) s = STRINGS.en[key] !== undefined ? STRINGS.en[key] : key;
  if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
}
