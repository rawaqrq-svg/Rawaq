"""Copy visually accepted, original-pixel studio photos to the approved folder.

The manual reject list covers segmentation defects, cursor overlays, clipped
packaging and images too soft to satisfy the store reference. Original screens
and existing store images are never modified.
"""
from __future__ import annotations

import hashlib
import re
import shutil
import sys
from pathlib import Path

from openpyxl import load_workbook
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT.parent/'design'/'جاهز_للمتجر_studio_webp'
STAGING=ROOT/'docs'/'ghazal_staging'
BOOK=ROOT/'RAWAQ_Ghazal_Products.xlsx'
REJECT={211,212,216,218,318,319,337,338,353,355,356}
EXISTING={314,315,316}
DUPLICATE={263}

wb=load_workbook(BOOK)
products=wb['Products'];variants=wb['Variants'];images=wb['Images']
statuses={products.cell(r,1).value:products.cell(r,23).value for r in range(2,products.max_row+1)}
rows=[]
for r in range(2,images.max_row+1):
    filename=images.cell(r,1).value
    if not filename:continue
    match=re.fullmatch(r'ScreenHunter (\d+)\.png',filename)
    if not match:continue
    n=int(match.group(1));ref=images.cell(r,3).value
    if n<209 or not ref or statuses.get(ref)=='موجود مسبقًا' or n in EXISTING or n in DUPLICATE:continue
    source=STAGING/f'screen-{n:03d}-studio-review.webp'
    if n in REJECT:
        images.cell(r,9,'مرفوض: عيب في القص أو جودة المصدر')
        continue
    if not source.exists():
        images.cell(r,9,'تحتاج صورة استديو')
        continue
    with Image.open(source) as im:
        if im.size!=(1254,1254):raise SystemExit(f'Bad dimensions: {source}')
        if im.getpixel((0,0)) != (255,255,255):raise SystemExit(f'Non-white background: {source}')
    final_name=f'{ref.lower()}-screen-{n:03d}-studio.webp'
    destination=DEST/final_name
    rows.append((r,n,ref,source,destination))

print(f'Accepted image candidates: {len(rows)}; rejected: {len(REJECT)}; existing product images excluded: {len(EXISTING)}')
if '--apply' not in sys.argv:raise SystemExit(0)

for r,n,ref,source,destination in rows:
    if destination.exists():
        if hashlib.sha256(destination.read_bytes()).digest()!=hashlib.sha256(source.read_bytes()).digest():
            raise SystemExit(f'Collision with different bytes: {destination}')
    else:
        shutil.copy2(source,destination)
    images.cell(r,5,destination.name)
    images.cell(r,6,str(destination))
    images.cell(r,8,'صورة استديو جاهزة')
    images.cell(r,9,'اجتاز فحص الخلفية والعبوة بصريًا')
    for vr in range(2,variants.max_row+1):
        if variants.cell(vr,1).value==ref and variants.cell(vr,13).value==f'{ref}-{n}':
            variants.cell(vr,9,str(destination))

wb.save(BOOK)
print(f'Copied {len(rows)} accepted WebP files to {DEST}')
