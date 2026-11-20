from pathlib import Path
import re
import argparse

from PIL import Image, ImageDraw, ImageFont


WORKSPACE = Path(__file__).resolve().parents[1]
DEFAULT_INBOX = WORKSPACE / "design" / "00_سكرينات_جديدة_inbox"
OUTPUT = Path(r"C:\Users\و\.codex\visualizations\2026\11\18\01a1ed77-f527-7813-9967-07467b3c65d3")


def screen_number(path: Path) -> int:
    match = re.search(r"(\d+)", path.stem)
    return int(match.group(1)) if match else 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INBOX)
    parser.add_argument("--glob", default="ScreenHunter *.png")
    parser.add_argument("--prefix", default="new-inbox-contact")
    args = parser.parse_args()
    files = sorted(args.input.glob(args.glob), key=lambda item: item.name.casefold())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=22)
    columns, rows = 4, 5
    thumb_w, thumb_h, label_h = 360, 520, 42
    margin, gap = 24, 18

    for page_index in range(0, len(files), columns * rows):
        page_files = files[page_index : page_index + columns * rows]
        canvas_w = margin * 2 + columns * thumb_w + (columns - 1) * gap
        canvas_h = margin * 2 + rows * (thumb_h + label_h) + (rows - 1) * gap
        canvas = Image.new("RGB", (canvas_w, canvas_h), "#ece7dc")
        draw = ImageDraw.Draw(canvas)

        for item_index, image_path in enumerate(page_files):
            row, column = divmod(item_index, columns)
            x = margin + column * (thumb_w + gap)
            y = margin + row * (thumb_h + label_h + gap)
            with Image.open(image_path) as source:
                preview = source.convert("RGB")
                preview.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                paste_x = x + (thumb_w - preview.width) // 2
                paste_y = y + (thumb_h - preview.height) // 2
                canvas.paste(preview, (paste_x, paste_y))
            draw.rectangle((x, y, x + thumb_w, y + thumb_h), outline="#6f664f", width=2)
            label = image_path.stem.replace("ScreenHunter ", "Screen ")
            draw.text((x + 8, y + thumb_h + 8), label, fill="#29261e", font=font)

        page_number = page_index // (columns * rows) + 1
        canvas.save(OUTPUT / f"{args.prefix}-{page_number:02d}.jpg", quality=88, optimize=True)

    print(f"Created {(len(files) + columns * rows - 1) // (columns * rows)} contact sheets for {len(files)} screenshots.")


if __name__ == "__main__":
    main()
