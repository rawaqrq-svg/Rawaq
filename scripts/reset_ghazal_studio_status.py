"""Reset rejected photo records and register only verified studio replacements."""

from pathlib import Path
import re

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "RAWAQ_Ghazal_Products.xlsx"
READY = ROOT.parent / "design" / "جاهز_للمتجر_studio_webp"

APPROVED = {
    210: READY / "fogg-magnetic-120ml-studio.webp",
    211: READY / "fogg-monarch-120ml-studio.webp",
    212: READY / "fogg-bleu-skies-120ml-studio.webp",
    213: READY / "fogg-absolute-120ml-studio.webp",
    214: READY / "fogg-extreme-120ml-studio.webp",
    215: READY / "fogg-fresh-fougere-120ml-studio.webp",
    216: READY / "fogg-master-oak-120ml-studio.webp",
    217: READY / "fogg-master-cedar-120ml-studio.webp",
    218: READY / "fogg-dynamic-120ml-studio.webp",
    219: READY / "emper-fasio-pour-femme-studio.webp",
    221: READY / "fogg-essence-women-120ml-studio.webp",
    222: READY / "fogg-napoleon-women-120ml-studio.webp",
    223: READY / "fogg-reveal-women-120ml-studio.webp",
    224: READY / "fogg-delicious-women-120ml-studio.webp",
    226: READY / "enchanteur-deodorant-gorgeous-studio.webp",
    227: READY / "enchanteur-deodorant-enticing-studio.webp",
    228: READY / "enchanteur-deodorant-romantic-studio.webp",
    229: READY / "enchanteur-deodorant-alluring-studio.webp",
    230: READY / "enchanteur-deodorant-charming-studio.webp",
    232: READY / "rexona-biorhythm-studio.webp",
    233: READY / "rexona-invisible-pure-studio.webp",
    234: READY / "rexona-tropical-studio.webp",
    235: READY / "rexona-shower-fresh-studio.webp",
    236: READY / "rexona-antibacterial-protection-studio.webp",
    237: READY / "rexona-invisible-aqua-studio.webp",
    238: READY / "rexona-cotton-dry-studio.webp",
    240: READY / "old-spice-epic-legend-studio.webp",
    241: READY / "old-spice-captain-studio.webp",
    242: READY / "old-spice-bearglove-studio.webp",
    243: READY / "riggs-venom-250ml-studio.webp",
    245: READY / "riggs-dynamo-250ml-studio.webp",
    246: READY / "riggs-power-250ml-studio.webp",
    247: READY / "riggs-the-one-250ml-studio.webp",
    248: READY / "riggs-oud-250ml-studio.webp",
    249: READY / "riggs-icon-250ml-studio.webp",
    252: READY / "secret-aloe-cucumber-studio.webp",
    253: READY / "secret-white-peach-studio.webp",
    254: READY / "secret-pomegranate-studio.webp",
    255: READY / "secret-lavender-studio.webp",
    256: READY / "secret-waterlily-studio.webp",
    258: READY / "dove-go-fresh-pomegranate-studio.webp",
    259: READY / "dove-go-fresh-pear-studio.webp",
    260: READY / "dove-nourishing-secrets-coconut-studio.webp",
    261: READY / "dove-original-studio.webp",
    262: READY / "dove-go-fresh-apple-studio.webp",
    264: READY / "dove-invisible-care-studio.webp",
    266: READY / "confetti-maya-250ml-studio.webp",
    267: READY / "confetti-joy-250ml-studio.webp",
    268: READY / "confetti-chocolate-250ml-studio.webp",
    269: READY / "confetti-dear-250ml-studio.webp",
    270: READY / "confetti-pretty-250ml-studio.webp",
    271: READY / "confetti-secret-250ml-studio.webp",
    273: READY / "emper-chifon-rouge-studio.webp",
    274: READY / "emper-fasio-intense-studio.webp",
    275: READY / "emper-twist-studio.webp",
    276: READY / "emper-legend-femme-studio.webp",
    277: READY / "emper-chifon-studio.webp",
    278: READY / "emper-salga-studio.webp",
    280: READY / "emotion-detox-fresh-studio.webp",
    281: READY / "emotion-natural-bloom-studio.webp",
    282: READY / "emotion-aqua-kiss-studio.webp",
    283: READY / "emotion-invisible-fresh-studio.webp",
    284: READY / "higeen-double-fresh-black-rollon-studio.webp",
    285: READY / "higeen-fruity-fresh-rollon-studio.webp",
    286: READY / "higeen-hair-minimizing-rollon-studio.webp",
    287: READY / "dove-radiant-care-vitamin-care-studio.webp",
    288: READY / "dove-radiant-care-collagen-studio.webp",
    289: READY / "dove-radiant-care-night-repair-studio.webp",
    290: READY / "dove-radiant-care-sensitive-studio.webp",
    291: READY / "vaseline-glutaglow-bright-renew-rollon-studio.webp",
    293: READY / "enchanteur-rollon-stunning-studio.webp",
    294: READY / "enchanteur-rollon-enticing-studio.webp",
    295: READY / "enchanteur-rollon-charming-studio.webp",
    296: READY / "enchanteur-rollon-alluring-studio.webp",
    297: READY / "enchanteur-rollon-romantic-studio.webp",
    299: READY / "boutique-rollon-cotton-dry-studio.webp",
    300: READY / "boutique-rollon-candy-studio.webp",
    301: READY / "boutique-rollon-arrogate-pink-studio.webp",
    302: READY / "boutique-rollon-marshmallow-studio.webp",
    303: READY / "boutique-rollon-natural-touch-studio.webp",
    304: READY / "boutique-rollon-shower-fresh-studio.webp",
    305: READY / "boutique-rollon-her-studio.webp",
    306: READY / "boutique-rollon-stress-resist-studio.webp",
    307: READY / "boutique-rollon-free-spirit-studio.webp",
    308: READY / "boutique-rollon-baby-powder-pink-studio.webp",
    311: READY / "elegance-plus-hair-serum-aloe-vera-studio.webp",
    312: READY / "elegance-plus-hair-serum-coconut-oil-studio.webp",
    314: READY / "alarousa-feminine-wash-strawberry-studio.webp",
    315: READY / "alarousa-feminine-wash-attractive-scent-studio.webp",
    316: READY / "alarousa-feminine-wash-tutti-frutti-studio.webp",
    318: READY / "alarousa-dead-sea-scrub-tutti-frutti-studio.webp",
    319: READY / "alarousa-dead-sea-scrub-marshmallow-studio.webp",
    321: READY / "vaseline-gluta-vitamin-firm-glow-180ml-studio.webp",
    322: READY / "vaseline-gluta-vitamin-hijab-radiant-180ml-studio.webp",
    324: READY / "enchanteur-satin-lotion-charming-studio.webp",
    325: READY / "enchanteur-satin-lotion-alluring-studio.webp",
    326: READY / "enchanteur-satin-lotion-elegant-musk-studio.webp",
    327: READY / "enchanteur-satin-lotion-romantic-studio.webp",
    328: READY / "enchanteur-satin-lotion-enticing-studio.webp",
    329: READY / "enchanteur-satin-lotion-gorgeous-studio.webp",
    331: READY / "agrado-body-milk-rosa-mosqueta-400ml-studio.webp",
    332: READY / "agrado-body-milk-aloe-vera-400ml-studio.webp",
    333: READY / "agrado-body-milk-coconut-400ml-studio.webp",
    334: READY / "agrado-body-milk-argan-400ml-studio.webp",
    335: READY / "agrado-body-milk-sweet-almond-400ml-studio.webp",
    337: READY / "vaseline-intensive-care-cocoa-glow-400ml-studio.webp",
    338: READY / "vaseline-intensive-care-advanced-repair-400ml-studio.webp",
    339: READY / "vaseline-intensive-care-aloe-soothe-400ml-studio.webp",
    340: READY / "vaseline-intensive-care-dry-skin-repair-400ml-studio.webp",
    342: READY / "mbc-ultra-almond-oil-lotion-500ml-studio.webp",
    343: READY / "mbc-ultra-argan-oil-lotion-500ml-studio.webp",
    344: READY / "mbc-ultra-jojoba-oil-lotion-500ml-studio.webp",
    345: READY / "mbc-ultra-coconut-oil-lotion-500ml-studio.webp",
    347: READY / "boutique-charcoal-scrub-600ml-studio.webp",
    348: READY / "boutique-avocado-scrub-600ml-studio.webp",
    349: READY / "boutique-peach-scrub-600ml-studio.webp",
    350: READY / "boutique-aloe-vera-scrub-600ml-studio.webp",
    351: READY / "boutique-strawberry-scrub-600ml-studio.webp",
    353: READY / "glysolid-classic-body-lotion-studio.webp",
    354: READY / "glysolid-musk-body-lotion-studio.webp",
    355: READY / "sence-hydro-shock-body-lotion-studio.webp",
    356: READY / "boutique-baby-powder-pink-lotion-480ml-studio.webp",
}


