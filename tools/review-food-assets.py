#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "web" / "public" / "marketing-assets"


def image_data(image: Image.Image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


def review_asset(path: Path) -> str:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A")
    total = width * height
    values = list(image_data(alpha))
    transparent = sum(1 for value in values if value == 0)
    partial = sum(1 for value in values if 0 < value < 255)
    corners = [
        image.getpixel((0, 0))[3],
        image.getpixel((width - 1, 0))[3],
        image.getpixel((0, height - 1))[3],
        image.getpixel((width - 1, height - 1))[3],
    ]
    transparent_corners = all(value == 0 for value in corners)
    return (
        f"{path.name}: {width}x{height}, "
        f"transparent={transparent / total:.1%}, "
        f"soft-edge={partial / total:.1%}, "
        f"transparent-corners={transparent_corners}"
    )


def main() -> None:
    paths = sorted(
        path
        for pattern in ("*.png", "*.webp")
        for path in ASSET_DIR.glob(pattern)
        if path.is_file() and not path.name.startswith(".")
    )
    if not paths:
        print(f"No generated PNG assets found in {ASSET_DIR}")
        return
    for path in paths:
        print(review_asset(path))


if __name__ == "__main__":
    main()
