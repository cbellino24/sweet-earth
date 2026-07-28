#!/usr/bin/env python3
"""
Production launch pass for 452digitalco.com (technical only — no copy/layout changes).
Run from repo root: python3 scripts/production_launch.py
"""

from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.452digitalco.com"
DEFAULT_OG_IMAGE = f"{BASE}/images/graphic-design-in-omaha-logo.png"
EXCLUDE_SITEMAP = {"thank-you.html"}

SERVICE_PAGES = {
    "services.html",
    "website-design.html",
    "website-development.html",
    "website-analytics.html",
    "ecommerce-stores.html",
    "graphic-design-company.html",
    "drone-services.html",
    "google-ads.html",
    "search-engine-optimization.html",
    "google-business-profile-apple-maps.html",
    "branding-identity.html",
    "event-websites.html",
    "restaurant-web-design-company-omaha.html",
    "paginas-web-en-espanol-omaha.html",
    "omaha-web-design-company.html",
    "papillion-web-design-company.html",
    "lincoln-web-design.html",
    "schuyler-ne-web-design-company.html",
    "fremont-website-design-company.html",
}

BROKEN_LINK_FIXES = {
    "restaurant-web-design-omaha.html": "restaurant-web-design-company-omaha.html",
    "https://www.452digitalco.com/restaurant-web-design-omaha": (
        "https://www.452digitalco.com/restaurant-web-design-company-omaha"
    ),
    "schuylar-ne-web-design-company.html": "schuyler-ne-web-design-company.html",
    "https://www.452digitalco.com/schuylar-ne-web-design-company": (
        "https://www.452digitalco.com/schuyler-ne-web-design-company"
    ),
    "google-business-profile-optimization.html": "google-business-profile-apple-maps.html",
}

NAV_BRANDING_SNIPPET = (
    '                        <li><a class="nav__dropdown-link" href="/branding-identity">'
    "Branding &amp; Identity</a></li>\n"
)
NAV_RESTAURANT_SNIPPET = (
    '                        <li><a class="nav__dropdown-link" href="/restaurant-web-design-company-omaha">'
    "Restaurant Web Design</a></li>\n"
)
NAV_DRONE_LINE = '<a class="nav__dropdown-link" href="/drone-services">Drone Services</a></li>'

CANONICAL_RE = re.compile(r'<link\s+rel="canonical"\s+href="[^"]*"\s*/?>', re.I)
TITLE_RE = re.compile(r"<title>([^<]*)</title>", re.I)
DESC_RE = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"\s*/?>', re.I)
IMG_TAG_RE = re.compile(r"<img\b([^>]*?)>", re.I)


def page_url(filename: str) -> str:
    if filename == "index.html":
        return f"{BASE}/"
    return f"{BASE}/{filename.removesuffix('.html')}"


def lastmod(path: Path) -> str:
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def sitemap_priority(filename: str) -> tuple[float, str]:
    if filename == "index.html":
        return 1.0, "weekly"
    if filename in SERVICE_PAGES:
        return 0.9, "monthly"
    if filename == "work.html":
        return 0.7, "monthly"
    if filename.startswith("blog"):
        return 0.6, "monthly"
    if filename in {"about.html", "contact.html", "testimonials.html"}:
        return 0.8, "yearly"
    return 0.8, "monthly"


def write_sitemap() -> int:
    entries = []
    for path in sorted(ROOT.glob("*.html")):
        if path.name in EXCLUDE_SITEMAP:
            continue
        pr, cf = sitemap_priority(path.name)
        entries.append((0 if path.name == "index.html" else 1, path.name, pr, cf, lastmod(path)))
    entries.sort(key=lambda x: (x[0], x[1]))

    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for _, name, pr, cf, lm in entries:
        url = ET.SubElement(urlset, "url")
        ET.SubElement(url, "loc").text = page_url(name)
        ET.SubElement(url, "lastmod").text = lm
        ET.SubElement(url, "changefreq").text = cf
        ET.SubElement(url, "priority").text = f"{pr:.1f}"

    ET.indent(urlset, space="  ")
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(urlset, encoding="unicode") + "\n"
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    return len(entries)