def main() -> None:
    workbook = load_workbook(WORKBOOK)
    images = workbook["Images"]
    reset_count = 0
    approved_count = 0

    for row in range(2, images.max_row + 1):
        screen_name = images.cell(row, 1).value
        final_name = images.cell(row, 5).value
        match = re.fullmatch(r"ScreenHunter (\d+)\.png", str(screen_name or ""))
        if not match:
            continue

        number = int(match.group(1))
        if final_name and re.fullmatch(r".+-screen-\d{3}-studio\.webp", str(final_name)):
            images.cell(row, 5, None)
            images.cell(row, 6, None)
            images.cell(row, 8, "قيد إعادة إنتاج الاستديو")
            images.cell(row, 9, "المخرج السابق مرفوض: كان قص خلفية وليس تصوير استديو")
            images.cell(row, 10, "في المجلد الجديد")
            reset_count += 1

        approved_path = APPROVED.get(number)
        if approved_path:
            if not approved_path.exists():
                raise FileNotFoundError(approved_path)
            images.cell(row, 5, approved_path.name)
            images.cell(row, 6, str(approved_path))
            images.cell(row, 8, "صورة استديو مولدة جاهزة")
            images.cell(row, 9, "مراجعة بصرية: خلفية بيضاء، إضاءة استديو، عبوة وهوية واضحة")
            images.cell(row, 10, "في المجلد الجديد")
            approved_count += 1

    workbook.save(WORKBOOK)
    print(f"Reset rejected records: {reset_count}; registered verified images: {approved_count}")


if __name__ == "__main__":
    main()
