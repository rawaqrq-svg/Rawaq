"""Record the visually reviewed 209–356 supplier batch in the central workbook.

This is idempotent and records candidates for review. It never imports products.
"""
from __future__ import annotations

from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT.parent / 'design'
SCREENS = DESIGN / '00_سكرينات_جديدة_inbox'
STAGING = ROOT / 'docs' / 'ghazal_staging'
BOOK = ROOT / 'RAWAQ_Ghazal_Products.xlsx'
SUPPLIER = 'محل غزل للمكياجات'
SUPPLIER_ID = '300954f2-4ba8-4a07-a3fc-dcd3ccc766a9'

# ref, Arabic name, English name, brand, category, subcategory, size,
# cost JOD, sale JOD, option kind, [(screen number, English option, Arabic option)]
BATCH = [
 ('GHAZ-FOGG-SPRAY-MEN-120','بخاخ جسم فوغ للرجال 120 مل','FOGG Men Body Spray 120 ml','FOGG','العناية بالجسم','معطرات جسم وبودي سبلاش','120 مل',2.05,2.5,'رائحة',[(210,'Magnetic','ماغنيتيك'),(211,'Monarch','مونارك'),(212,'Bleu Skies','بلو سكايز'),(213,'Absolute','أبسولوت'),(214,'Extreme','إكستريم'),(215,'Fresh Fougere','فريش فوجير'),(218,'Dynamic','دايناميك')]),
 ('GHAZ-FOGG-MASTER-120','بخاخ جسم فوغ ماستر 120 مل','FOGG Master Body Spray 120 ml','FOGG','العناية بالجسم','معطرات جسم وبودي سبلاش','120 مل',2.05,2.5,'رائحة',[(216,'Oak','أوك'),(217,'Cedar','سيدر')]),
 ('GHAZ-FASIO-SPRAY','بخاخ جسم إمبير فاسيو النسائي','Emper Fasio Pour Femme Body Spray','Emper','العناية بالجسم','معطرات جسم وبودي سبلاش',None,1.5,2,'رائحة',[(219,'Pour Femme','بور فام')]),
 ('GHAZ-FOGG-SPRAY-WOMEN-120','بخاخ جسم فوغ للنساء 120 مل','FOGG Women Body Spray 120 ml','FOGG','العناية بالجسم','معطرات جسم وبودي سبلاش','120 مل',2.05,2.5,'رائحة',[(221,'Essence','إيسنس'),(222,'Napoleon','نابليون'),(223,'Reveal Women','ريفيل وومن'),(224,'Delicious','ديليشس')]),
 ('GHAZ-ENCHANTEUR-DEO-SPRAY','بخاخ مزيل عرق إنشانتر','Enchanteur Perfumed Deodorant Spray','Enchanteur','العناية بالجسم','معطرات الجسم',None,1.5,2,'رائحة',[(226,'Gorgeous','جورجس'),(227,'Enticing','إنتايسينغ'),(228,'Romantic','رومانتيك'),(229,'Alluring','ألورينغ'),(230,'Charming','تشارمينغ')]),
 ('GHAZ-REXONA-MOTIONSENSE-SPRAY','بخاخ مزيل عرق ريكسونا موشن سينس','Rexona MotionSense Antiperspirant Spray','Rexona','العناية بالجسم','معطرات الجسم',None,2,2.5,'رائحة',[(232,'Biorhythm','بايوريذم'),(233,'Invisible Pure','إنفيزيبل بيور'),(234,'Tropical','تروبيكال'),(235,'Shower Fresh','شاور فريش'),(236,'Antibacterial Protection','أنتي بكتيريال بروتكشن'),(237,'Invisible Aqua','إنفيزيبل أكوا'),(238,'Cotton Dry','كوتون دراي')]),
 ('GHAZ-OLDSPICE-SPRAY','بخاخ مزيل عرق أولد سبايس','Old Spice Deodorant Spray','Old Spice','العناية بالجسم','معطرات الجسم',None,3,3.5,'رائحة',[(240,'Epic Legend','إيبك ليجند'),(241,'Captain','كابتن'),(242,'Bearglove','بيرغلوف')]),
 ('GHAZ-RIGGS-LONDON-250','بخاخ جسم ريغز لندن 250 مل','Riggs London Body Spray 250 ml','Riggs London','العناية بالجسم','معطرات جسم وبودي سبلاش','250 مل',1.75,2.5,'رائحة',[(243,'Venom','فينوم'),(245,'Dynamo','داينامو'),(246,'Power','باور'),(247,'The One','ذا ون'),(248,'Oud','عود'),(249,'Icon','آيكون')]),
 ('GHAZ-SECRET-WEIGHTLESS-SPRAY','بخاخ مزيل عرق سيكرت ويتلس','Secret Weightless Dry Spray','Secret','العناية بالجسم','معطرات الجسم',None,1.2,1.5,'رائحة',[(252,'Aloe Vera & Cucumber','ألوفيرا وخيار'),(253,'White Peach','خوخ أبيض'),(254,'Pomegranate','رمان'),(255,'Lavender','لافندر'),(256,'Waterlily','زنبق الماء')]),
 ('GHAZ-DOVE-GOFRESH-SPRAY','بخاخ مزيل عرق دوف غو فريش','Dove Go Fresh Deodorant Spray','Dove','العناية بالجسم','معطرات الجسم',None,2.25,3,'رائحة',[(258,'Pomegranate','رمان'),(259,'Pear','كمثرى'),(262,'Apple','تفاح')]),
 ('GHAZ-DOVE-NOURISH-SPRAY','بخاخ مزيل عرق دوف نورشنغ سيكرتس','Dove Nourishing Secrets Deodorant Spray','Dove','العناية بالجسم','معطرات الجسم',None,2.25,3,'رائحة',[(260,'Coconut','جوز الهند')]),
 ('GHAZ-DOVE-ORIGINAL-SPRAY','بخاخ مزيل عرق دوف أوريجينال','Dove Original Deodorant Spray','Dove','العناية بالجسم','معطرات الجسم',None,2.25,3,'رائحة',[(261,'Original','أوريجينال')]),
 ('GHAZ-DOVE-INVISIBLE-SPRAY','بخاخ مزيل عرق دوف إنفيزيبل كير','Dove Invisible Care Deodorant Spray','Dove','العناية بالجسم','معطرات الجسم',None,2.25,3,'رائحة',[(264,'Invisible Care','إنفيزيبل كير')]),
 ('GHAZ-CONFETTI-SPRAY-250','بخاخ جسم كونفيتي لندن 250 مل','Confetti London Body Spray 250 ml','Confetti London','العناية بالجسم','معطرات جسم وبودي سبلاش','250 مل',1.5,2,'رائحة',[(266,'Maya','مايا'),(267,'Joy','جوي'),(268,'Chocolate','شوكولاتة'),(269,'Dear','دير'),(270,'Pretty','بريتي'),(271,'Secret','سيكرت')]),
 ('GHAZ-EMPER-CHIFON-SPRAY','بخاخ جسم إمبير شيفون','Emper Chifon Body Spray','Emper','العناية بالجسم','معطرات جسم وبودي سبلاش',None,1.5,2,'رائحة',[(273,'Chifon Rouge','شيفون روج'),(277,'Chifon','شيفون')]),
 ('GHAZ-EMPER-FASIO-SPRAY','بخاخ جسم إمبير فاسيو إنتنس','Emper Fasio Intense Body Spray','Emper','العناية بالجسم','معطرات جسم وبودي سبلاش',None,1.5,2,'رائحة',[(274,'Fasio Intense','فاسيو إنتنس')]),
 ('GHAZ-EMPER-TWIST-SPRAY','بخاخ جسم إمبير تويست','Emper Twist Body Spray','Emper','العناية بالجسم','معطرات جسم وبودي سبلاش',None,1.5,2,'رائحة',[(275,'Twist','تويست')]),
 ('GHAZ-EMPER-LEGEND-SPRAY','بخاخ جسم إمبير ليجند فام','Emper Legend Femme Body Spray','Emper','العناية بالجسم','معطرات جسم وبودي سبلاش',None,1.5,2,'رائحة',[(276,'Legend Femme','ليجند فام')]),
 ('GHAZ-EMPER-SALGA-SPRAY','بخاخ جسم إمبير سالغا','Emper Salga Body Spray','Emper','العناية بالجسم','معطرات جسم وبودي سبلاش',None,1.5,2,'رائحة',[(278,'Salga','سالغا')]),
 ('GHAZ-EMOTION-SPRAY','بخاخ مزيل عرق إيموشن','Emotion Deodorant Spray','Emotion','العناية بالجسم','معطرات الجسم',None,1.5,2,'رائحة',[(280,'Detox Fresh','ديتوكس فريش'),(281,'Natural Bloom','ناتشورال بلوم'),(282,'Aqua Kiss','أكوا كيس'),(283,'Invisible Fresh','إنفيزيبل فريش')]),
 ('GHAZ-HIGEEN-ROLLON-BLACK','رول مزيل عرق هايجين الأسود','HiGeen Black Roll On Deodorant','HiGeen','العناية بالجسم','معطرات الجسم',None,1.37,2.0,'رائحة',[(284,'Black','أسود')]),
 ('GHAZ-HIGEEN-ROLLON-OTHER','رول مزيل عرق هايجين','HiGeen Roll On Deodorant','HiGeen','العناية بالجسم','معطرات الجسم',None,None,None,'رائحة',[(285,'Fruity Fresh','فروتي فريش'),(286,'Hair Minimizing','تقليل الشعر')]),
 ('GHAZ-DOVE-RADIANTCARE-SERUM','سيروم مزيل عرق دوف راديانت كير','Dove Radiant+Care Deodorant Serum','Dove','العناية بالجسم','معطرات الجسم',None,None,None,'تركيبة',[(287,'Vitamin Care','فيتامين كير'),(288,'Collagen','كولاجين'),(289,'Night Repair','نايت ريبير'),(290,'Sensitive','سينسيتيف')]),
 ('GHAZ-VASELINE-GLUTAGLOW-ROLLON','رول مزيل عرق فازلين غلوتا غلو','Vaseline GlutaGlow Roll On','Vaseline','العناية بالجسم','معطرات الجسم',None,2.5,3.5,'تركيبة',[(291,'GlutaGlow','غلوتا غلو')]),
 ('GHAZ-ENCHANTEUR-ROLLON','رول مزيل عرق إنشانتر','Enchanteur Perfumed Roll On Deodorant','Enchanteur','العناية بالجسم','معطرات الجسم',None,1.25,1.75,'رائحة',[(293,'Stunning','ستاننغ'),(294,'Enticing','إنتايسينغ'),(295,'Charming','تشارمينغ'),(296,'Alluring','ألورينغ'),(297,'Romantic','رومانتيك')]),
 ('GHAZ-BOUTIQUE-ROLLON','رول مزيل عرق بوتيك','Boutique Cosmetics Roll On Deodorant','Boutique Cosmetics','العناية بالجسم','معطرات الجسم',None,1,1.5,'رائحة',[(299,'Cotton Dry','كوتون دراي'),(300,'Candy','كاندي'),(301,'Arrogate Pink','أروغيت بينك'),(302,'Marshmallow','مارشميلو'),(303,'Natural Touch','ناتشورال تاتش'),(304,'Shower Fresh','شاور فريش'),(305,'Her','هير'),(306,'Stress Resist','سترس ريزيست'),(307,'Free Spirit','فري سبيريت'),(308,'Baby Powder Pink','بيبي باودر بينك')]),
 ('GHAZ-ELEGANCE-HAIR-SERUM-300','سيروم شعر إليغانس بلس 300 مل','Elegance Plus Hair Serum 300 ml','Elegance Plus','العناية بالشعر','زيوت وسيرومات الشعر','300 مل',4,6,'تركيبة',[(311,'Aloe Vera','ألوفيرا'),(312,'Coconut Oil','زيت جوز الهند')]),
 ('CAT-ALAROUSA-FEMININE-WASH','غسول نسائي العروسة','Al Arousa Feminine Wash','العروسة','العناية بالجسم','العناية الحساسة',None,2,2.5,'رائحة',[(314,'Strawberry','فراولة'),(315,'Attractive Scent','رائحة جذابة'),(316,'Tutti Frutti','توتي فروتي')]),
 ('GHAZ-ALAROUSA-DEADSEA-SCRUB','مقشر ملح البحر الميت العروسة','Al Arousa Dead Sea Salt Body Scrub','العروسة','العناية بالجسم','مقشرات الجسم',None,2.5,3.5,'رائحة',[(318,'Tutti Frutti','توتي فروتي'),(319,'Marshmallow','مارشميلو')]),
 ('GHAZ-VASELINE-GLUTAVIT-FIRM-180','سيروم جسم فازلين غلوتا فيتامين فيرم آند غلو 180 مل','Vaseline Gluta Vitamin Firm+Glow 180 ml','Vaseline','العناية بالجسم','لوشن الجسم','180 مل',3.75,5,'تركيبة',[(321,'Firm+Glow','فيرم آند غلو')]),
 ('GHAZ-VASELINE-GLUTAVIT-HIJAB-180','سيروم جسم فازلين غلوتا فيتامين حجاب راديانت 180 مل','Vaseline Gluta Vitamin Hijab Radiant 180 ml','Vaseline','العناية بالجسم','لوشن الجسم','180 مل',3.75,5,'تركيبة',[(322,'Hijab Radiant','حجاب راديانت')]),
 ('GHAZ-ENCHANTEUR-SATIN-LOTION','لوشن جسم إنشانتر ساتن سموث','Enchanteur Satin Smooth Perfumed Lotion','Enchanteur','العناية بالجسم','لوشن الجسم',None,1.5,1.75,'رائحة',[(324,'Charming','تشارمينغ'),(325,'Alluring','ألورينغ'),(326,'Elegant Musk','إليغانت مسك'),(327,'Romantic','رومانتيك'),(328,'Enticing','إنتايسينغ'),(329,'Gorgeous','جورجس')]),
 ('GHAZ-AGRADO-BODY-MILK-400','لوشن جسم أغرادو بودي ميلك 400 مل','Agrado Body Milk 400 ml','Agrado','العناية بالجسم','لوشن الجسم','400 مل',1.5,2,'تركيبة',[(331,'Rosa Mosqueta','روزا موسكيتا'),(332,'Aloe Vera','ألوفيرا'),(333,'Leche de Coco','حليب جوز الهند'),(334,'Argan','أرغان'),(335,'Almendras Dulces','لوز حلو')]),
 ('GHAZ-VASELINE-INTENSIVE-400','لوشن جسم فازلين إنتنسيف كير 400 مل','Vaseline Intensive Care Body Lotion 400 ml','Vaseline','العناية بالجسم','لوشن الجسم','400 مل',2,2.5,'تركيبة',[(337,'Cocoa Glow','كاكاو غلو'),(338,'Advanced Repair','أدفانسد ريبير'),(339,'Aloe Soothe','ألو سوذ'),(340,'Dry Skin Repair','دراي سكين ريبير')]),
 ('GHAZ-MBC-BODY-LOTION-500','لوشن يدين وجسم إم بي سي 500 مل','MBC Hand and Body Lotion 500 ml','MBC','العناية بالجسم','لوشن الجسم','500 مل',1.5,2,'تركيبة',[(342,'Ultra Almond Oil','زيت اللوز'),(343,'Ultra Argan Oil','زيت الأرغان'),(344,'Ultra Jojoba Oil','زيت الجوجوبا'),(345,'Ultra Coconut Oil','زيت جوز الهند')]),
 ('GHAZ-BOUTIQUE-SCRUB-600','مقشر الوجه والجسم بوتيك 600 مل','Boutique Face and Body Scrub 600 ml','Boutique Cosmetics','العناية بالجسم','مقشرات الجسم','600 مل',1.5,2.5,'تركيبة',[(347,'Charcoal','فحم'),(348,'Avocado','أفوكادو'),(349,'Peach','خوخ'),(350,'Aloe Vera','ألوفيرا'),(351,'Strawberry','فراولة')]),
 ('GHAZ-GLYSOLID-LOTION','لوشن جسم غليسوليد','Glysolid Body Lotion','Glysolid','العناية بالجسم','لوشن الجسم',None,3.75,5,'تركيبة',[(353,'Classic','كلاسيك'),(354,'Musk','مسك')]),
 ('GHAZ-SENCE-HYDROSHOCK-LOTION','لوشن جسم سينس هيدرو شوك','Sence Hydro Shock Body Lotion','Sence','العناية بالجسم','لوشن الجسم',None,2.5,3.5,'تركيبة',[(355,'Hydro Shock','هيدرو شوك')]),
 ('GHAZAL-SCREEN-356','لوشن جسم بوتيك بيبي باودر بينك 480 مل','Boutique Baby Powder Pink Body Lotion 480 ml','Boutique Cosmetics','العناية بالجسم','لوشن الجسم','480 مل',1.5,2.5,'رائحة',[(356,'Baby Powder Pink','بيبي باودر بينك')]),
]

