"""Génère le logo Orvia (pépite d'or en fond + nom) et toutes les icônes de l'appli.
Lancer : python3 scripts/brand/make_logo.py  (nécessite Pillow)"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

BG = (14, 15, 19, 255)
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
S = 2048  # dessin en haute résolution, réduit ensuite

def nugget(size, scale, seed=11):
    """Pépite d'or : silhouette irrégulière + relief en 3D éclairé (diffus + reflets métalliques)."""
    rnd = np.random.default_rng(seed)
    n = size // 2  # calcul à mi-résolution puis agrandi
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n - 0.5
    # silhouette : rayon déformé par des harmoniques (bords bosselés, un peu anguleux)
    ang = np.arctan2(yy, xx)
    rad = np.hypot(xx / 1.1, yy / 0.92)
    edge = 1.0
    for k in range(2, 12):
        edge += rnd.uniform(0.015, 0.06) / k ** 0.45 * np.sin(k * ang + rnd.uniform(0, 6.3))
    inside = rad < (scale / 2) * edge
    # relief : somme de bosses gaussiennes de tailles variées + dôme général
    h = np.clip(1 - (rad / ((scale / 2) * edge)) ** 2, 0, 1) ** 0.6
    for _ in range(90):
        cx, cy = rnd.uniform(-0.35, 0.35, 2) * scale * 1.2
        r = rnd.uniform(0.03, 0.14) * scale
        amp = rnd.uniform(-0.10, 0.18)
        h += amp * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r))
    h *= inside
    # normales et éclairage
    gy, gx = np.gradient(h * n * 0.55)  # pente en unités de pixels
    nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.55, -0.6, 0.58]); L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    Hv = L + np.array([0, 0, 1.0]); Hv /= np.linalg.norm(Hv)
    spec = np.clip(nx * Hv[0] + ny * Hv[1] + nz * Hv[2], 0, 1) ** 40
    dark, mid, light = np.array([92, 56, 6]), np.array([214, 160, 40]), np.array([255, 226, 120])
    t = diff[..., None]
    col = np.where(t < 0.6, dark + (mid - dark) * (t / 0.6), mid + (light - mid) * ((t - 0.6) / 0.4))
    col = col + spec[..., None] * np.array([255, 245, 210]) * 0.9
    col = np.clip(col, 0, 255).astype(np.uint8)
    alpha = (inside * 255).astype(np.uint8)
    img = Image.fromarray(np.dstack([col, alpha]), 'RGBA').resize((size, size), Image.LANCZOS)
    a = img.split()[3].filter(ImageFilter.GaussianBlur(size * 0.0015))
    img.putalpha(a)
    return img

def with_text(img, text, rel_width, color=(255, 248, 228, 255)):
    size = img.width
    fs = int(size * 0.3)
    font = ImageFont.truetype(FONT, fs)
    while font.getlength(text) > size * rel_width:
        fs -= 4; font = ImageFont.truetype(FONT, fs)
    d = ImageDraw.Draw(img)
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    x, y = (size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t + size * 0.01
    # léger reflet clair sous les lettres, comme une gravure
    # gravure : ombre portée sombre + reflet clair, puis lettres crème lisibles sur l'or
    sw = max(2, int(size * 0.009))
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x + size * 0.006, y + size * 0.01), text, font=font, fill=(30, 16, 0, 170),
                                stroke_width=sw, stroke_fill=(30, 16, 0, 170))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * 0.006)))
    d.text((x, y), text, font=font, fill=color, stroke_width=sw, stroke_fill=(52, 30, 2, 255))
    return img

def icon(size, scale, text=True, bg=True):
    base = Image.new('RGBA', (S, S), BG if bg else (0, 0, 0, 0))
    n = nugget(S, scale)
    base.alpha_composite(n)
    if text:
        with_text(base, 'Orvia', scale * 0.72)
    return base.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    big = icon(1024, 0.78)
    big.save('assets/icon.png')
    big.resize((512, 512), Image.LANCZOS).save('public/icons/icon-512.png')
    big.resize((192, 192), Image.LANCZOS).save('public/icons/icon-192.png')
    big.resize((180, 180), Image.LANCZOS).save('public/icons/apple-touch-icon.png')
    big.resize((48, 48), Image.LANCZOS).save('assets/favicon.png')
    icon(512, 0.6).save('public/icons/maskable-512.png')         # zone sûre des icônes masquables
    icon(1024, 0.56, bg=False).save('assets/android-icon-foreground.png')  # zone sûre Android
    icon(1024, 0.5, bg=False).save('assets/splash-icon.png')
    icon(600, 0.8, bg=False).save('assets/logo.png')             # logo affiché dans l'appli
    mono = icon(1024, 0.56, text=False, bg=False)
    a = mono.split()[3]
    Image.merge('RGBA', [a.point(lambda v: 255)] * 3 + [a]).save('assets/android-icon-monochrome.png')
    print('ok')