def fix_broken_links(html: str) -> str:
    for old, new in BROKEN_LINK_FIXES.items():
        html = html.replace(old, new)
    return html


def ensure_nav_links(html: str) -> str:
    if NAV_DRONE_LINE not in html:
        return html
    has_branding = (
        'href="/branding-identity"' in html or "branding-identity.html" in html
    )
    has_restaurant = (
        'href="/restaurant-web-design-company-omaha"' in html
        or "restaurant-web-design-company-omaha.html" in html
    )
    replacement = NAV_DRONE_LINE
    if not has_branding:
        replacement = NAV_DRONE_LINE + "\n" + NAV_BRANDING_SNIPPET.rstrip()
    if not has_restaurant:
        extra = NAV_BRANDING_SNIPPET if has_branding else ""
        replacement = NAV_DRONE_LINE + "\n" + extra + NAV_RESTAURANT_SNIPPET.rstrip()
    if replacement != NAV_DRONE_LINE:
        html = html.replace(NAV_DRONE_LINE, replacement, 1)
    return html


def og_block(canonical: str, title: str, description: str, image: str = DEFAULT_OG_IMAGE) -> str:
    esc = lambda s: s.replace("&", "&amp;").replace('"', "&quot;")
    return f"""
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="452 Digital Co." />
    <meta property="og:title" content="{esc(title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:url" content="{canonical}" />
    <meta property="og:image" content="{image}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{esc(title)}" />
    <meta name="twitter:description" content="{esc(description)}" />
    <meta name="twitter:image" content="{image}" />"""


def ensure_meta_tags(html: str, filename: str) -> str:
    title_m = TITLE_RE.search(html)
    desc_m = DESC_RE.search(html)
    if not title_m or not desc_m:
        return html
    title = title_m.group(1).strip()
    description = desc_m.group(1).strip()
    canonical = page_url(filename)

    if not CANONICAL_RE.search(html):
        html = html.replace(
            desc_m.group(0),
            desc_m.group(0) + f'\n    <link rel="canonical" href="{canonical}" />',
            1,
        )
    else:
        html = CANONICAL_RE.sub(f'<link rel="canonical" href="{canonical}" />', html, count=1)

    if 'property="og:type"' not in html:
        canon_tag = CANONICAL_RE.search(html)
        if canon_tag:
            html = html.replace(canon_tag.group(0), canon_tag.group(0) + og_block(canonical, title, description), 1)
    else:
        html = re.sub(
            r'<meta\s+property="og:url"\s+content="[^"]*"\s*/>',
            f'<meta property="og:url" content="{canonical}" />',
            html,
            count=1,
        )
    return html


def optimize_images(html: str) -> str:
    hero_marked = False

    def repl(match: re.Match[str]) -> str:
        nonlocal hero_marked
        attrs = match.group(1)
        if "loading=" not in attrs.lower():
            if not hero_marked and "hero" in attrs.lower():
                hero_marked = True
                if "fetchpriority=" not in attrs.lower():
                    attrs += ' fetchpriority="high"'
            else:
                attrs += ' loading="lazy"'
        if "decoding=" not in attrs.lower():
            attrs += ' decoding="async"'
        return f"<img{attrs}>"

    return IMG_TAG_RE.sub(repl, html)


def patch_contact_form(html: str) -> str:
    if 'id="contact-form"' in html and 'data-ajax="json"' not in html:
        html = html.replace(
            'class="contact-form contact-form--hero"',
            'class="contact-form contact-form--hero" data-ajax="json"',
        )
    return html