# Similar packaging alone does not satisfy the user's grouping rule. Split
# treatment/formula/performance differences into separate products.
SPLIT_GROUPS = {
    'GHAZ-REXONA-MOTIONSENSE-SPRAY',
    'GHAZ-HIGEEN-ROLLON-OTHER',
    'GHAZ-DOVE-RADIANTCARE-SERUM',
    'GHAZ-BOUTIQUE-ROLLON',
    'GHAZ-ELEGANCE-HAIR-SERUM-300',
    'GHAZ-AGRADO-BODY-MILK-400',
    'GHAZ-VASELINE-INTENSIVE-400',
    'GHAZ-MBC-BODY-LOTION-500',
    'GHAZ-BOUTIQUE-SCRUB-600',
}
base_batch=BATCH
BATCH=[]
for record in base_batch:
    ref, ar, en, brand, category, subcategory, size, cost, price, kind, choices=record
    if ref in SPLIT_GROUPS:
        for n, option_en, option_ar in choices:
            BATCH.append((f'{ref}-{n}',f'{ar} {option_ar}',f'{en} {option_en}',brand,
                          category,subcategory,size,cost,price,'لا يوجد',
                          [(n,option_en,option_ar)]))
    else:
        BATCH.append(record)

assert BOOK.exists()
wb = load_workbook(BOOK)
products, variants, images = (wb[s] for s in ('Products','Variants','Images'))
product_refs = {products.cell(r,1).value:r for r in range(2, products.max_row+1)}
variant_keys = {(variants.cell(r,1).value,variants.cell(r,5).value):r for r in range(2,variants.max_row+1)}
image_rows = {images.cell(r,1).value:r for r in range(2,images.max_row+1) if images.cell(r,1).value}

