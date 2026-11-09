#!/usr/bin/env python3
"""Derive the delivery variants of the Earth, Moon and home-preview images.

The Light Study downloads every Earth and Moon map on first open. The source
maps (JPEG and PNG, see public/assets/earth/README.md and
public/assets/moon/README.md) stay in the repository as the record of what
NASA and three.js published; the site serves these WebP derivatives instead.
Phones get the 1K "compact" set, laptops the 2K set. Lossless WebP of the
normal map is larger than the JPEG, so every derivative here is lossy and was
checked on screen before it shipped (docs/texture-variants.md).

    python3 tools/build-texture-variants.py

Requires Pillow. Re-encodes deterministically from the sources listed below.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets'
EARTH = ROOT / 'earth'
MOON = ROOT / 'moon'

# (source, target, size or None, mode, save options)
VARIANTS = [
    (EARTH / 'normal.jpg', EARTH / 'normal-2k.webp', None, 'RGB', dict(quality=90)),
    (EARTH / 'normal.jpg', EARTH / 'normal-1k.webp', (1024, 512), 'RGB', dict(quality=90)),
    (EARTH / 'specular.jpg', EARTH / 'specular-2k.webp', None, 'L', dict(quality=85)),
    (EARTH / 'specular.jpg', EARTH / 'specular-1k.webp', (1024, 512), 'L', dict(quality=85)),
    (EARTH / 'lights-2k.webp', EARTH / 'lights-1k.webp', (1024, 512), 'RGB', dict(quality=90)),
    (EARTH / 'clouds-1k.png', EARTH / 'clouds-1k.webp', None, 'RGBA', dict(quality=85, alpha_quality=80)),
    (EARTH / 'clouds-1k.png', EARTH / 'clouds-512.webp', (512, 256), 'RGBA', dict(quality=85, alpha_quality=80)),
    (MOON / 'color-2k.jpg', MOON / 'color-2k.webp', None, 'RGB', dict(quality=85)),
    (MOON / 'color-2k.jpg', MOON / 'color-1k.webp', (1024, 512), 'RGB', dict(quality=85)),
    (MOON / 'height-1k.jpg', MOON / 'height-1k.webp', None, 'L', dict(quality=85)),
    (MOON / 'height-1k.jpg', MOON / 'height-512.webp', (512, 256), 'L', dict(quality=85)),
    (EARTH / 'home-preview.webp', EARTH / 'home-preview-720.webp', (720, 712), 'RGB', dict(quality=88)),
    (EARTH / 'home-preview.webp', EARTH / 'home-preview-480.webp', (480, 475), 'RGB', dict(quality=88)),
    (EARTH / 'home-preview.webp', EARTH / 'home-preview-320.webp', (320, 317), 'RGB', dict(quality=88)),
]


def main() -> None:
    for source, target, size, mode, options in VARIANTS:
        image = Image.open(source).convert(mode)
        if size:
            image = image.resize(size, Image.LANCZOS)
        image.save(target, 'WEBP', method=6, **options)
        print(f'{target.relative_to(ROOT)!s:32} {target.stat().st_size:>8} bytes')


if __name__ == '__main__':
    main()