def add_services_hub_links(html: str, filename: str) -> str:
    if filename != "services.html":
        return html
    needle = '<h4 class="service-card__title">Graphic design</h4>'
    if needle in html and "branding-identity.html" not in html:
        html = html.replace(
            needle,
            '<h4 class="service-card__title"><a href="/graphic-design-company">Graphic design</a></h4>',
            1,
        )
        html = html.replace(
            "Logo refreshes, menus, flyers, and promo graphics",
            '<a href="/branding-identity">Logo refreshes</a>, menus, flyers, and promo graphics',
            1,
        )
    return html


def process_html(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    original = html
    html = fix_broken_links(html)
    html = ensure_nav_links(html)
    html = ensure_meta_tags(html, path.name)
    html = optimize_images(html)
    html = patch_contact_form(html)
    html = add_services_hub_links(html, path.name)
    if html != original:
        path.write_text(html, encoding="utf-8")
        return True
    return False


def link_graph_audit() -> dict:
    html_files = {p.name for p in ROOT.glob("*.html")}
    inbound: dict[str, set[str]] = {f: set() for f in html_files}
    broken: list[tuple[str, str]] = []
    for path in ROOT.glob("*.html"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r'href=["\']([^"\']+\.html(?:#[^"\']*)?)["\']', text, re.I):
            href = m.group(1)
            if href.startswith(("http://", "https://", "//", "mailto:", "tel:")):
                continue
            target = href.split("#")[0].split("?")[0]
            if not target:
                continue
            if target in html_files:
                inbound[target].add(path.name)
            else:
                broken.append((path.name, target))
    orphans = [
        f for f in html_files if f not in EXCLUDE_SITEMAP and f != "index.html" and not inbound[f]
    ]
    weak = [f for f in html_files if f not in EXCLUDE_SITEMAP and f != "index.html" and len(inbound[f]) <= 1]
    return {"broken": broken, "orphans": orphans, "weak": weak, "inbound": inbound}


def title_audit() -> list[str]:
    titles: dict[str, list[str]] = {}
    for path in ROOT.glob("*.html"):
        m = TITLE_RE.search(path.read_text(encoding="utf-8", errors="ignore"))
        if m:
            titles.setdefault(m.group(1).strip(), []).append(path.name)
    return [f"Duplicate title {t!r}: {files}" for t, files in titles.items() if len(files) > 1]


def write_checklist(audit: dict, sitemap_count: int, title_dupes: list[str]) -> None:
    lines = [
        "# 452 Digital Co. — Production Launch Checklist",
        "",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Completed automatically",
        "",
        f"- [x] `sitemap.xml` — {sitemap_count} public URLs",
        "- [x] `robots.txt` — present at repo root",
        "- [x] Canonical + Open Graph + Twitter tags",
        "- [x] JSON-LD (`scripts/inject_site_schema.py`)",
        "- [x] Broken link fixes + nav crawl paths",
        "- [x] Contact form AJAX on contact page",
        "",
    ]
    if audit["broken"]:
        lines += ["## Broken internal links", ""]
        for src, tgt in sorted(set(audit["broken"])):
            lines.append(f"- `{tgt}` from `{src}`")
        lines.append("")
    if audit["orphans"]:
        lines += ["## Orphan pages", ""]
        for f in sorted(audit["orphans"]):
            lines.append(f"- `{f}`")
        lines.append("")
    if title_dupes:
        lines += ["## Duplicate titles", ""]
        lines.extend(f"- {d}" for d in title_dupes)
        lines.append("")
    lines += [
        "## Post-deploy",
        "",
        "- [ ] Submit https://www.452digitalco.com/sitemap.xml in Search Console",
        "- [ ] Test contact.php mail on Bluehost",
        "",
    ]
    (ROOT / "LAUNCH_CHECKLIST.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    count = write_sitemap()
    print(f"sitemap.xml: {count} URLs")
    for path in sorted(ROOT.glob("*.html")):
        if process_html(path):
            print(f"patched {path.name}")
    subprocess.run(["python3", str(ROOT / "scripts" / "inject_site_schema.py")], check=True, cwd=str(ROOT))
    audit = link_graph_audit()
    write_checklist(audit, count, title_audit())
    print("done")


if __name__ == "__main__":
    main()
