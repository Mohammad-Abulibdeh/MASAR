"""Renders promo/video.html to MP4, frame by frame (1080x1920, 30 fps).

    python render.py              -> MASAR_promo_silent.mp4, then sound.py -> MASAR_promo.mp4 (with sound)
    python render.py stills 2 5   -> stills/still_2.0.jpg, stills/still_5.0.jpg (quick checks)
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
URL = 'http://localhost:8600/promo/video.html'
FPS = 30


def open_page(p):
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
    page.goto(URL)
    page.evaluate("() => document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))))")
    page.wait_for_timeout(500)
    return browser, page


def stills(times):
    out = HERE / 'stills'
    out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser, page = open_page(p)
        for t in times:
            page.evaluate(f'seek({t})')
            page.screenshot(path=str(out / f'still_{t}.jpg'), type='jpeg', quality=85)
            print('still', t, flush=True)
        browser.close()


def video():
    target = HERE / 'MASAR_promo_silent.mp4'  # sound.py then adds the soundtrack -> MASAR_promo.mp4
    ffmpeg = subprocess.Popen([
        imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-i', '-',
        # JPEG frames are full-range: convert to the standard range so phones and social apps show true colours.
        '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-colorspace', 'bt709',
        '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', str(target),
    ], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        browser, page = open_page(p)
        total = int(page.evaluate('DURATION') * FPS)
        for i in range(total):
            page.evaluate(f'seek({i / FPS})')
            ffmpeg.stdin.write(page.screenshot(type='jpeg', quality=95))
            if i % 60 == 0:
                print(f'frame {i}/{total}', flush=True)
        browser.close()
    ffmpeg.stdin.close()
    ffmpeg.wait()
    print('done', target, ffmpeg.returncode)
    subprocess.run([sys.executable, str(HERE / 'sound.py')], check=True)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stills':
        stills([float(x) for x in sys.argv[2:]])
    else:
        video()
