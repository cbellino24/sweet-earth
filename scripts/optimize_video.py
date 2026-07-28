#!/usr/bin/env python3
"""Compress hero/background MP4s for web. Run: python3 scripts/optimize_video.py"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "videos"

# Background hero: 1280p is plenty behind overlays; muted autoplay needs no audio track.
SCALE = "1280:-2"
CRF = "28"


def get_ffmpeg() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def optimize(path: Path, ffmpeg: str) -> None:
    backup = path.with_suffix(path.suffix + ".original")
    tmp = path.with_suffix(".optimized" + path.suffix)
    if not backup.exists():
        shutil.copy2(path, backup)

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(backup if backup.exists() else path),
        "-vf",
        f"scale={SCALE}",
        "-c:v",
        "libx264",
        "-crf",
        CRF,
        "-preset",
        "slow",
        "-movflags",
        "+faststart",
        "-an",
        str(tmp),
    ]
    subprocess.run(cmd, check=True)
    before = path.stat().st_size
    shutil.move(tmp, path)
    after = path.stat().st_size
    print(f"{path.name}: {before // 1024 // 1024}MB -> {after // 1024 // 1024}MB")


def main() -> None:
    ffmpeg = get_ffmpeg()
    targets = list(VIDEOS.glob("*.mp4"))
    if not targets:
        print("No MP4 files in videos/")
        return
    for path in targets:
        if path.name.endswith(".original.mp4"):
            continue
        optimize(path, ffmpeg)


if __name__ == "__main__":
    main()
