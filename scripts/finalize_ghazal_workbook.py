"""Finalize workbook links and readiness after studio-image QA."""

from collections import defaultdict
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import re

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "RAWAQ_Ghazal_Products.xlsx"

spec = spec_from_file_location("studio_status", Path(__file__).with_name("reset_ghazal_studio_status.py"))
studio_status = module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(studio_status)
APPROVED = studio_status.APPROVED


def screen_number(value: object) -> int | None:
    match = re.fullmatch(r"ScreenHunter (\d+)\.png", str(value or ""))
    return int(match.group(1)) if match else None


workbook = load_workbook(BOOK)
products = workbook["Products"]
variants = workbook["Variants"]
images = workbook["Images"]

product_rows = {products.cell(row, 1).value: row for row in range(2, products.max_row + 1)}
variant_rows = {
    (variants.cell(row, 1).value, variants.cell(row, 5).value): row
    for row in range(2, variants.max_row + 1)
}
paths_by_product: dict[str, list[str]] = defaultdict(list)

for row in range(2, images.max_row + 1):
    number = screen_number(images.cell(row, 1).value)
    if number is None:
        continue
    if number == 263:
        images.cell(row, 3, "GHAZ-DOVE-GOFRESH-APPLE")
        images.cell(row, 4, "Apple & White Tea")
        images.cell(row, 8, "مكرر - لم يعتمد")
        images.cell(row, 9, "نفس منتج السكرين 262؛ لم تُنشأ صورة أو سلعة مكررة")
        images.cell(row, 13, "محفوظ كسجل تدقيق فقط، ولا يدخل قاعدة البيانات.")
        continue

    path = APPROVED.get(number)
    if path is None:
        continue
    ref = images.cell(row, 3).value
    option_en = images.cell(row, 4).value
    if not ref:
        raise ValueError(f"Approved screen {number} is not linked to a product")
    paths_by_product[str(ref)].append(str(path))

    variant_row = variant_rows.get((ref, option_en))
    if variant_row is not None:
        variants.cell(variant_row, 9, str(path))
        if not variants.cell(variant_row, 13).value:
            variants.cell(variant_row, 13, f"{ref}-{number}")

for ref, paths in paths_by_product.items():
    product_row = product_rows.get(ref)
    if product_row is None:
        raise ValueError(f"Missing product row for {ref}")

    is_existing = products.cell(product_row, 23).value == "موجود مسبقًا"
    cost = products.cell(product_row, 9).value
    sale = products.cell(product_row, 10).value
    if not is_existing:
        products.cell(product_row, 20, paths[0])
        products.cell(product_row, 21, " | ".join(paths[1:]) if len(paths) > 1 else None)
        if cost is None or sale is None:
            products.cell(product_row, 23, "ناقص أسعار - غير جاهز للاستيراد")
            products.cell(product_row, 27, "الصورة جاهزة؛ يلزم سعر التكلفة وسعر البيع الحقيقيان قبل الاستيراد.")
        else:
            products.cell(product_row, 23, "جاهز للاستيراد")
            products.cell(product_row, 27, "الصورة والبيانات والأسعار مكتملة؛ بانتظار فحص التكرار والاستيراد.")

    for row in range(2, variants.max_row + 1):
        if variants.cell(row, 1).value != ref:
            continue
        if not is_existing:
            variants.cell(row, 7, cost)
            variants.cell(row, 8, sale)
            variants.cell(row, 12, "جاهز للاستيراد" if cost is not None and sale is not None else "ناقص أسعار")

workbook.save(BOOK)
print(
    f"Finalized {len(APPROVED)} approved images across {len(paths_by_product)} product records; "
    "screen 263 marked duplicate."
)
