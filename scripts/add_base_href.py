#!/usr/bin/env python3
"""Add <base href> so relative assets work on clean URLs like /about/."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE_TAG = '    <base href="https://www.452digitalco.com/">\n'
MARKER = '<base href="https://www.452digitalco.com">'


def main() -> None:
    for path in sorted(ROOT.glob("*.html")):
        text = path.read_text(encoding="utf-8")
        if MARKER in text:
            continue
        idx = text.lower().find("<meta charset")
        if idx == -1:
            print(f"skip {path.name}: no charset meta")
            continue
        end = text.find(">", idx) + 1
        text = text[:end] + "\n" + BASE_TAG + text[end:]
        path.write_text(text, encoding="utf-8")
        print(f"updated {path.name}")


if __name__ == "__main__":
    main()
