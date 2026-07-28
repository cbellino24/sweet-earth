#!/usr/bin/env python3
"""
Resize and recompress site images for web delivery — same filenames, no layout changes.
Run from repo root: python3 scripts/optimize_images.py
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"
BACKUP = ROOT / "images-originals"

# Longest edge caps (2× retina headroom; visually identical on site)
HERO_MAX = 2560
THUMB_MAX = 1600
AVATAR_MAX = 400
ICON_MAX = 512

JPEG_QUALITY = 88
WEBP_QUALITY = 88

HERO_IMAGES = {
    "omaha-1.jpg",
    "web-design-in-omaha-local-wordpress-support.jpg",
    "web-design-in-lincoln-nebraska.jpg",
    "bob-kerrey-pedestrian-bridge-web-design-omaha.jpg",
    "downtown-omaha-waterfountain.jpg",
    "downtown-omaha-restaurants-cws.jpg",
    "computer-services-in-omaha.jpg",
    "omaha-nebraska-web-creator-near-me.jpg",
    "lincoln-nebraska-web-design.jpg",
    "web-development-near-lincoln.jpg",
    "wordpress-web-design-2-omaha.jpg",
    "omaha-web-design-scompany.jpg",
    "omaha-web-design-scompany-fixed.jpg",
    "affordable-web-design-omaha-ne.png",
    "our-portfolio-ne-web-design-omaha.png",
    "local-business-website-design-omaha.png",
    "mac-nebraska-web-design-omaha.png",
    "drone-footage-services-omaha.jpg",
    "drone-services-omaha.jpg",
    "coffee-las-chilenas-local-coffee-shop.jpg",
    "coffee-shop-web-design-omaha.jpg",
}

THUMB_IMAGES = {
    "bellino-fireworks-in-omaha.jpg",
    "lincoln-tent-event-tent-rental-website-omaha-1.jpg",
    "lincoln-tent-event-tent-rental-website-omaha.jpg",
    "laschilenas-coffee-in-omaha.jpg",
    "lux-american-grill-omaha-restaurant-signage.jpg",
    "lawn-care-company-papillion.jpg",
    "tikal-market-en-omaha.jpg",
    "remington-painting-website-2.jpg",
    "reynoso-auto-repair-in-omaha.jpg",
    "integrity-diesel-weeping-water-ne.jpg",
    "ecommerce-website-omaha-goliath-hats.jpg-1.png",
    "ecommerce-website-omaha-goliath-hats.jpg.png",
    "jerzes-sports-bar-papillion.jpg",
    "las-chilenas-cover-picture.jpg",
    "lux-grill.JPG",
    "lux-phone-n-computer.png",
    "wedding-invitations-omaha.png",
    "website-maker-omaha-web-design.jpg",
    "Schuylar-nebraska-web-design.jpg",
    "schuylar-nebraska-web-desiners.jpg",
}

AVATAR_IMAGES = {
    "omaha-web-design-company-business-owner-omaha.jpg",
    "erik-soria-web-design-in-omaha.jpg",
    "christian-soria-omaha-web-designer-452-digital-co.jpg",
}

ICON_IMAGES = {
    "graphic-design-in-omaha-logo.png",
    "452-digital-web-design-omaha-qr-code.png",
    "adobe-photoshop-help-omaha.png",
    "adobe-in-design-help-omaha.png",
    "affordable-wedding-photographer-omaha.png",
    "final-cut-pro.png",
    "final-cut-pro-omaha.png",
    "logo-into-vector-file-omaha.png",
    "ADOBE-CREATIVE-CLOUD-HELP-OMAHA.PNG.png",
    "graphic-design-help-for-restaurant-omaha.png",
    "web-design-omaha-adobe-logos.png",
}


def max_edge_for(name: str) -> int:
    lower = name.lower()
    if name in AVATAR_IMAGES or lower in {x.lower() for x in AVATAR_IMAGES}:
        return AVATAR_MAX
    if name in ICON_IMAGES or lower in {x.lower() for x in ICON_IMAGES}:
        return ICON_MAX
    if name in THUMB_IMAGES or lower in {x.lower() for x in THUMB_IMAGES}:
        return THUMB_MAX
    if name in HERO_IMAGES or lower in {x.lower() for x in HERO_IMAGES}:
        return HERO_MAX
    return HERO_MAX


def resize_if_needed(im: Image.Image, max_edge: int) -> Image.Image:
    w, h = im.size
    longest = max(w, h)
    if longest <= max_edge:
        return im
    scale = max_edge / longest
    new_size = (max(1, round(w * scale)), max(1, round(h * scale)))
    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    return im.resize(new_size, resample)


def save_jpeg(im: Image.Image, path: Path) -> None:
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    im.save(
        path,
        "JPEG",
        quality=JPEG_QUALITY,
        optimize=True,
        progressive=True,
    )


def save_png(im: Image.Image, path: Path) -> None:
    if im.mode == "P":
        im = im.convert("RGBA")
    im.save(path, "PNG", optimize=True)


def save_webp(im: Image.Image, path: Path) -> None:
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    im.save(path, "WEBP", quality=WEBP_QUALITY, method=6)


def optimize_file(path: Path) -> tuple[int, int, str]:
    before = path.stat().st_size
    max_edge = max_edge_for(path.name)
    suffix = path.suffix.lower()

    with Image.open(path) as src:
        im = resize_if_needed(src, max_edge)
        orig_size = src.size
        new_size = im.size

        # Backup once before overwriting
        backup_path = BACKUP / path.name
        if not backup_path.exists():
            BACKUP.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup_path)

        if suffix in (".jpg", ".jpeg"):
            save_jpeg(im, path)
        elif suffix == ".png":
            save_png(im, path)
        elif suffix == ".webp":
            save_webp(im, path)
        else:
            return before, before, "skip"

        # WebP companion for modern browsers (same basename)
        if suffix in (".jpg", ".jpeg", ".png"):
            webp_path = path.with_suffix(".webp")
            save_webp(im, webp_path)

    after = path.stat().st_size
    detail = f"{orig_size[0]}x{orig_size[1]} -> {new_size[0]}x{new_size[1]}"
    return before, after, detail


def scan_html_thumb_names() -> set[str]:
    names: set[str] = set()
    img_re = re.compile(r'<img\b[^>]*\bsrc="/images/([^"?]+)[^"]*"[^>]*\bwidth="(\d+)"', re.I)
    for html in ROOT.glob("*.html"):
        text = html.read_text(encoding="utf-8", errors="ignore")
        for src, width in img_re.findall(text):
            if int(width) <= 900:
                names.add(Path(src).name)
    return names


def main() -> None:
    extra_thumbs = scan_html_thumb_names()
    THUMB_IMAGES.update(extra_thumbs)

    total_before = 0
    total_after = 0
    rows: list[str] = []

    patterns = ("*.jpg", "*.jpeg", "*.JPG", "*.JPEG", "*.png", "*.PNG", "*.webp")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(IMAGES.glob(pattern))
    files = sorted(set(files))

    for path in files:
        if path.suffix.lower() == ".webp" and path.with_suffix(".jpg").exists():
            continue
        if path.suffix.lower() == ".webp" and path.with_suffix(".png").exists():
            continue
        try:
            before, after, detail = optimize_file(path)
            total_before += before
            total_after += after
            pct = 100 * (1 - after / before) if before else 0
            rows.append(f"  {before // 1024:5d}KB -> {after // 1024:5d}KB ({pct:4.0f}%)  {path.name}  [{detail}]")
        except Exception as exc:
            rows.append(f"  ERROR  {path.name}: {exc}")

    print("Image optimization complete\n")
    for row in rows:
        print(row)
    print(
        f"\nTotal: {total_before / 1024 / 1024:.1f} MB -> {total_after / 1024 / 1024:.1f} MB "
        f"({100 * (1 - total_after / total_before):.0f}% smaller)"
    )
    print(f"Originals backed up to: {BACKUP}")


if __name__ == "__main__":
    main()
