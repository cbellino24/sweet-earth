"""Build HD transparent SVG logos from logo-2.png."""
import base64
import os
from io import BytesIO

from PIL import Image

SRC = r"c:\Users\chris\OneDrive\Desktop\sweet-earth-delight-design\images\logo-2.png"
OUT_DIR = r"c:\Users\chris\OneDrive\Desktop\sweet-earth-delight-design\images"
PAD = 24


def load_clean_rgba(path):
    img = Image.open(path).convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 16:
                px[x, y] = (0, 0, 0, 0)
            elif r + g + b < 40:
                px[x, y] = (0, 0, 0, 0)
    return img


def crop_to_content(img, padding=PAD):
    bbox = img.getbbox()
    if not bbox:
        return img
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(img.width, bbox[2] + padding)
    bottom = min(img.height, bbox[3] + padding)
    return img.crop((left, top, right, bottom))


def png_to_b64(img):
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def write_svg(path, width, height, body, title="Sweet Earth Delights"):
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 {width} {height}"
     width="{width}" height="{height}"
     role="img" aria-label="{title}">
  <title>{title}</title>
{body}
</svg>"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    img = crop_to_content(load_clean_rgba(SRC))
    w, h = img.size
    b64 = png_to_b64(img)

    transparent_png = os.path.join(OUT_DIR, "logo-transparent.png")
    img.save(transparent_png, format="PNG", optimize=True)

    logo_body = f'  <image width="{w}" height="{h}" href="data:image/png;base64,{b64}"/>'
    write_svg(os.path.join(OUT_DIR, "logo.svg"), w, h, logo_body)

    hero_body = f"""  <defs>
    <filter id="hero-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="rgba(0,0,0,0.55)"/>
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>
  <g filter="url(#hero-glow)">
    <image width="{w}" height="{h}" href="data:image/png;base64,{b64}"/>
  </g>"""
    write_svg(os.path.join(OUT_DIR, "logo-hero.svg"), w, h, hero_body)

    write_svg(
        os.path.join(OUT_DIR, "logo-embedded.svg"),
        w,
        h,
        logo_body,
    )

    print(f"Source: {SRC}")
    print(f"Output size: {w}x{h}")
    print(f"Created {transparent_png} ({os.path.getsize(transparent_png)} bytes)")
    print(f"Created logo.svg ({os.path.getsize(os.path.join(OUT_DIR, 'logo.svg'))} bytes)")
    print(f"Created logo-hero.svg ({os.path.getsize(os.path.join(OUT_DIR, 'logo-hero.svg'))} bytes)")


if __name__ == "__main__":
    main()
