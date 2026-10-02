#!/usr/bin/env python3
"""Подмножества шрифтов основной игры для плейбла (только нужные символы) в формате WOFF.

  title.woff  — Philosopher Bold (заголовки, логотип);
  ui.woff     — Rubik, вариативный шрифт зафиксирован на начертании 700;
  runic.woff  — Noto Sans Runic, только руны, которые встречаются в коде.

Символы берутся из src/js/*.js и src/index.html, поэтому после правки текстов скрипт нужно запустить снова.
Запуск: python tools/prepare_fonts.py <папка game/assets/fonts основной игры>
Нужен fontTools (pip install fonttools).
"""
import glob
import io
import os
import shutil
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "assets", "fonts")


def source_text():
    text = ""
    for path in glob.glob(os.path.join(ROOT, "src", "js", "*.js")) + [os.path.join(ROOT, "src", "index.html")]:
        text += io.open(path, encoding="utf-8").read()
    return text


def make(src_font, text, out_name, weight=None):
    font = TTFont(src_font)
    if weight is not None and "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": weight})
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["kern", "liga"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    path = os.path.join(OUT, out_name)
    font.flavor = "woff"
    font.save(path)
    return os.path.getsize(path)


def main():
    if len(sys.argv) < 2:
        sys.exit("Укажите папку game/assets/fonts основной игры")
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    text = source_text()
    plain = "".join(sorted({ch for ch in text if not 0x16A0 <= ord(ch) <= 0x16FF and ord(ch) >= 0x20}))
    plain += "".join(chr(c) for c in range(0x20, 0x7F)) + "«»—–…·×№"
    runic = "".join(sorted({ch for ch in text if 0x16A0 <= ord(ch) <= 0x16FF})) + " "
    sizes = {
        "title.woff": make(os.path.join(src, "Philosopher-Bold.ttf"), plain, "title.woff"),
        "ui.woff": make(os.path.join(src, "Rubik[wght].ttf"), plain, "ui.woff", weight=700),
        "runic.woff": make(os.path.join(src, "NotoSansRunic-Regular.ttf"), runic, "runic.woff"),
    }
    lic = os.path.join(ROOT, "licenses")
    os.makedirs(lic, exist_ok=True)
    for name in ("OFL_Philosopher.txt", "OFL_Rubik.txt", "OFL_NotoSansRunic.txt"):
        shutil.copy(os.path.join(src, name), os.path.join(lic, name))
    print("Руны в коде:", runic.strip())
    print(", ".join(f"{k} {v // 1024} КБ" for k, v in sizes.items()))


if __name__ == "__main__":
    main()
