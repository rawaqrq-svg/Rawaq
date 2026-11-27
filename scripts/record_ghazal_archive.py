"""Record completed screenshot moves in the Ghazal workbook."""

from pathlib import Path
import re

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "RAWAQ_Ghazal_Products.xlsx"
ARCHIVE = ROOT.parent / "design" / "07_سكرينات_مكتملة_done"

workbook = load_workbook(BOOK)
images = workbook["Images"]
moved = 0

for row in range(2, images.max_row + 1):
    name = str(images.cell(row, 1).value or "")
    match = re.fullmatch(r"ScreenHunter (\d+)\.png", name)
    if not match or not 209 <= int(match.group(1)) <= 356:
        continue
    archived = ARCHIVE / name
    if archived.exists():
        images.cell(row, 2, str(archived))
        images.cell(row, 10, "مؤرشف في سكرينات مكتملة")
        moved += 1
    else:
        images.cell(row, 10, "باقٍ للمراجعة")

workbook.save(BOOK)
print(f"Recorded {moved} archived screenshots")
