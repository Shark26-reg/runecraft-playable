#!/usr/bin/env python3
"""Сборка атласов спрайтов из кадров, отрендеренных tools/render/render_sprites.gd.

Что делает:
  * обрезает кадры персонажа по общей рамке (опорная точка «ноги» у всех кадров одна);
  * уменьшает вдвое (рендер шёл с суперсэмплингом) и обводит персонажей тёмным контуром,
    чтобы они читались на траве;
  * раскладывает кадры в атласы WebP и пишет src/assets/sprites/sprites.json.

Запуск: python tools/pack_sprites.py [папка_с_кадрами]   (по умолчанию build/raw)
Нужен Pillow с поддержкой WebP.
"""
import json
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build", "raw")
OUT = os.path.join(ROOT, "src", "assets", "sprites")
MAX_W = 2048
QUALITY = 78
ALPHA_QUALITY = 70  # альфа без потерь занимает больше половины файла; 70 на глаз не отличить
OUTLINE = (24, 14, 40)


def load(name):
    """Кадр Godot с прозрачным фоном: на краях цвет уже умножен на альфу — возвращаем обычную альфу."""
    im = Image.open(os.path.join(RAW, name)).convert("RGBA")
    return im.convert("RGBa").convert("RGBA")


def bbox_union(frames):
    box = None
    for im in frames:
        b = im.getchannel("A").point(lambda a: 255 if a > 6 else 0).getbbox()
        if b is None:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return box


