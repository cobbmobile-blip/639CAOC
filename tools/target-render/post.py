"""Finish rendered shots for the target folder: TGP overlay on the oblique shot, attribution on every image.

    python post.py cache/T10001/job.json

TGP: light blur and sensor noise, crosshair, and a data block (mode, target, slant range, altitude, bearing).
Every image gets the imagery attribution and the exercise marking. Writes out/<target>_<shot>_final.png.
"""
import json, math, os, random, sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")


def font(size):
    for f in ("consola.ttf", "cour.ttf", "arial.ttf"):
        try: return ImageFont.truetype(f, size)
        except OSError: pass
    return ImageFont.load_default()


def footer(im, text):
    d = ImageDraw.Draw(im); w, h = im.size; f = font(max(15, w // 100)); bar = f.size + 12
    d.rectangle([0, h - bar, w, h], fill=(0, 0, 0)); d.text((10, h - bar + 5), text, fill=(235, 235, 235), font=f)


VIEW = {"close": "CRITICAL ELEMENT VIEW", "orientation": "ORIENTATION VIEW", "tgp": "TGP VIEW"}
YEL = (255, 214, 10)


def header(im, job, s):
    d = ImageDraw.Draw(im); w = im.size[0]; f = font(max(16, w // 90))
    d.rectangle([0, 0, w, f.size + 14], fill=(0, 0, 0))
    d.text((10, 6), f"{job['target']}  {job['name'].upper()}  -  {VIEW.get(s['name'], s['name'].upper())}", fill=(235, 235, 235), font=f)


def north_and_scale(im, m_per_px):
    d = ImageDraw.Draw(im); w, h = im.size; u = max(1, w // 800); f = font(16 * u)
    x, y = w - 50 * u, 70 * u                                      # north arrow (images are rendered north up)
    d.polygon([(x, y - 30 * u), (x - 12 * u, y + 8 * u), (x, y), (x + 12 * u, y + 8 * u)], fill=(255, 255, 255), outline=(0, 0, 0))
    d.text((x - 6 * u, y + 12 * u), "N", fill=(255, 255, 255), font=f, stroke_width=2, stroke_fill=(0, 0, 0))
    target = w * m_per_px / 5; nice = max(v for v in (10, 20, 25, 50, 100, 200, 250, 500, 1000) if v <= target)
    L = nice / m_per_px; x0, y0 = 20 * u, h - 60 * u
    d.rectangle([x0, y0, x0 + L, y0 + 8 * u], fill=(255, 255, 255), outline=(0, 0, 0))
    d.rectangle([x0, y0, x0 + L / 2, y0 + 8 * u], fill=(0, 0, 0))
    d.text((x0, y0 - 22 * u), f"0      {nice} m", fill=(255, 255, 255), font=f, stroke_width=2, stroke_fill=(0, 0, 0))


def annotate_units(im, job, m_per_px):
    """Box and number every mission unit in an overhead shot (rendered centred on the target, north up), with a legend.
    Numbers instead of full labels keep dense sites (vehicle columns, batteries) readable, as on target-folder graphics."""
    d = ImageDraw.Draw(im); w, h = im.size; u = max(1, w // 800); f = font(15 * u); fl = font(14 * u)
    box = max(10 * u, 9 / m_per_px)                                # ~18 m box, never under 20 px
    shown = []
    for i, un in enumerate(job["units"], 1):
        x = math.radians(un["lon"] - job["lon"]) * 6378137 * math.cos(math.radians(job["lat"])); y = math.radians(un["lat"] - job["lat"]) * 6378137
        px, py = w / 2 + x / m_per_px, h / 2 - y / m_per_px
        if not (box < px < w - box and box < py < h - box): continue
        d.rectangle([px - box, py - box, px + box, py + box], outline=YEL, width=2 * u)
        tag = str(i); tw = d.textlength(tag, font=f)
        d.text((px - tw / 2, py - box - f.size - 4 * u), tag, fill=YEL, font=f, stroke_width=3, stroke_fill=(0, 0, 0))
        shown.append((i, un))
    if not shown: return
    lines = [f"{i:>2}  {un['type']}" for i, un in shown]          # legend, bottom right
    lh = fl.size + 5 * u; lw = max(d.textlength(t, font=fl) for t in lines) + 24 * u
    x0, y1 = w - lw - 14 * u, h - 40 * u; y0 = y1 - lh * len(lines) - 16 * u
    d.rectangle([x0, y0, x0 + lw, y1], fill=(0, 0, 0), outline=YEL, width=u)
    for k, t in enumerate(lines): d.text((x0 + 12 * u, y0 + 8 * u + k * lh), t, fill=YEL, font=fl)


def tgp(im, job, s):
    im = im.convert("L").filter(ImageFilter.GaussianBlur(0.7))
    px = im.load(); w, h = im.size
    for _ in range(w * h // 30):
        x, y = random.randrange(w), random.randrange(h); px[x, y] = max(0, min(255, px[x, y] + random.randint(-28, 28)))
    im = im.convert("RGB"); d = ImageDraw.Draw(im); c = (w // 2, h // 2); g = (240, 240, 240); f = font(18)
    for a, b in (((c[0] - 90, c[1]), (c[0] - 22, c[1])), ((c[0] + 22, c[1]), (c[0] + 90, c[1])), ((c[0], c[1] - 90), (c[0], c[1] - 22)), ((c[0], c[1] + 22), (c[0], c[1] + 90))):
        d.line([a, b], fill=g, width=2)
    d.rectangle([c[0] - 8, c[1] - 8, c[0] + 8, c[1] + 8], outline=g, width=2)
    lines = ["WHOT   NFOV   SIMULATED", f"TGT {job['target']}  {job['name'].upper()}",
             f"SLANT {s['slant_m'] / 1852:.1f} NM   ALT {s['altitude_m'] * 3.281:,.0f} FT   FROM {s['bearing_deg']:03d}"]
    for i, t in enumerate(lines): d.text((18, 70 + i * 24), t, fill=g, font=f)   # clear of the classification tag
    return im


def main(job_path):
    job = json.load(open(job_path))
    for s in job["shots"]:
        src = os.path.join(OUT, f"{job['target']}_{s['name']}.png")
        if not os.path.exists(src): continue
        meta = json.load(open(os.path.splitext(src)[0] + ".json"))
        im = Image.open(src).convert("RGB")
        if s["kind"] == "oblique": im = tgp(im, job, s)
        else:
            mpp = s["width_m"] / im.size[0]
            annotate_units(im, job, mpp); north_and_scale(im, mpp)
        header(im, job, s)
        footer(im, f"UNCLASSIFIED // EXERCISE - DCS WORLD SIMULATION    Imagery: {meta['attribution']}    Units: DCS World models")
        dst = os.path.join(OUT, f"{job['target']}_{s['name']}_final.png"); im.save(dst); print("wrote", os.path.basename(dst))


if __name__ == "__main__":
    main(sys.argv[1])