# Retire a duplicate draft ref created during the first pass. Keep the original
# 356 candidate and its researched source instead of creating a second product.
duplicate_ref='GHAZ-BOUTIQUE-BABYPOWDER-LOTION'
if duplicate_ref in product_refs:
    products.delete_rows(product_refs[duplicate_ref],1)
    for r in range(variants.max_row,1,-1):
        if variants.cell(r,1).value == duplicate_ref:
            variants.delete_rows(r,1)
    product_refs = {products.cell(r,1).value:r for r in range(2,products.max_row+1)}
    variant_keys = {(variants.cell(r,1).value,variants.cell(r,5).value):r for r in range(2,variants.max_row+1)}

for old_ref in SPLIT_GROUPS:
    if old_ref in product_refs and products.cell(product_refs[old_ref],23).value != 'موجود مسبقًا':
        products.delete_rows(product_refs[old_ref],1)
        for r in range(variants.max_row,1,-1):
            if variants.cell(r,1).value == old_ref:
                variants.delete_rows(r,1)
        product_refs = {products.cell(r,1).value:r for r in range(2,products.max_row+1)}
        variant_keys = {(variants.cell(r,1).value,variants.cell(r,5).value):r for r in range(2,variants.max_row+1)}

desired_variant_keys={(ref,option_en) for ref,*rest in BATCH for _n,option_en,_ar in rest[-1]}
candidate_refs={record[0] for record in BATCH}
for r in range(variants.max_row,1,-1):
    key=(variants.cell(r,1).value,variants.cell(r,5).value)
    if key[0] in candidate_refs and variants.cell(r,12).value != 'موجود مسبقًا' and key not in desired_variant_keys:
        variants.delete_rows(r,1)