def shrink(im, ss):
    if ss == 1:
        return im
    w, h = im.size
    # Уменьшение в премультиплицированном виде, иначе по краям вылезает тёмная кайма.
    return im.convert("RGBa").resize((w // ss, h // ss), Image.LANCZOS).convert("RGBA")


def outline(im, alpha=190):
    a = im.getchannel("A")
    grown = a.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    grown = grown.point(lambda v: min(alpha, int(v * 1.6)))
    base = Image.new("RGBA", im.size, OUTLINE + (0,))
    base.putalpha(grown)
    base.alpha_composite(im)
    return base


def pack_grid(frames, cell):
    cols = max(1, min(len(frames), MAX_W // cell[0]))
    rows = (len(frames) + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * cell[0], rows * cell[1]), (0, 0, 0, 0))
    for i, im in enumerate(frames):
        atlas.paste(im, ((i % cols) * cell[0], (i // cols) * cell[1]))
    return atlas, cols


def save_webp(im, name, lossless=False):
    path = os.path.join(OUT, name)
    if lossless:
        im.save(path, "WEBP", lossless=True, quality=100, method=6)
    else:
        im.save(path, "WEBP", quality=QUALITY, alpha_quality=ALPHA_QUALITY, method=6)
    return os.path.getsize(path)


def main():
    man = json.load(open(os.path.join(RAW, "manifest.json"), encoding="utf-8"))
    ss = int(man["ss"])
    feet_y = float(man["feet_y"])
    os.makedirs(OUT, exist_ok=True)
    meta = {"pitch": man["pitch"], "characters": {}, "decor": {}, "ground": {}}
    total = 0

    for cid, info in man["characters"].items():
        # У каждой анимации своя рамка: поза смерти раскидывает кости широко, бег — компактный.
        sections = []
        anims = {}
        y = 0
        width = 0
        for aname, a in info["anims"].items():
            count = a["n"] * (1 if a["south"] else info["dirs"])
            frames = [load(f) for f in info["frames"][a["first"]:a["first"] + count]]
            box = bbox_union(frames)
            pad = 3 * ss
            box = (max(0, box[0] - pad), max(0, box[1] - pad), min(info["px"], box[2] + pad), min(info["px"], box[3] + pad))
            # Ширину и высоту выравниваем на ss, чтобы уменьшение было ровным.
            w = (box[2] - box[0] + ss - 1) // ss * ss
            h = (box[3] - box[1] + ss - 1) // ss * ss
            out = [outline(shrink(im.crop((box[0], box[1], box[0] + w, box[1] + h)), ss)) for im in frames]
            cell = (w // ss, h // ss)
            grid, cols = pack_grid(out, cell)
            sections.append((grid, y))
            feet = ((info["px"] / 2 - box[0]) / ss, (info["px"] * feet_y - box[1]) / ss)
            anims[aname] = {"y": y, "cell": cell, "cols": cols, "feet": [round(feet[0], 1), round(feet[1], 1)],
                            "n": a["n"], "loop": a["loop"], "south": a["south"], "len": round(a["len"], 3)}
            y += grid.size[1]
            width = max(width, grid.size[0])
        atlas = Image.new("RGBA", (width, y), (0, 0, 0, 0))
        for grid, gy in sections:
            atlas.paste(grid, (0, gy))
        size = save_webp(atlas, cid + ".webp")
        total += size
        meta["characters"][cid] = {"image": cid + ".webp", "k": info["k"], "dirs": info["dirs"], "anims": anims}
        cells = ", ".join(f"{n} {a['cell'][0]}x{a['cell'][1]}" for n, a in anims.items())
        print(f"{cid:8s} {len(info['frames']):4d} кадров ({cells}), атлас {atlas.size[0]}x{atlas.size[1]}, {size // 1024} КБ")

    # Декор: каждая модель обрезается по себе, раскладка полками.
    items = []
    for did, d in man["decor"].items():
        im = load(d["file"])
        b = bbox_union([im])
        b = (max(0, b[0] - 2 * ss), max(0, b[1] - 2 * ss), min(d["px"], b[2] + 2 * ss), min(d["px"], b[3] + 2 * ss))
        w = (b[2] - b[0] + ss - 1) // ss * ss
        h = (b[3] - b[1] + ss - 1) // ss * ss
        c = shrink(im.crop((b[0], b[1], b[0] + w, b[1] + h)), ss)
        feet = ((d["px"] / 2 - b[0]) / ss, (d["px"] * feet_y - b[1]) / ss)
        items.append((did, c, feet, d))
    items.sort(key=lambda t: -t[1].size[1])
    x = y = shelf = 0
    placed = []
    for did, c, feet, d in items:
        if x + c.size[0] > MAX_W:
            x, y, shelf = 0, y + shelf + 2, 0
        placed.append((did, c, (x, y), feet, d))
        x += c.size[0] + 2
        shelf = max(shelf, c.size[1])
    atlas = Image.new("RGBA", (MAX_W, y + shelf), (0, 0, 0, 0))
    for did, c, pos, feet, d in placed:
        atlas.paste(c, pos)
        meta["decor"][did] = {"rect": [pos[0], pos[1], c.size[0], c.size[1]], "feet": [round(feet[0], 1), round(feet[1], 1)],
                              "k": d["k"], "radius": round(d["radius"], 2), "height": round(d["height"], 2)}
    atlas = atlas.crop((0, 0, max(p[2][0] + p[1].size[0] for p in placed), atlas.size[1]))
    size = save_webp(atlas, "decor.webp")
    total += size
    meta["decor_image"] = "decor.webp"
    print(f"decor    {len(placed):4d} моделей, атлас {atlas.size[0]}x{atlas.size[1]}, {size // 1024} КБ")

    g = man["ground"]
    gim = Image.open(os.path.join(RAW, g["file"])).convert("RGB")
    path = os.path.join(OUT, "ground.webp")
    gim.save(path, "WEBP", quality=78, method=6)
    total += os.path.getsize(path)
    meta["ground"] = {"image": "ground.webp", "tile": g["tile"], "k": g["k"]}
    print(f"ground   плитка {gim.size[0]}x{gim.size[1]}, {os.path.getsize(path) // 1024} КБ")

    with open(os.path.join(OUT, "sprites.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f"Итого: {total // 1024} КБ")


if __name__ == "__main__":
    main()
