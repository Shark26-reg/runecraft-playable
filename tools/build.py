#!/usr/bin/env python3
"""Сборка плейбла в один HTML-файл без внешних запросов (так требуют рекламные сети).

Что делает:
  * встраивает стили, шрифты, картинки, звуки и разметку атласов прямо в HTML (data:-URI);
  * склеивает скрипты в том порядке, в каком они подключены в src/index.html, и выбрасывает комментарии;
  * собирает варианты под сети:
      dist/runecraft-playable.html        — универсальный: сам находит API сети (MRAID, DAPI, Google, Meta, Mintegral);
      dist/runecraft-playable-mraid.html  — с подключением mraid.js (AppLovin, Unity Ads, ironSource, Vungle);
      dist/runecraft-playable-google.zip  — для Google Ads: index.html с ExitApi и мета-тегом размера;
  * кладёт универсальный вариант в docs/index.html — его можно открыть через GitHub Pages.

Запуск: python tools/build.py   (нужен только Python 3, без пакетов)
"""
import base64
import io
import json
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")
DOCS = os.path.join(ROOT, "docs")
LIMIT_SOFT = 2 * 1024 * 1024    # Meta и ряд сетей: до 2 МБ
LIMIT_HARD = 5 * 1024 * 1024    # AppLovin, Unity, ironSource, Google: до 5 МБ

MIME = {".webp": "image/webp", ".png": "image/png", ".mp3": "audio/mpeg", ".woff": "font/woff", ".json": "application/json"}


def read(path, mode="r"):
    if mode == "rb":
        with open(path, "rb") as f:
            return f.read()
    return io.open(path, encoding="utf-8").read()


def data_uri(path):
    ext = os.path.splitext(path)[1].lower()
    return "data:" + MIME[ext] + ";base64," + base64.b64encode(read(path, "rb")).decode("ascii")


def strip_js(code):
    """Убирает строки-комментарии, отступы и пустые строки. Многострочных шаблонных строк в коде нет."""
    out = []
    for line in code.splitlines():
        s = line.strip()
        if not s or s.startswith("//"):
            continue
        out.append(s)
    return "\n".join(out)


def build_html():
    html = read(os.path.join(SRC, "index.html"))

    # Стили: шрифты — внутрь CSS.
    css = read(os.path.join(SRC, "style.css"))
    css = re.sub(r"url\((assets/fonts/[^)]+)\)", lambda m: "url(" + data_uri(os.path.join(SRC, m.group(1))) + ")", css)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = "\n".join(l.strip() for l in css.splitlines() if l.strip())
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")

    # Ресурсы: всё из src/assets, кроме шрифтов (они уже в CSS) и исходной разметки атласов.
    assets = {}
    for sub in ("sprites", "audio"):
        folder = os.path.join(SRC, "assets", sub)
        for name in sorted(os.listdir(folder)):
            if name.endswith((".webp", ".png", ".mp3")):
                assets[sub + "/" + name] = data_uri(os.path.join(folder, name))
    sprites = json.loads(read(os.path.join(SRC, "assets", "sprites", "sprites.json")))

    # Скрипты в порядке подключения.
    scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
    code = "\n".join(strip_js(read(os.path.join(SRC, p))) for p in scripts)
    html = re.sub(r'\s*<script src="js/[^"]+"></script>', "", html)
    html = re.sub(r"\s*<!--.*?-->", "", html, flags=re.S)
    payload = ("<script>\nwindow.__ASSETS__=" + json.dumps(assets, separators=(",", ":")) + ";\n"
               + "window.__SPRITES__=" + json.dumps(sprites, ensure_ascii=False, separators=(",", ":")) + ";\n"
               + code + "\n</script>\n")
    html = html.replace("</body>", payload + "</body>")
    return html


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return os.path.getsize(path)


def main():
    html = build_html()
    os.makedirs(DIST, exist_ok=True)
    report = []

    report.append(("runecraft-playable.html", write(os.path.join(DIST, "runecraft-playable.html"), html)))

    mraid = html.replace("<title>", '<script src="mraid.js"></script>\n<title>', 1)
    report.append(("runecraft-playable-mraid.html", write(os.path.join(DIST, "runecraft-playable-mraid.html"), mraid)))

    google = html.replace("<title>", '<meta name="ad.size" content="width=320,height=480">\n'
                          '<script type="text/javascript" src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>\n<title>', 1)
    zpath = os.path.join(DIST, "runecraft-playable-google.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("index.html", google)
    report.append(("runecraft-playable-google.zip", os.path.getsize(zpath)))

    os.makedirs(DOCS, exist_ok=True)
    shutil.copy(os.path.join(DIST, "runecraft-playable.html"), os.path.join(DOCS, "index.html"))

    worst = 0
    for name, size in report:
        mark = "  (больше 2 МБ: не пройдёт в Meta)" if size > LIMIT_SOFT else ""
        print(f"{name:34s} {size / 1024 / 1024:5.2f} МБ{mark}")
        worst = max(worst, size)
    if worst > LIMIT_HARD:
        sys.exit("Больше 5 МБ — такой файл не примет ни одна крупная сеть")


if __name__ == "__main__":
    main()
