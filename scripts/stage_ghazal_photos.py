"""Prepare review-only studio images from original single-product photographs.

Uses background removal on original pixels; never regenerates packaging or text.
Run with the Python 3.12 environment containing rembg[cpu].
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'design' / '00_سكرينات_جديدة_inbox'
STAGING = ROOT / 'docs' / 'ghazal_staging'
STAGING.mkdir(parents=True, exist_ok=True)
session = new_session('u2net')
arguments = sys.argv[1:]
if arguments == ['--all-wide']:
    arguments = [str(n) for n in range(209, 357)]
force = False
if arguments and arguments[0] == '--fix':
    force = True
    arguments = arguments[1:]

# Coordinates isolate the actual pack in marketing screenshots that have text,
# fruit, or a podium on the same background. Original pack pixels are preserved.
PRODUCT_CROPS = {
    219: (80, 4, 177, 306),
    318: (140, 205, 370, 468),
    319: (130, 282, 378, 573),
    337: (316, 212, 493, 626),
    339: (425, 50, 665, 676),
    351: (167, 234, 440, 509),
    355: (138, 48, 229, 339),
    356: (120, 22, 265, 339),
}

for arg in arguments:
    n = int(arg)
    path = SOURCE / f'ScreenHunter {n}.png'
    if not path.exists():
        print(f'{n}: missing')
        continue
    out = STAGING / f'screen-{n:03d}-studio-review.webp'
    if out.exists() and not force:
        print(f'{n}: already staged')
        continue
    source = Image.open(path).convert('RGBA')
    if n in PRODUCT_CROPS:
        source = source.crop(PRODUCT_CROPS[n])
    elif source.width < 500 or source.height < 500:
        print(f'{n}: skipped small/collage screen')
        continue
    cutout = remove(source, session=session)
    alpha = cutout.getchannel('A')
    bbox = alpha.getbbox()
    if not bbox:
        print(f'{n}: no foreground')
        continue
    crop = cutout.crop(bbox)
    scale = min(960 / crop.height, 900 / crop.width)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(size, Image.Resampling.LANCZOS)
    x = (1254 - size[0]) // 2
    y = (1254 - size[1]) // 2 - 12
    canvas = Image.new('RGB', (1254, 1254), 'white')
    # Soft contact shadow, drawn behind the original product pixels.
    shadow = Image.new('RGBA', (1254, 1254), (0, 0, 0, 0))
    shadow_alpha = crop.getchannel('A').point(lambda value: round(value * 0.11))
    shadow.paste((0, 0, 0, 255), (x + 10, y + 16, x + 10 + size[0], y + 16 + size[1]), shadow_alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(crop, (x, y), crop)
    canvas.save(out, 'WEBP', quality=92, method=6)
    print(f'{n}: staged {size[0]}x{size[1]} bbox={bbox}')
