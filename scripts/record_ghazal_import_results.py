"""Write verified database IDs and public image URLs back to the workbook."""

import json
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "RAWAQ_Ghazal_Products.xlsx"
RESULTS = Path(__file__).with_name("ghazal-batch-209-356-results.json")

payload = json.loads(RESULTS.read_text(encoding="utf-8"))
products_from_db = payload["products"]

workbook = load_workbook(BOOK)
products = workbook["Products"]
variants = workbook["Variants"]
images = workbook["Images"]

for row in range(2, variants.max_row + 1):
    if variants.cell(row, 1).value == "GHAZAL-SCREEN-356" and not variants.cell(row, 13).value:
        variants.cell(row, 13, "GHAZAL-SCREEN-356-356")

product_rows = {products.cell(row, 1).value: row for row in range(2, products.max_row + 1)}
variant_rows = {variants.cell(row, 13).value: row for row in range(2, variants.max_row + 1)}
image_rows = {
    (images.cell(row, 3).value, images.cell(row, 4).value): row
    for row in range(2, images.max_row + 1)
}

for product in products_from_db:
    ref = product["sku"]
    row = product_rows.get(ref)
    if row is None:
        raise ValueError(f"Workbook product missing for imported SKU {ref}")
    ordered_variants = sorted(product["variants"], key=lambda item: item["sku"])
    public_urls = [item["mainImage"] for item in ordered_variants]
    products.cell(row, 20, public_urls[0])
    products.cell(row, 21, " | ".join(public_urls[1:]) if len(public_urls) > 1 else None)
    products.cell(row, 23, "مكتمل ومضاف")
    products.cell(row, 24, "تمت الإضافة")
    products.cell(row, 25, product["id"])
    products.cell(row, 26, str(product["createdAt"])[:10])
    products.cell(row, 27, "تم التحقق من عدم التكرار، وربط الصور العامة وعرض المورد غزل.")

    for variant in ordered_variants:
        variant_row = variant_rows.get(variant["sku"])
        if variant_row is None:
            raise ValueError(f"Workbook variant missing for imported SKU {variant['sku']}")
        variants.cell(variant_row, 9, variant["mainImage"])
        variants.cell(variant_row, 11, variant["id"])
        variants.cell(variant_row, 12, "مضاف لقاعدة البيانات")

        option_en = variants.cell(variant_row, 5).value
        image_row = image_rows.get((ref, option_en))
        if image_row is not None:
            image_record = variant["images"][0]
            images.cell(image_row, 7, image_record["url"])
            images.cell(image_row, 8, "صورة استديو مولدة ومرفوعة")
            images.cell(image_row, 9, "اجتازت الفحص المحلي وفحص الوصول العام")
            images.cell(image_row, 11, image_record["id"])

for row in range(2, images.max_row + 1):
    name = images.cell(row, 1).value
    if name in {"ScreenHunter 314.png", "ScreenHunter 315.png", "ScreenHunter 316.png"}:
        images.cell(row, 8, "صورة استديو جاهزة - المنتج موجود مسبقًا")
        images.cell(row, 9, "لم يُكرر المنتج؛ الصورة محفوظة محليًا كبديل مراجع")
        images.cell(row, 13, "المنتج وخياراته موجودة في قاعدة البيانات مسبقًا.")

workbook.save(BOOK)
print(f"Recorded {len(products_from_db)} products and {sum(len(p['variants']) for p in products_from_db)} variants")
