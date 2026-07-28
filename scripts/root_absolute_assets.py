#!/usr/bin/env python3
"""Convert relative site asset paths to root-absolute (/css/..., /images/..., etc.)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ASSET_PREFIXES = ("css/", "js/", "images/", "fonts/", "videos/", "assets/")
ROOT_HANDLERS = ("contact.php", "newsletter-handler.php")

HTML_ATTRS = (
    "href",
    "src",
    "content",
    "poster",
    "data-src",
    "data-poster",
    "data-bg",
    "action",
)

INLINE_URL_RE = re.compile(
    r"url\((?P<q>['\"]?)(?P<path>(?:\.\./|\./)?(?:css|js|images|fonts|videos|assets)/[^)'\"]+)(?P=q)?\)",
    re.IGNORECASE,
)

ATTR_RE = re.compile(
    r"(?P<attr>"
    + "|".join(HTML_ATTRS)
    + r")=(?P<quote>['\"])(?P<val>.*?)(?P=quote)",
    re.IGNORECASE,
)

CSS_URL_RE = re.compile(
    r"url\((?P<q>['\"]?)(?P<path>(?:\.\./|\./)?(?:css|js|images|fonts|videos|assets)/[^)'\"]+)(?P=q)?\)",
    re.IGNORECASE,
)


def normalize_path(val: str) -> str:
    v = val.strip()
    if not v:
        return v
    lower = v.lower()
    if lower.startswith(
        ("/", "#", "http://", "https://", "mailto:", "tel:", "data:", "javascript:")
    ):
        return v
    while v.startswith("./"):
        v = v[2:]
    while v.startswith("../"):
        v = v[3:]
    if v in ROOT_HANDLERS:
        return "/" + v
    if any(v.startswith(p) for p in ASSET_PREFIXES):
        return "/" + v
    return val


def fix_inline_urls(text: str) -> tuple[str, int]:
    changes = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal changes
        q, path = m.group("q"), m.group("path")
        new_path = normalize_path(path)
        if new_path == path:
            return m.group(0)
        changes += 1
        if q:
            return f"url({q}{new_path}{q})"
        return f"url({new_path})"

    return INLINE_URL_RE.sub(repl, text), changes


def fix_html(text: str) -> tuple[str, int]:
    text, inline_n = fix_inline_urls(text)
    changes = inline_n

    def repl(m: re.Match[str]) -> str:
        nonlocal changes
        attr, quote, val = m.group("attr"), m.group("quote"), m.group("val")
        # Only rewrite content= when it looks like a file path, not plain text URLs in OG that are full
        if attr.lower() == "content" and not any(
            val.startswith(p) or val.startswith("../" + p[3:]) or val.startswith("./" + p)
            for p in ASSET_PREFIXES
        ):
            if not val.startswith(("../", "./")) or not any(
                p in val for p in ("css/", "js/", "images/", "fonts/", "videos/", "assets/")
            ):
                return m.group(0)
        new_val = normalize_path(val)
        if new_val != val:
            changes += 1
        return f"{attr}={quote}{new_val}{quote}"

    text = ATTR_RE.sub(repl, text)
    return text, changes


def fix_css(text: str) -> tuple[str, int]:
    changes = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal changes
        q, path = m.group("q"), m.group("path")
        new_path = normalize_path(path)
        if new_path == path:
            return m.group(0)
        changes += 1
        if q:
            return f"url({q}{new_path}{q})"
        return f"url({new_path})"

    return CSS_URL_RE.sub(repl, text), changes


def main() -> None:
    total = 0
    for path in sorted(ROOT.glob("*.html")):
        text = path.read_text(encoding="utf-8")
        new_text, n = fix_html(text)
        if n:
            path.write_text(new_text, encoding="utf-8")
            print(f"{path.name}: {n} html attr(s)")
            total += n

    for path in sorted((ROOT / "css").glob("*.css")):
        text = path.read_text(encoding="utf-8")
        new_text, n = fix_css(text)
        if n:
            path.write_text(new_text, encoding="utf-8")
            print(f"css/{path.name}: {n} url(s)")
            total += n

    print(f"Done. {total} replacement(s).")


if __name__ == "__main__":
    main()
