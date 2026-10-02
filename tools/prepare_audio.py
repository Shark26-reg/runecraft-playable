#!/usr/bin/env python3
"""Звуки плейбла из ресурсов основной игры: OGG -> MP3 (моно), музыка — зацикленный отрывок.

MP3 выбран потому, что его декодирует любой браузер, включая старые Safari на iOS.

Запуск: python tools/prepare_audio.py <папка game/assets/audio основной игры>
Нужен ffmpeg: системный или из пакета imageio-ffmpeg (pip install imageio-ffmpeg).
"""
import array
import os
import shutil
import subprocess
import sys
import tempfile
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "assets", "audio")

# Имя в плейбле -> файл из game/assets/audio/sfx (те же группы, что в sfx.gd игры).
SFX = {
    "shoot": "laserSmall_000", "shoot2": "laserSmall_002",
    "hit": "impactPunch_medium_000", "hit2": "impactPunch_medium_002",
    "bones": "impactWood_light_000", "bones2": "impactWood_light_002",
    "pickup": "glass_001", "craft": "bong_001", "levelup": "maximize_001",
    "zap": "laserLarge_000", "boom": "explosionCrunch_000", "boom_big": "lowFrequency_explosion_000",
    "ice": "impactGlass_light_000", "hurt": "impactSoft_heavy_000", "click": "click_001",
    "fire": "thrusterFire_000", "bell": "impactBell_heavy_000",
}
JINGLES = {"win": "jingles_STEEL00", "lose": "jingles_PIZZI07", "wave": "jingles_PIZZI04"}
MUSIC_SRC = "battle_theme_a.mp3"
MUSIC_START, MUSIC_LEN, MUSIC_FADE = 6.0, 32.0, 1.5   # секунды: начало отрывка, длина петли, перехлёст
RATE = 32000


def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(*args):
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def to_mp3(src, dst, bitrate="48k"):
    # Тишину в начале обрезаем: у коротких звуков задержка заметна на слух.
    run("-i", src, "-af", "silenceremove=start_periods=1:start_threshold=-50dB", "-ac", "1", "-ar", "22050",
        "-b:a", bitrate, dst)


def music_loop(src, dst):
    """Петля без щелчка: хвост отрывка плавно перетекает в его начало."""
    tmp = tempfile.mkdtemp()
    raw = os.path.join(tmp, "m.wav")
    run("-ss", str(MUSIC_START), "-t", str(MUSIC_LEN + MUSIC_FADE), "-i", src, "-ac", "1", "-ar", str(RATE), raw)
    with wave.open(raw) as w:
        pcm = array.array("h", w.readframes(w.getnframes()))
    n_loop, n_fade = int(MUSIC_LEN * RATE), int(MUSIC_FADE * RATE)
    out = pcm[:n_loop]
    for i in range(n_fade):
        k = i / n_fade
        out[i] = int(pcm[n_loop + i] * (1 - k) + pcm[i] * k)
    looped = os.path.join(tmp, "loop.wav")
    with wave.open(looped, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(out.tobytes())
    run("-i", looped, "-b:a", "40k", dst)
    shutil.rmtree(tmp)


def main():
    if len(sys.argv) < 2:
        sys.exit("Укажите папку game/assets/audio основной игры")
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, f in SFX.items():
        dst = os.path.join(OUT, name + ".mp3")
        to_mp3(os.path.join(src, "sfx", f + ".ogg"), dst)
        total += os.path.getsize(dst)
    for name, f in JINGLES.items():
        dst = os.path.join(OUT, name + ".mp3")
        to_mp3(os.path.join(src, "music", f + ".ogg"), dst, "56k")
        total += os.path.getsize(dst)
    dst = os.path.join(OUT, "music.mp3")
    music_loop(os.path.join(src, "music", MUSIC_SRC), dst)
    print(f"Музыка: {os.path.getsize(dst) // 1024} КБ, звуки: {total // 1024} КБ")


if __name__ == "__main__":
    main()
