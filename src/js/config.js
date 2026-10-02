"use strict";
// Настройки плейбла. Перед отправкой в рекламную сеть впишите ссылки на страницы игры в магазинах.
const CONFIG = {
  storeUrl: {
    android: "",   // например https://play.google.com/store/apps/details?id=...
    ios: "",       // например https://apps.apple.com/app/id...
  },
  maxDpr: 2,          // выше двух разница не видна, а заливка пикселей дорожает
  viewWidth: 11.5,    // сколько единиц мира видно по ширине экрана в портрете
  viewDepth: 12.5,    // сколько единиц мира видно в глубину в альбомной ориентации
  maxDuration: 110,   // секунд; если игрок затянул бой, всё равно показываем финальный экран
  // Параметры адреса для отладки: ?bot=1 (играет сам), ?lang=en, ?speed=2, ?stage=boss, ?seed=7
  debug: {},
};

(function parseQuery() {
  const q = (location.search || "").replace(/^\?/, "").split("&");
  for (const part of q) {
    if (!part) continue;
    const i = part.indexOf("=");
    const k = i < 0 ? part : part.slice(0, i);
    CONFIG.debug[k] = i < 0 ? "1" : decodeURIComponent(part.slice(i + 1));
  }
})();
