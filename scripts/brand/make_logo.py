"""Génère le logo Orvia (louis d'or en fond + nom) et toutes les icônes de l'appli.
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

SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SYMBOLS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def _glyph_mask(text, font, angle_deg):
    """Une lettre (ou un symbole) dessinée sur un petit calque, tournée."""
    l, t, r, b = font.getbbox(text)
    g = Image.new('L', (r - l + 8, b - t + 8), 0)
    ImageDraw.Draw(g).text((4 - l, 4 - t), text, font=font, fill=255)
    return g.rotate(angle_deg, resample=Image.BICUBIC, expand=True)


def coin(size, scale):
    """Louis d'or : pièce bombée, rebord, grènetis, inscriptions et fleur de lys frappées en relief."""
    n = 1024
    R = n * scale / 2
    c = n / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    rr = np.hypot(xx - c, yy - c) / R  # 1 = bord de la pièce
    inside = rr <= 1.0
    relief = Image.new('L', (n, n), 0)  # éléments frappés (lettres, perles, lys)
    d = ImageDraw.Draw(relief)
    # grènetis : couronne de perles
    beads = 72
    for i in range(beads):
        a = 2 * math.pi * i / beads
        br = R * 0.025
        bx, by = c + R * 0.865 * math.cos(a), c + R * 0.865 * math.sin(a)
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=255)
    # fin filet intérieur
    for rad, w in [(0.80, 0.008)]:
        d.ellipse([c - R * rad, c - R * rad, c + R * rad, c + R * rad], outline=255, width=max(1, int(R * w)))
    # légende circulaire
    legend = 'ORVIA  ·  OR  ·  ARGENT  ·  PLATINE  ·  '
    font = ImageFont.truetype(SERIF, int(R * 0.105))
    radius = R * 0.70
    widths = [font.getlength(ch) for ch in legend]
    total = sum(widths)
    pos = -math.pi / 2 - (total / 2) / radius * 0  # départ en haut
    k = (2 * math.pi * radius) / total  # étire pour faire tout le tour
    acc = 0.0
    for ch, w in zip(legend, widths):
        if ch.strip():
            a = pos + (acc + w / 2) * k / radius
            g = _glyph_mask(ch, font, -math.degrees(a) - 90)
            gx, gy = c + radius * math.cos(a) - g.width / 2, c + radius * math.sin(a) - g.height / 2
            relief.paste(255, (int(gx), int(gy)), g)
        acc += w
    # fleur de lys au-dessus du nom, et millésime en dessous
    lys = ImageFont.truetype(SYMBOLS, int(R * 0.30))
    g = _glyph_mask('\u269c', lys, 0)
    relief.paste(255, (int(c - g.width / 2), int(c - R * 0.56)), g)
    year = ImageFont.truetype(SERIF, int(R * 0.10))
    g = _glyph_mask('MMXXVI', year, 0)
    relief.paste(255, (int(c - g.width / 2), int(c + R * 0.36)), g)

    rel = np.asarray(relief.filter(ImageFilter.GaussianBlur(R * 0.006)), dtype=np.float32) / 255
    # hauteur : rebord surélevé, champ légèrement bombé, motifs frappés
    rim = np.clip((rr - 0.90) / 0.03, 0, 1) * np.clip((1.0 - rr) / 0.02, 0, 1) ** 0.5
    dome = (1 - np.clip(rr, 0, 1) ** 2) * 0.25
    h = (dome + rim * 0.9 + rel * 0.45) * inside
    rnd = np.random.default_rng(3)
    satin = np.asarray(
        Image.fromarray((rnd.random((n, n)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)),
        dtype=np.float32) / 255
    h += (satin - 0.5) * 0.004 * inside
    gy, gx = np.gradient(h * n * 0.18)
    nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.5, -0.65, 0.58]); L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    Hv = L + np.array([0, 0, 1.0]); Hv /= np.linalg.norm(Hv)
    spec = np.clip(nx * Hv[0] + ny * Hv[1] + nz * Hv[2], 0, 1) ** 60
    # reflet doux sur tout le champ, comme le métal poli
    sheen = np.exp(-(((xx - c * 0.8) / (R * 0.9)) ** 2 + ((yy - c * 0.75) / (R * 0.7)) ** 2))
    dark, mid, light = np.array([110, 70, 10]), np.array([212, 162, 48]), np.array([255, 228, 128])
    t = np.clip(diff * 0.85 + sheen * 0.18, 0, 1)[..., None]
    col = np.where(t < 0.62, dark + (mid - dark) * (t / 0.62), mid + (light - mid) * ((t - 0.62) / 0.38))
    col = col + spec[..., None] * np.array([255, 246, 215]) * 0.8
    col = np.clip(col, 0, 255).astype(np.uint8)
    alpha = np.clip((1.0 - rr) * R * 0.8, 0, 1) * 255  # bord anti-crénelé
    img = Image.fromarray(np.dstack([col, alpha.astype(np.uint8)]), 'RGBA')
    # ombre portée sous la pièce
    sh = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([c - R * 0.98 + n * 0.012, c - R * 0.98 + n * 0.02, c + R * 0.98 + n * 0.012,
                                c + R * 0.98 + n * 0.02], fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(n * 0.02))
    sh.alpha_composite(img)
    return sh.resize((size, size), Image.LANCZOS)


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
    base.alpha_composite(coin(S, scale))
    if text:
        with_text(base, 'Orvia', scale * 0.6)
    return base.resize((size, size), Image.LANCZOS)

if __name__ == '__main__':
    big = icon(1024, 0.86)
    big.save('assets/icon.png')
    big.resize((512, 512), Image.LANCZOS).save('public/icons/icon-512.png')
    big.resize((192, 192), Image.LANCZOS).save('public/icons/icon-192.png')
    big.resize((180, 180), Image.LANCZOS).save('public/icons/apple-touch-icon.png')
    big.resize((48, 48), Image.LANCZOS).save('assets/favicon.png')
    icon(512, 0.72).save('public/icons/maskable-512.png')         # zone sûre des icônes masquables
    icon(1024, 0.62, bg=False).save('assets/android-icon-foreground.png')  # zone sûre Android
    icon(1024, 0.5, bg=False).save('assets/splash-icon.png')
    icon(600, 0.88, bg=False).save('assets/logo.png')             # logo affiché dans l'appli
    mono = icon(1024, 0.62, text=False, bg=False)
    a = mono.split()[3]
    Image.merge('RGBA', [a.point(lambda v: 255)] * 3 + [a]).save('assets/android-icon-monochrome.png')
    print('ok')
