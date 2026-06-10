#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def parse_key_color(value: str) -> str | tuple[int, int, int]:
    if value == "auto-border":
        return value
    cleaned = value.strip().lstrip("#")
    if len(cleaned) != 6:
        raise argparse.ArgumentTypeError(
            "Expected auto-border or a 6-digit hex color like #ff00ff"
        )
    return tuple(int(cleaned[index : index + 2], 16) for index in (0, 2, 4))


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 1.0 if value >= edge1 else 0.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def image_data(image: Image.Image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


def remove_key(
    input_path: Path,
    output_path: Path,
    key: str | tuple[int, int, int],
    transparent_threshold: float,
    opaque_threshold: float,
) -> dict[str, int | float | bool]:
    image = Image.open(input_path).convert("RGBA")
    if key == "auto-border":
        key = sample_border_key(image)
    pixels = []
    transparent_count = 0
    partial_count = 0

    for red, green, blue, alpha in image_data(image):
        distance = math.sqrt(
            (red - key[0]) ** 2 + (green - key[1]) ** 2 + (blue - key[2]) ** 2
        )
        if distance <= transparent_threshold:
            pixels.append((red, green, blue, 0))
            transparent_count += 1
            continue
        if distance < opaque_threshold:
            factor = smoothstep(transparent_threshold, opaque_threshold, distance)
            next_alpha = int(alpha * factor)
            pixels.append((red, green, blue, next_alpha))
            partial_count += 1
            continue
        pixels.append((red, green, blue, alpha))

    image.putdata(pixels)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)

    width, height = image.size
    corners = [
        image.getpixel((0, 0))[3],
        image.getpixel((width - 1, 0))[3],
        image.getpixel((0, height - 1))[3],
        image.getpixel((width - 1, height - 1))[3],
    ]
    total = width * height
    return {
        "width": width,
        "height": height,
        "transparentPixels": transparent_count,
        "partialPixels": partial_count,
        "transparentCoverage": round(transparent_count / total, 4),
        "transparentCorners": all(alpha == 0 for alpha in corners),
    }


def median(values: list[int]) -> int:
    values = sorted(values)
    return values[len(values) // 2]


def sample_border_key(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    sample_width = max(2, min(width, height) // 40)
    samples: list[tuple[int, int, int]] = []

    for x in range(width):
        for y in range(sample_width):
            samples.append(image.getpixel((x, y))[:3])
            samples.append(image.getpixel((x, height - 1 - y))[:3])

    for y in range(height):
        for x in range(sample_width):
            samples.append(image.getpixel((x, y))[:3])
            samples.append(image.getpixel((width - 1 - x, y))[:3])

    reds = [sample[0] for sample in samples]
    greens = [sample[1] for sample in samples]
    blues = [sample[2] for sample in samples]
    return (median(reds), median(greens), median(blues))


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove a flat chroma-key background.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--key-color", default="auto-border", type=parse_key_color)
    parser.add_argument("--transparent-threshold", default=20.0, type=float)
    parser.add_argument("--opaque-threshold", default=115.0, type=float)
    args = parser.parse_args()

    report = remove_key(
        args.input,
        args.out,
        args.key_color,
        args.transparent_threshold,
        args.opaque_threshold,
    )
    print(
        f"{args.out}: {report['width']}x{report['height']}, "
        f"transparent coverage {report['transparentCoverage']}, "
        f"transparent corners {report['transparentCorners']}"
    )


if __name__ == "__main__":
    main()
