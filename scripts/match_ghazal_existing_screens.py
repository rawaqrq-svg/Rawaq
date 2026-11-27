"""Link first supplier screenshots to existing Ghazal catalog groups.

Only records visual matches for review. Does not move files or mutate the DB.
"""
from openpyxl import load_workbook
from pathlib import Path

book=Path(__file__).resolve().parents[1]/'RAWAQ_Ghazal_Products.xlsx'
wb=load_workbook(book)
ws=wb['Images']
existing={r[0].value for r in wb['Products'].iter_rows(min_row=2) if r[22].value=='موجود مسبقًا'}
groups=[
 ((1,17),'ALHANAN-MIST-LOTION-SET-300X2'),
 ((18,22),'ASKIM-BODY-HAIR-SET-5PC'),
 ((23,27),'ASKIM-BODY-SPLASH-250'),
 ((28,32),'ASKIM-BODY-LOTION-350'),
 ((33,37),'ASKIM-BODY-BUTTER-250'),
 ((38,42),'ASKIM-SHOWER-GEL-350'),
 ((43,47),'ASKIM-HAIR-MIST-100'),
 ((48,49),'GHAZ-HAIR-048'),
 ((50,52),'GHAZ-HAIR-050'),
 ((53,56),'GHAZ-BODY-PARACHUTE'),
 ((57,61),'GHAZ-HAIR-057'),
 ((62,62),'GHAZ-HAIR-062'),
 ((63,63),'GHAZ-HAIR-063'),
 ((64,64),'GHAZ-HAIR-064'),
 ((65,65),'GHAZ-HAIR-065'),
 ((66,66),'GHAZ-HAIR-066'),
 ((67,67),'GHAZ-HAIR-067'),
 ((68,71),'GHAZ-COSMO-SHOWER-SCRUB'),
 ((72,76),'GHAZ-COOLKING-TALC'),
 ((78,78),'CAT-COSMO-SALT-BODY-SCRUB'),
 ((79,79),'CAT-COSMO-SHEA-SUGAR-SCRUB'),
 ((80,80),'CAT-ALAROUSA-BODY-OIL'),
 ((81,81),'CAT-COSMO-SHEA-SUGAR-SCRUB'),
 ((82,87),'CAT-ALAROUSA-BRUSH-FACE-WASH'),
 ((88,96),'CAT-ALAROUSA-BODY-SOAP'),
 ((97,101),'CAT-ALAROUSA-BIKINI-SCRUB'),
 ((102,105),'CAT-ALAROUSA-BODY-SPLASH'),
 ((106,109),'CAT-ALAROUSA-FEMININE-WASH'),
 ((110,110),'CAT-ALAROUSA-MOISTURIZING-FACE-CREAM'),
 ((111,118),'CAT-DEEP-LOVE-BODY-OIL'),
 ((119,119),'CAT-COSMO-SHEA-SUGAR-SCRUB'),
 ((120,120),'CAT-ALAROUSA-FACIAL-SCRUB'),
 ((121,121),'CAT-ALAROUSA-NATURAL-ROSE-WATER'),
 ((122,132),'CAT-ALAROUSA-BODY-BUTTER'),
 ((133,144),'CAT-ALAROUSA-BODY-SCRUB'),
 ((145,145),'CAT-ALAROUSA-PHEROMONE-MUSK'),
 ((146,151),'CAT-COSMO-FACE-MASK'),
 ((152,160),'CAT-COSMO-BODY-LOTION'),
 ((161,166),'CAT-COSMO-FOAMING-FACE-WASH'),
 ((167,167),'CAT-ALAROUSA-GAZELLE-HEEL-SKIN-CREAM'),
 ((168,168),'CAT-ALAROUSA-MOROCCAN-NILA-MASK'),
 ((169,169),'CAT-ALAROUSA-BIKINI-BUTTER'),
 ((170,171),'CAT-ALAROUSA-BODY-SCRUB'),
 ((172,186),'CAT-ALAROUSA-PHEROMONE-MUSK'),
 ((187,187),'CAT-ALAROUSA-MOROCCAN-NILA-MASK'),
 ((188,188),'CAT-ALAROUSA-GAZELLE-HEEL-SKIN-CREAM'),
 ((189,194),'CAT-COSMO-FACE-MASK'),
]
mapping={n:ref for (lo,hi),ref in groups for n in range(lo,hi+1)}
missing_refs=set(mapping.values())-existing
if missing_refs: raise SystemExit(f'Existing references missing in DB snapshot: {missing_refs}')
linked=0
for row in range(2,ws.max_row+1):
    name=ws.cell(row,1).value
    if not name or not name.startswith('ScreenHunter '): continue
    n=int(name.removeprefix('ScreenHunter ').removesuffix('.png'))
    if n not in mapping:continue
    ws.cell(row,3,mapping[n])
    ws.cell(row,8,'منتج موجود مسبقًا')
    ws.cell(row,9,'مطابقة المجموعة بصريًا؛ يلزم فحص الخيار والسعر والصورة')
    ws.cell(row,10,'في المجلد الجديد')
    ws.cell(row,13,'مطابقة أولية مع منتج غزل قائم. لا تكرر المنتج ولا تؤرشف السكرين قبل تحقق الخيار/السعر/الصورة.')
    linked+=1
wb.save(book)
print(f'Linked {linked} existing screenshots; {len(mapping)} mapped screen numbers')
