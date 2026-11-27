"""Record the first inspected screen and fingerprints without publishing anything."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / 'RAWAQ_Ghazal_Products.xlsx'
SNAPSHOT = ROOT / 'docs' / 'ghazal_inventory_snapshot.json'
data = json.loads(SNAPSHOT.read_text(encoding='utf-8-sig'))
supplier = data['suppliers'][0]
wb = load_workbook(BOOK)
products = wb['Products']
variants = wb['Variants']
images = wb['Images']
log = wb['Processing Log']
categories = {c['id']: c for c in data['categories']}
for product in data['products']:
    row = next((r for r in products.iter_rows(min_row=2) if r[0].value == product['sku']), None)
    if row is None:
        continue
    category = categories.get(product['categoryId'], {})
    root = category
    while root.get('parentId') and root['parentId'] in categories:
        root = categories[root['parentId']]
    row[4].value = root.get('name')
    row[5].value = category.get('name') if category.get('parentId') else None

ref = 'GHAZAL-SCREEN-356'
if not any(row[0].value == ref for row in products.iter_rows(min_row=2)):
    products.append([
        ref, 'لوشن الجسم بوتيك بيبي باودر بينك 480 مل',
        'Boutique Baby Powder Pink Body Lotion 480 ml', 'بوتيك كوزمتكس',
        'العناية بالجسم', 'لوشن الجسم', supplier['name'], supplier['id'],
        1.5, 2.5, None, None,
        'لوشن للجسم برائحة بودرة الأطفال الوردية، بعبوة 480 مل.',
        'لوشن جسم من بوتيك كوزمتكس برائحة بيبي باودر بينك. يساعد على ترطيب البشرة ويتركها بنعومة ورائحة لطيفة. العبوة بمضخة للاستخدام اليومي.',
        '480 مل', 'يوضع على بشرة الجسم النظيفة ويدلك حتى الامتصاص.',
        'ترطيب الجسم ورائحة بيبي باودر بينك', None, 1, None, None,
        'https://www.mahally.com/en/products/1584680292/1078630052/',
        'يحتاج مراجعة', 'لم تتم الإضافة', None, None,
        'سعر التكلفة والبيع من سكرين 356. صورة الذكاء الاصطناعي لم تجتز فحص الكتابة العربية على العبوة؛ لا تعتمد ولا ترفع.'
    ])
    row = products.max_row
    products.cell(row, 11, f'=IF(OR(I{row}="",J{row}=""),"",J{row}-I{row})')
    products.cell(row, 12, f'=IF(OR(I{row}="",J{row}="",J{row}=0),"",(J{row}-I{row})/J{row})')
    products.cell(row, 12).number_format = '0.0%'
    for col in (9, 10, 11):
        products.cell(row, col).number_format = '0.000'
    variants.append([ref, 'لوشن الجسم بوتيك بيبي باودر بينك 480 مل', 'لا يوجد',
                     'بيبي باودر بينك', 'Baby Powder Pink', '480 مل', 1.5, 2.5,
                     None, 1, None, 'يحتاج مراجعة', None, supplier['id']])
    log.append([datetime.now(), 'ScreenHunter 356.png', 'لوشن الجسم بوتيك بيبي باودر بينك 480 مل',
                'قراءة الأسعار والبحث وتجربة تجهيز الصورة', 'يحتاج مراجعة',
                'تغيرت الكتابة العربية على العبوة في ناتج imagegen.',
                'لم ترفع الصورة ولم تضف بيانات إلى قاعدة البيانات.'])

for row in images.iter_rows(min_row=2):
    path = row[1].value
    if path and Path(path).is_file() and not row[11].value:
        digest = hashlib.sha256()
        with Path(path).open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        row[11].value = digest.hexdigest()
    if row[0].value == 'ScreenHunter 356.png':
        row[2].value = ref
        row[7].value = 'يحتاج مراجعة'
        row[8].value = 'فشل فحص تطابق النص المطبوع'
        row[12].value = 'أنتجت الأداة صورة جميلة لكن النص العربي على الملصق تغير؛ الأصل محفوظ في المجلد الجديد.'

for ws in (products, variants, images, log):
    ws.auto_filter.ref = ws.dimensions
wb.save(BOOK)
print('Recorded 356 review and screen fingerprints; no database writes.')
