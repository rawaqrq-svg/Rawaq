from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "design" / "جاهز_للمتجر_studio_webp" / "batch-78-194"
DEFAULT_PUBLIC = ROOT / "public" / "images" / "products" / "batch-78-194"


def white_canvas(source: Image.Image, size: int) -> Image.Image:
    image = source.convert("RGB")
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (size, size), "#ffffff")
    canvas.paste(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


def corner_is_white(image: Image.Image, tolerance: int = 12) -> bool:
    pixels = image.convert("RGB")
    points = ((0, 0), (pixels.width - 1, 0), (0, pixels.height - 1), (pixels.width - 1, pixels.height - 1))
    return all(all(channel >= 255 - tolerance for channel in pixels.getpixel(point)) for point in points)


def perceptual_key(image: Image.Image) -> str:
    sample = image.convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    digest = hashlib.sha256(sample.tobytes()).hexdigest()
    return digest


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and publish white-background studio catalog images.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--public", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--size", type=int, default=1200)
    parser.add_argument("--quality", type=int, default=92)
    args = parser.parse_args()

    source_files = sorted(args.source.glob("*.png"))
    if not source_files:
        raise SystemExit(f"No PNG files found in {args.source}")

    args.public.mkdir(parents=True, exist_ok=True)
    report: list[dict[str, object]] = []
    seen: dict[str, str] = {}

    for source_path in source_files:
        with Image.open(source_path) as opened:
            image = opened.convert("RGB")
            prepared = white_canvas(image, args.size)
            key = perceptual_key(prepared)
            duplicate_of = seen.get(key)
            if duplicate_of is None:
                seen[key] = source_path.name
            target_path = args.public / f"{source_path.stem}.webp"
            prepared.save(target_path, "WEBP", quality=args.quality, method=4)
            report.append(
                {
                    "source": source_path.name,
                    "target": target_path.name,
                    "source_size": [image.width, image.height],
                    "published_size": [prepared.width, prepared.height],
                    "white_corners": corner_is_white(prepared),
                    "duplicate_of": duplicate_of,
                }
            )

    report_path = args.public / "studio-image-audit.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failures = [item for item in report if not item["white_corners"]]
    duplicates = [item for item in report if item["duplicate_of"]]
    print(f"Published {len(report)} images to {args.public}")
    print(f"White-corner failures: {len(failures)}")
    print(f"Exact thumbnail duplicates: {len(duplicates)}")
    print(f"Audit: {report_path}")


if __name__ == "__main__":
    main()