variant_keys = {(variants.cell(r,1).value,variants.cell(r,5).value):r for r in range(2,variants.max_row+1)}

for ref, ar, en, brand, category, subcategory, size, cost, price, kind, choices in BATCH:
    if ref in product_refs and products.cell(product_refs[ref],23).value == 'موجود مسبقًا':
        # Existing database item: record related screens only and never duplicate it.
        pass
    elif ref not in product_refs:
        products.append([ref, ar, en, brand, category, subcategory, SUPPLIER, SUPPLIER_ID,
                         cost, price, None, None,
                         f'{ar}؛ اختر {kind} المناسب من الخيارات المتاحة.',
                         f'{ar}. المواصفات التفصيلية بحسب الملصق المرفق لكل خيار.', size,
                         None, None, kind, len(choices), None, None,
                         'صور ورسالة المورد؛ مواصفات العبوة المرئية', 'يحتاج مراجعة',
                         'لم تتم الإضافة', None, None,
                         'سجل بصري؛ الصور المرحلية تحتاج فحصًا فرديًا. لا تستورد قبل اعتماد الصورة والتصنيف والتحقق من التكرار.'])
        row=products.max_row
        products.cell(row,11,f'=IF(OR(I{row}="",J{row}=""),"",J{row}-I{row})')
        products.cell(row,12,f'=IF(OR(I{row}="",J{row}="",J{row}=0),"",(J{row}-I{row})/J{row})')
        product_refs[ref]=row
    else:
        row=product_refs[ref]
        products.cell(row,2,ar)
        products.cell(row,3,en)
        products.cell(row,4,brand)
        products.cell(row,9,cost)
        products.cell(row,10,price)
    for order,(n,option_en,option_ar) in enumerate(choices,1):
        review_image=STAGING/f'screen-{n:03d}-studio-review.webp'
        if (ref, option_en) not in variant_keys and products.cell(product_refs[ref],23).value != 'موجود مسبقًا':
            variants.append([ref, ar, kind, option_ar, option_en, size, cost, price,
                             str(review_image) if review_image.exists() else None,
                             order, None, 'يحتاج مراجعة', f'{ref}-{n}', SUPPLIER_ID])
            variant_keys[(ref,option_en)]=variants.max_row
        filename=f'ScreenHunter {n}.png'
        if filename in image_rows:
            ir=image_rows[filename]
            images.cell(ir,3,ref)
            images.cell(ir,4,option_en)
            images.cell(ir,6,str(review_image) if review_image.exists() else None)
            images.cell(ir,8,'صورة مرحلية' if review_image.exists() else 'تحتاج تجهيز')
            images.cell(ir,9,'لم تعتمد')
            images.cell(ir,13,'السعر مرتبط بسكرين المجموعة؛ راجع سجل الدفعة. لا تنقل الأصل قبل اكتمال الإدخال.')

