"""Build the database import manifest from finalized, priced workbook rows."""

import json
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "RAWAQ_Ghazal_Products.xlsx"
OUTPUT = Path(__file__).with_name("ghazal-batch-209-356.json")

workbook = load_workbook(BOOK, data_only=True)
products_sheet = workbook["Products"]
variants_sheet = workbook["Variants"]
images_sheet = workbook["Images"]

local_images = {
    (images_sheet.cell(row, 3).value, images_sheet.cell(row, 4).value): images_sheet.cell(row, 6).value
    for row in range(2, images_sheet.max_row + 1)
    if images_sheet.cell(row, 6).value
}

variants_by_ref: dict[str, list[dict[str, object]]] = {}
for row in range(2, variants_sheet.max_row + 1):
    if variants_sheet.cell(row, 12).value not in {"جاهز للاستيراد", "مضاف لقاعدة البيانات"}:
        continue
    ref = str(variants_sheet.cell(row, 1).value)
    option_en = variants_sheet.cell(row, 5).value
    image = local_images.get((ref, option_en), variants_sheet.cell(row, 9).value)
    if not image or not Path(str(image)).exists():
        raise FileNotFoundError(f"Variant image missing for {ref}: {image}")
    sale = variants_sheet.cell(row, 8).value
    cost = variants_sheet.cell(row, 7).value
    if sale is None or cost is None:
        raise ValueError(f"Priced variant is incomplete: {ref}")
    variants_by_ref.setdefault(ref, []).append({
        "nameAr": variants_sheet.cell(row, 4).value or "قياسي",
        "nameEn": variants_sheet.cell(row, 5).value or "Standard",
        "optionType": variants_sheet.cell(row, 3).value or "لا يوجد",
        "size": variants_sheet.cell(row, 6).value or "عبوة واحدة",
        "priceFils": round(float(sale) * 1000),
        "costFils": round(float(cost) * 1000),
        "imagePath": str(Path(str(image)).resolve()),
        "imageName": Path(str(image)).name,
        "sku": str(variants_sheet.cell(row, 13).value or f"{ref}-{ref.rsplit('-', 1)[-1]}"),
        "order": int(variants_sheet.cell(row, 10).value or 1),
    })

manifest: list[dict[str, object]] = []
for row in range(2, products_sheet.max_row + 1):
    if products_sheet.cell(row, 23).value not in {"جاهز للاستيراد", "مكتمل ومضاف"}:
        continue
    ref = str(products_sheet.cell(row, 1).value)
    variants = sorted(variants_by_ref.get(ref, []), key=lambda item: int(item["order"]))
    if not variants:
        raise ValueError(f"No ready variants for {ref}")
    manifest.append({
        "reference": ref,
        "slug": ref.lower().replace("_", "-"),
        "sku": ref,
        "nameAr": products_sheet.cell(row, 2).value,
        "nameEn": products_sheet.cell(row, 3).value,
        "brand": products_sheet.cell(row, 4).value,
        "category": products_sheet.cell(row, 6).value,
        "categoryMain": products_sheet.cell(row, 5).value,
        "shortDescription": products_sheet.cell(row, 13).value,
        "longDescription": products_sheet.cell(row, 14).value,
        "size": products_sheet.cell(row, 15).value,
        "optionType": products_sheet.cell(row, 18).value,
        "variants": variants,
    })

OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(manifest)} products and {sum(len(p['variants']) for p in manifest)} variants to {OUTPUT}")
