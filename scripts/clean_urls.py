#!/usr/bin/env python3
"""Rewrite internal .html links and canonicals to extensionless URLs."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.452digitalco.com"

HREF_RE = re.compile(
    r'href="((?:https://452digitalco\.com/)?)([^"?]+?)\.html([^"]*)"', re.I
)
CANONICAL_RE = re.compile(
    r'(<link\s+rel="canonical"\s+href=")https://452digitalco\.com/([^"]*?)\.html(")', re.I
)
OG_URL_RE = re.compile(
    r'(<meta\s+property="og:url"\s+content=")https://452digitalco\.com/([^"]*?)\.html(")', re.I
)
ABS_URL_RE = re.compile(r"https://452digitalco\.com/([a-z0-9\-]+)\.html", re.I)


def clean_path(stem: str) -> str:
    if stem in ("", "index"):
        return "/"
    return f"/{stem}"


def patch_href(match: re.Match[str]) -> str:
    prefix, stem, suffix = match.group(1), match.group(2), match.group(3)
    path = clean_path(stem)
    if prefix:
        return f'href="{BASE}{path}{suffix}"'
    return f'href="{path}{suffix}"'


def patch_canonical(match: re.Match[str]) -> str:
    stem = match.group(2)
    path = clean_path(stem) if stem else "/"
    if path == "/":
        return f'{match.group(1)}{BASE}/{match.group(3)}'
    return f'{match.group(1)}{BASE}{path}{match.group(3)}'


def patch_text(text: str) -> str:
    text = HREF_RE.sub(patch_href, text)
    text = CANONICAL_RE.sub(patch_canonical, text)
    text = OG_URL_RE.sub(patch_canonical, text)

    def abs_sub(m: re.Match[str]) -> str:
        return f"{BASE}{clean_path(m.group(1))}"

    text = ABS_URL_RE.sub(abs_sub, text)
    return text


def main() -> None:
    targets: list[Path] = []
    targets.extend(ROOT.glob("*.html"))
    targets.extend(ROOT.glob("*.xml"))
    targets.extend((ROOT / "scripts").glob("*.py"))
    for name in ("contact.php", "newsletter-handler.php", "robots.txt", "LAUNCH_CHECKLIST.md"):
        p = ROOT / name
        if p.exists():
            targets.append(p)

    changed = 0
    for path in sorted(set(targets)):
        original = path.read_text(encoding="utf-8")
        updated = patch_text(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
            print(f"updated {path.relative_to(ROOT)}")
    print(f"done — {changed} file(s)")


if __name__ == "__main__":
    main()