# Group price screens and unusable files remain individually tracked.
for n in (209,220,225,231,239,244,251,257,265,272,279,292,298,310,313,317,320,323,330,336,341,346,352):
    ir=image_rows.get(f'ScreenHunter {n}.png')
    if ir:
        images.cell(ir,8,'سكرين سعر/مجموعة')
        images.cell(ir,9,'قُرئ بصريًا؛ تحقق من سجل الدفعة')
for n in (250,309):
    ir=image_rows.get(f'ScreenHunter {n}.png')
    if ir:
        images.cell(ir,8,'ملف تالف')
        images.cell(ir,9,'غير قابل للقراءة')
        images.cell(ir,13,'ارتفاع الصورة بكسل واحد؛ يحتاج نسخة أصلية سليمة.')

for r in range(2,products.max_row+1):
    products.cell(r,11,f'=IF(OR(I{r}="",J{r}=""),"",J{r}-I{r})')
    products.cell(r,12,f'=IF(OR(I{r}="",J{r}="",J{r}=0),"",(J{r}-I{r})/J{r})')

wb.save(BOOK)
print(f'Candidates: {sum(1 for x in BATCH if x[0] not in {"CAT-ALAROUSA-FEMININE-WASH"})}; variants: {sum(len(x[-1]) for x in BATCH)}')
