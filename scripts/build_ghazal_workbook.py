"""Build the initial Ghazal catalog workbook from a read-only database snapshot.

Run only for initial creation. Existing workbooks are deliberately left untouched.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT.parent / 'design'
SCREEN_DIR = DESIGN / '00_سكرينات_جديدة_inbox'
WORKBOOK = ROOT / 'RAWAQ_Ghazal_Products.xlsx'
SNAPSHOT = ROOT / 'docs' / 'ghazal_inventory_snapshot.json'
STATUSES = 'جديد,قيد المعالجة,يحتاج مراجعة,البيانات جاهزة,الصور جاهزة,جاهز للإضافة,تمت الإضافة,تم التحقق,مكتمل,فشل الإدخال,موجود مسبقًا'

if WORKBOOK.exists():
    raise SystemExit(f'Existing workbook preserved: {WORKBOOK}')

data = json.loads(SNAPSHOT.read_text(encoding='utf-8-sig'))
suppliers = data['suppliers']
if len(suppliers) != 1 or not suppliers[0]['isActive']:
    raise SystemExit('Exactly one active Ghazal supplier is required')
supplier = suppliers[0]
categories = {c['id']: c for c in data['categories']}
brands = {b['id']: b for b in data['brands']}

wb = Workbook()
products_ws = wb.active
products_ws.title = 'Products'
variants_ws = wb.create_sheet('Variants')
images_ws = wb.create_sheet('Images')
log_ws = wb.create_sheet('Processing Log')
mapping_ws = wb.create_sheet('Field Mapping')

product_columns = [
    ('reference', 'المعرف المرجعي'), ('nameAr', 'اسم المنتج بالعربية'),
    ('nameEn', 'اسم المنتج بالإنجليزية'), ('brand', 'العلامة التجارية'),
    ('category', 'التصنيف الرئيسي'), ('subcategory', 'التصنيف الفرعي'),
    ('supplier', 'المورد'), ('supplierId', 'معرف المورد'),
    ('costJOD', 'سعر التكلفة د.أ'), ('priceJOD', 'سعر البيع د.أ'),
    ('profitJOD', 'فرق السعر د.أ'), ('margin', 'هامش الربح الإجمالي'),
    ('shortDescription', 'الوصف المختصر'), ('longDescription', 'الوصف التفصيلي'),
    ('size', 'الحجم أو الوزن'), ('howToUse', 'طريقة الاستخدام'),
    ('benefits', 'المميزات'), ('optionType', 'نوع الخيارات'),
    ('optionCount', 'عدد الخيارات'), ('mainImage', 'الصورة الرئيسية'),
    ('additionalImages', 'الصور الإضافية'), ('infoSource', 'مصدر معلومات المنتج'),
    ('processingStatus', 'حالة المعالجة'), ('databaseStatus', 'حالة قاعدة البيانات'),
    ('productId', 'معرف المنتج في قاعدة البيانات'), ('addedAt', 'تاريخ الإضافة'),
    ('notes', 'ملاحظات'),
]
variant_columns = [
    ('reference', 'المعرف المرجعي للمنتج'), ('productName', 'اسم المنتج'),
    ('optionType', 'نوع الخيار'), ('optionAr', 'اسم الخيار بالعربية'),
    ('optionEn', 'اسم الخيار بالإنجليزية'), ('size', 'الحجم'),
    ('costJOD', 'تكلفة الخيار د.أ'), ('priceJOD', 'بيع الخيار د.أ'),
    ('image', 'صورة الخيار'), ('displayOrder', 'ترتيب العرض'),
    ('variantId', 'معرف الخيار في قاعدة البيانات'), ('processingStatus', 'حالة المعالجة'),
    ('sku', 'SKU'), ('supplierId', 'معرف المورد'),
]
image_columns = [
    ('screenName', 'اسم السكرين الأصلي'), ('screenPath', 'مسار السكرين الأصلي'),
    ('productRef', 'المنتج المرتبط'), ('variantRef', 'الخيار المرتبط'),
    ('finalName', 'اسم الصورة النهائية'), ('finalPath', 'مسار الصورة النهائية'),
    ('imageUrl', 'رابط الصورة بعد الرفع'), ('prepStatus', 'حالة تجهيز الصورة'),
    ('qaStatus', 'حالة فحص الصورة'), ('archiveStatus', 'حالة الأرشفة'),
    ('imageId', 'معرف الصورة في قاعدة البيانات'), ('sha256', 'بصمة السكرين SHA256'),
    ('notes', 'ملاحظات'),
]
log_columns = [
    ('date', 'تاريخ المعالجة'), ('screenName', 'اسم السكرين'),
    ('product', 'اسم المنتج'), ('action', 'الإجراء'),
    ('result', 'النتيجة'), ('errors', 'الأخطاء'), ('notes', 'الملاحظات'),
]
mapping_columns = [('sheet', 'الورقة'), ('column', 'العمود'), ('projectField', 'حقل المشروع'), ('usage', 'الاستخدام'), ('notes', 'ملاحظات')]

for ws, columns in [(products_ws, product_columns), (variants_ws, variant_columns),
                    (images_ws, image_columns), (log_ws, log_columns), (mapping_ws, mapping_columns)]:
    ws.append([label for _, label in columns])

def jod(fils):
    return fils / 1000 if fils is not None else None

for p in data['products']:
    c = categories.get(p['categoryId'], {})
    parent = categories.get(c.get('parentId'), {})
    root = c
    while root.get('parentId') and root['parentId'] in categories:
        root = categories[root['parentId']]
    b = brands.get(p.get('brandId'), {})
    offers = [o for v in p['variants'] for o in v['supplierOffers'] if o['supplierId'] == supplier['id'] and o['isActive']]
    costs = {o['unitCost'] for o in offers}
    prices = {v['price'] for v in p['variants']}
    cost = jod(next(iter(costs))) if len(costs) == 1 else None
    price = jod(next(iter(prices))) if len(prices) == 1 else None
    images = sorted(p['images'], key=lambda im: not im['isMain'])
    ref = p['sku']
    row = [
        ref, p['nameAr'], p['nameEn'], b.get('nameAr'), root.get('name'),
        c.get('name') if parent else None, supplier['name'], supplier['id'], cost, price,
        None, None, p['shortDescription'], p['longDescription'],
        p['variants'][0]['size'] if len({v['size'] for v in p['variants']}) == 1 else None,
        p['howToUse'], p['benefits'], None, len(p['variants']),
        images[0]['url'] if images else None,
        ' | '.join(im['url'] for im in images[1:]), None,
        'موجود مسبقًا', 'موجود في قاعدة البيانات', p['id'], None,
        'سجل قاعدة بيانات قائم؛ أسعار الخيارات هي المرجع عند اختلافها.'
    ]
    products_ws.append(row)
    r = products_ws.max_row
    products_ws.cell(r, 11, f'=IF(OR(I{r}="",J{r}=""),"",J{r}-I{r})')
    products_ws.cell(r, 12, f'=IF(OR(I{r}="",J{r}="",J{r}=0),"",(J{r}-I{r})/J{r})')
    for idx, v in enumerate(p['variants'], 1):
        offer = next((o for o in v['supplierOffers'] if o['supplierId'] == supplier['id'] and o['isActive']), None)
        option_type = 'لون' if v['colorName'] else ('حجم' if len({x['size'] for x in p['variants']}) > 1 else 'رائحة/خيار')
        variants_ws.append([ref, p['nameAr'], option_type, v['colorName'] or v['name'], None,
                            v['size'], jod(offer['unitCost']) if offer else None, jod(v['price']),
                            v['mainImage'], idx, v['id'], 'موجود مسبقًا', v['sku'], supplier['id']])
    for im in p['images']:
        images_ws.append([None, None, ref, im['variantId'], None, None, im['url'],
                          'موجودة في قاعدة البيانات', 'لم يفحص مقابل الأصل', 'غير معروف', im['id'], None, None])

screens = sorted(SCREEN_DIR.glob('*.png'), key=lambda path: int(re.search(r'(\d+)$', path.stem).group(1)))
for screen in screens:
    images_ws.append([screen.name, str(screen), None, None, None, None, None,
                      'جديد', 'لم يفحص', 'في المجلد الجديد', None, None,
                      'لم تُطابق بعد مع المنتج والسعر؛ لا تنقل قبل التحقق الكامل.'])

log_ws.append([datetime.now(), None, None, 'جرد أولي', 'تم إنشاء ملف مركزي', None,
               f'{len(screens)} سكرين جديد؛ {len(data["products"])} منتج و{sum(len(p["variants"]) for p in data["products"])} خيار موجود مسبقًا.'])

product_fields = {
    'reference': ('Product.sku', 'توثيق/مطابقة'), 'nameAr': ('Product.nameAr', 'استيراد'),
    'nameEn': ('Product.nameEn', 'استيراد'), 'brand': ('Brand.nameAr → Product.brandId', 'استيراد'),
    'category': ('Category.parentId', 'تصنيف/مطابقة'), 'subcategory': ('Product.categoryId', 'استيراد'),
    'supplier': ('Supplier.name', 'تحقق'), 'supplierId': ('SupplierOffer.supplierId', 'استيراد'),
    'costJOD': ('SupplierOffer.unitCost / 1000', 'استيراد لكل خيار'),
    'priceJOD': ('ProductVariant.price / 1000', 'استيراد لكل خيار'),
    'profitJOD': ('صيغة Excel', 'توثيق'), 'margin': ('صيغة Excel', 'توثيق'),
    'shortDescription': ('Product.shortDescription', 'استيراد'),
    'longDescription': ('Product.longDescription', 'استيراد'),
    'size': ('ProductVariant.size', 'استيراد لكل خيار'), 'howToUse': ('Product.howToUse', 'استيراد'),
    'benefits': ('Product.benefits', 'استيراد عند التوثيق'),
    'optionType': ('ProductVariant.name/size/colorName', 'توجيه الاستيراد'),
    'optionCount': ('عدد ProductVariant', 'توثيق/تحقق'),
    'mainImage': ('ProductImage.url + isMain', 'استيراد'),
    'additionalImages': ('ProductImage.url', 'استيراد'), 'infoSource': ('لا يوجد', 'توثيق'),
    'processingStatus': ('لا يوجد', 'توثيق'), 'databaseStatus': ('لا يوجد', 'توثيق'),
    'productId': ('Product.id', 'توثيق'), 'addedAt': ('Product.createdAt', 'توثيق'),
    'notes': ('لا يوجد', 'توثيق'),
}
variant_fields = {
    'reference': ('Product.sku', 'مطابقة'), 'productName': ('Product.nameAr', 'توثيق'),
    'optionType': ('ProductVariant.name/size/colorName', 'توجيه الاستيراد'),
    'optionAr': ('ProductVariant.name أو colorName', 'استيراد'), 'optionEn': ('لا يوجد حقل مستقل', 'توثيق'),
    'size': ('ProductVariant.size', 'استيراد'), 'costJOD': ('SupplierOffer.unitCost / 1000', 'استيراد'),
    'priceJOD': ('ProductVariant.price / 1000', 'استيراد'),
    'image': ('ProductVariant.mainImage + ProductImage.url', 'استيراد'),
    'displayOrder': ('ترتيب المصفوفة في نموذج الإدخال', 'توجيه الاستيراد'),
    'variantId': ('ProductVariant.id', 'توثيق'), 'processingStatus': ('لا يوجد', 'توثيق'),
    'sku': ('ProductVariant.sku', 'مطابقة'), 'supplierId': ('SupplierOffer.supplierId', 'استيراد'),
}
image_fields = {'screenName': 'ملف مصدر', 'screenPath': 'ملف مصدر', 'productRef': 'Product.sku',
                'variantRef': 'ProductVariant.id', 'finalName': 'ملف WebP', 'finalPath': 'ملف WebP',
                'imageUrl': 'ProductImage.url', 'prepStatus': 'لا يوجد', 'qaStatus': 'لا يوجد',
                'archiveStatus': 'لا يوجد', 'imageId': 'ProductImage.id', 'sha256': 'بصمة ملف', 'notes': 'لا يوجد'}
for sheet, columns, field_map in [('Products', product_columns, product_fields),
                                  ('Variants', variant_columns, variant_fields),
                                  ('Images', image_columns, image_fields)]:
    for key, label in columns:
        field, usage = field_map[key] if sheet != 'Images' else (field_map[key], 'توثيق/مطابقة')
        mapping_ws.append([sheet, label, field, usage, 'الأسعار بالدينار في Excel، وبالفلس داخل قاعدة البيانات.' if key in ('costJOD', 'priceJOD') else None])

for ws in wb.worksheets:
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_view.rightToLeft = True
    ws.row_dimensions[1].height = 31
    for cell in ws[1]:
        cell.fill = PatternFill('solid', fgColor='263B34')
        cell.font = Font(name='Arial', size=10, color='FFFFFF', bold=True)
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    for col_idx in range(1, ws.max_column + 1):
        letter = get_column_letter(col_idx)
        ws.column_dimensions[letter].width = min(45, max(18, len(str(ws.cell(1, col_idx).value)) + 4))
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.font = Font(name='Arial', size=10)
            cell.alignment = Alignment(vertical='center')
            if cell.row % 2 == 0:
                cell.fill = PatternFill('solid', fgColor='F3F7F4')

for ws, col in [(products_ws, 23), (variants_ws, 12), (images_ws, 8)]:
    dv = DataValidation(type='list', formula1=f'"{STATUSES}"', allow_blank=True)
    dv.error = 'اختر حالة من القائمة.'
    dv.showErrorMessage = True
    ws.add_data_validation(dv)
    dv.add(f'{get_column_letter(col)}2:{get_column_letter(col)}10000')

for r in range(2, products_ws.max_row + 1):
    products_ws.cell(r, 12).number_format = '0.0%'
    for c in (9, 10, 11):
        products_ws.cell(r, c).number_format = '0.000'
for r in range(2, variants_ws.max_row + 1):
    for c in (7, 8):
        variants_ws.cell(r, c).number_format = '0.000'

wb.save(WORKBOOK)
print(f'{WORKBOOK}: {len(data["products"])} products, {sum(len(p["variants"]) for p in data["products"])} variants, {len(screens)} screens inventoried')
