"""Builds all Android icon/splash assets from the rendered mascot art.

1. npm run build && npx vite preview
2. Render art: node scripts/render-art.mjs   (writes art/mascot-bust.png, art/mascot-full.png)
3. python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw, ImageFilter
import os

RES = 'android/app/src/main/res'
BUST = Image.open('art/mascot-bust.png').convert('RGBA')
FULL = Image.open('art/mascot-full.png').convert('RGBA')
CREAM = (255, 244, 236, 255)


def background(size: int) -> Image.Image:
    """Coral radial gradient with soft polka dots (original art)."""
    big = 1024
    im = Image.new('RGBA', (big, big))
    px = im.load()
    c1 = (196, 178, 255)
    c2 = (112, 84, 245)
    for y in range(big):
        for x in range(big):
            d = min(1.0, (((x - big * 0.5) ** 2 + (y - big * 0.38) ** 2) ** 0.5) / (big * 0.72))
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * d) for i in range(3)) + (255,)
    dots = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    step = 128
    for j in range(-1, big // step + 2):
        for i in range(-1, big // step + 2):
            cx = i * step + (j % 2) * step // 2
            cy = j * step
            dd.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(255, 255, 255, 46))
    im = Image.alpha_composite(im, dots)
    return im.resize((size, size), Image.LANCZOS)


def foreground(size: int) -> Image.Image:
    """Mascot bust inside the adaptive-icon safe zone (centre 66/108)."""
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    bbox = BUST.getchannel('A').getbbox()
    art = BUST.crop(bbox)
    # Head width fills ~58% of the canvas; body runs off the bottom edge.
    target_w = int(1024 * 0.58)
    scale = target_w / art.width
    art = art.resize((target_w, int(art.height * scale)), Image.LANCZOS)
    top = int(1024 * 0.17)
    # Soft shadow behind the character.
    sh = Image.new('RGBA', art.size, (90, 30, 20, 0))
    sh.putalpha(art.getchannel('A').point(lambda a: int(a * 0.28)))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(sh, ((1024 - art.width) // 2, top + 16))
    canvas.alpha_composite(art, ((1024 - art.width) // 2, top))
    return canvas.resize((size, size), Image.LANCZOS)


def mask(size: int, round_: bool) -> Image.Image:
    m = Image.new('L', (size * 4, size * 4), 0)
    d = ImageDraw.Draw(m)
    if round_:
        d.ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=size * 4 * 0.22, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def legacy(size: int, round_: bool) -> Image.Image:
    # Legacy icons show the full 108dp art scaled to 48dp-equivalent with a small margin.
    full = Image.alpha_composite(background(size * 2), foreground(size * 2)).resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(full, (0, 0), mask(size, round_))
    return out


DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENS.items():
    d = f'{RES}/mipmap-{name}'
    os.makedirs(d, exist_ok=True)
    fg = int(108 * k)
    foreground(fg).save(f'{d}/ic_launcher_foreground.png')
    background(fg).save(f'{d}/ic_launcher_background.png')
    legacy(int(48 * k), False).save(f'{d}/ic_launcher.png')
    legacy(int(48 * k), True).save(f'{d}/ic_launcher_round.png')
    # Notification icon: white silhouette (24dp).
    nd = f'{RES}/drawable-{name}'
    os.makedirs(nd, exist_ok=True)
    n = int(24 * k)
    a = foreground(n * 3).getchannel('A').resize((n, n), Image.LANCZOS)
    sil = Image.new('RGBA', (n, n), (255, 255, 255, 0))
    sil.putalpha(a.point(lambda v: 255 if v > 100 else 0))
    sil.save(f'{nd}/ic_stat_notify.png')

with open(f'{RES}/mipmap-anydpi-v26/ic_launcher.xml', 'w') as f:
    f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')
with open(f'{RES}/mipmap-anydpi-v26/ic_launcher_round.xml', 'w') as f:
    f.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')

# Splash screens: mascot on cream.
def splash(w: int, h: int) -> Image.Image:
    im = Image.new('RGBA', (w, h), CREAM)
    bbox = FULL.getchannel('A').getbbox()
    art = FULL.crop(bbox)
    th = int(min(h * 0.42, w * 0.7))
    art = art.resize((int(art.width * th / art.height), th), Image.LANCZOS)
    im.alpha_composite(art, ((w - art.width) // 2, (h - art.height) // 2 - int(h * 0.03)))
    return im.convert('RGB')


for folder in os.listdir(RES):
    p = f'{RES}/{folder}/splash.png'
    if os.path.exists(p):
        w, h = Image.open(p).size
        splash(w, h).save(p)

# Store icon (512) + a 1024 master for reference.
os.makedirs('store/graphics', exist_ok=True)
Image.alpha_composite(background(512), foreground(512)).convert('RGB').save('store/graphics/icon-512.png')
Image.alpha_composite(background(1024), foreground(1024)).save('art/icon-1024.png')
print('icons + splash written')
