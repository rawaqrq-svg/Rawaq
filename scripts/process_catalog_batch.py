import os
import shutil
from PIL import Image, ImageDraw, ImageFilter
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Ensure directories exist
os.makedirs("design/جاهز_للمتجر_processed_webp", exist_ok=True)
os.makedirs("design/07_سكرينات_مكتملة_done", exist_ok=True)
os.makedirs("design/بيانات_المنتجات_excel", exist_ok=True)
os.makedirs("public/images/products", exist_ok=True)

# List of 22 products from ScreenHunter 02 to ScreenHunter 23
products = [
    {
        "file": "ScreenHunter 02.png",
        "sku": "GHAZ-SET-002",
        "img_name": "GHAZ-SET-002-khamrah-mist-lotion.webp",
        "name_ar": "بكج خمرة (سبلاش + لوشن)",
        "name_en": "Khamrah Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "العنبر، التوابل الحلوة، الفانيليا والقهوة، أخشاب العود",
        "description": "ثنائية شرقية دافئة مستوحاة من عطر خمرة الشهير، تجمع بين سبلاش الجسم الفواح ولوشن الترطيب العميق بملمس حريري.",
        "highlights": "• ثبات عطري شرقي يدوم طويلاً\n• لوشن مغذي يحمي من الجفاف\n• عبوات بحجم كبير 300 مل لكل عبوة\n• غطاء بخاخ متين ومضخة عملية",
        "seo": "بكج خمرة, سبلاش خمرة, لوشن خمرة, الحنان سينسز, عطور شرقية, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 03.png",
        "sku": "GHAZ-SET-003",
        "img_name": "GHAZ-SET-003-mousuf-wardi-set.webp",
        "name_ar": "بكج موصوف وردي (سبلاش + لوشن)",
        "name_en": "Mousuf Wardi Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "عبير الورود المخملية، نفحات الفواكه المنعشة، لمسة مسك أبيض",
        "description": "مزيج أنثوي ساحر مستوحى من عطر موصوف وردي، يمنح الجسم انتعاشاً يدوم طوال اليوم مع ترطيب حريري ناعم.",
        "highlights": "• نفحات زهرية أنثوية ناعمة\n• ترطيب لطيف يحمي من الجفاف\n• مناسب للاستخدام اليومي بعد الاستحمام\n• حجم اقتصادي 300 مل للعبوة",
        "seo": "بكج موصوف وردي, سبلاش موصوف, لوشن موصوف وردي, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 04.png",
        "sku": "GHAZ-SET-004",
        "img_name": "GHAZ-SET-004-sabaya-set.webp",
        "name_ar": "بكج صبايا (سبلاش + لوشن)",
        "name_en": "Sabaya Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "عبير الأزهار الشرقية والفرنسية، نفحات الحمضيات المنعشة، لمسة مسك",
        "description": "توليفة مفعمة بالحيوية والشباب والانتعاش مستوحاة من عطر صبايا، تمنحك إحساساً بالنظافة والبهجة طوال اليوم.",
        "highlights": "• رائحة حمضية وزهرية منعشة\n• ترطيب وتنعيم سريع الامتصاص\n• ثبات عطري يدوم لساعات\n• عبوتين 300 مل بمضخة وبخاخ عالي الجودة",
        "seo": "بكج صبايا, سبلاش صبايا, لوشن صبايا, معطر جسم صبايا, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 05.png",
        "sku": "GHAZ-SET-005",
        "img_name": "GHAZ-SET-005-mashaer-set.webp",
        "name_ar": "بكج مشاعر (سبلاش + لوشن)",
        "name_en": "Mashaer Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "المسك الأبيض، العود الخفيف، لمسات سكرية وزهرية دافئة",
        "description": "طابع شرقي دافئ ومليء بالإحساس مستوحى من عطر مشاعر الفاخر، يعكس الفخامة والتميز مع ترطيب عميق.",
        "highlights": "• عطر شرقي دافئ وساحر\n• لوشن غني لترطيب وتغذية البشرة\n• ثبات يدوم طويلاً\n• حجم كبير 300 مل للعبوة",
        "seo": "بكج مشاعر, سبلاش مشاعر, لوشن مشاعر, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 06.png",
        "sku": "GHAZ-SET-006",
        "img_name": "GHAZ-SET-006-now-set.webp",
        "name_ar": "بكج ناو (سبلاش + لوشن)",
        "name_en": "NOW Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "عبير الأزهار الرقيقة، لمسات حيوية خفيفة، انتعاش بودري",
        "description": "عطر عصري ينبض بالحيوية والانتعاش اليومي، يمنحك عبقاً فواحاً مع لوشن ترطيب يومي ناعم غير لزج.",
        "highlights": "• انتعاش يومي فوري ونظافة فائقة\n• لوشن خفيف وسريع الامتصاص\n• مناسب للصباح والعمل والنادي\n• حجم 300 مل للعبوة",
        "seo": "بكج ناو, سبلاش ناو, لوشن ناو, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 07.png",
        "sku": "GHAZ-SET-007",
        "img_name": "GHAZ-SET-007-rose-paris-set.webp",
        "name_ar": "بكج روز باريس (سبلاش + لوشن)",
        "name_en": "Rose Paris Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "الورد الجوري، ورود فرنسية كلاسيكية، مسحات مسك وبودرة ناعمة",
        "description": "سحر الأناقة الباريسية الكلاسيكية بعبير الورد الطبيعي الفاخر، لترطيب البشرة بعمق ومنحها رائحة رومانسية جذابة.",
        "highlights": "• رائحة ورد جوري فرنسي كلاسيكي\n• ترطيب فائق يدوم طوال اليوم\n• يعكس الأناقة والأنوثة الصافية\n• عبوتين 300 مل",
        "seo": "بكج روز باريس, سبلاش روز باريس, لوشن روز باريس, عطر روز باريس, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 08.png",
        "sku": "GHAZ-SET-008",
        "img_name": "GHAZ-SET-008-yara-set.webp",
        "name_ar": "بكج يارا (سبلاش + لوشن)",
        "name_en": "Yara Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "الفانيليا، المسك، نوتات سكرية دافئة، أزهار وفواكه استوائية",
        "description": "رائحة سويت أنثوية ناعمة مستوحاة من عطر يارا الوردي الشهير، تمنح الجسم ملمساً كالحرير وهالة عطرية مغرية.",
        "highlights": "• من أكثر الروائح طلباً وشهرة\n• مزيج فانيليا ومسك سويت ناعم\n• لوشن مغذي ومضاد للجفاف\n• عبوات 300 مل",
        "seo": "بكج يارا, سبلاش يارا, لوشن يارا, عطر يارا الوردي, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 09.png",
        "sku": "GHAZ-SET-009",
        "img_name": "GHAZ-SET-009-bint-hooran-set.webp",
        "name_ar": "بكج بنت حوران (سبلاش + لوشن)",
        "name_en": "Bint Hooran Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "اللافندر الخزامى، الزهور البيضاء، نفحات شرقية دافئة، عنبر",
        "description": "عبق شرقي دافئ يجمع بين الأصالة والجاذبية مستوحى من عطر بنت حوران، لتهدئة البشرة وتعطيرها بثبات عالي.",
        "highlights": "• نفحات الخزامى والزهور البيضاء المهدئة\n• ترطيب مكثف وملمس حريري\n• ثبات ممتاز يدوم طويلاً\n• حجم كبير 300 مل للعبوة",
        "seo": "بكج بنت حوران, سبلاش بنت حوران, لوشن بنت حوران, عطر بنت حوران, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 10.png",
        "sku": "GHAZ-SET-010",
        "img_name": "GHAZ-SET-010-jasmine-flower-set.webp",
        "name_ar": "بكج وردة الياسمين (سبلاش + لوشن)",
        "name_en": "Jasmine Flower Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "زهرة الياسمين الطبيعية، أزهار بيضاء، لمحات حمضية خفيفة",
        "description": "نقاء زهور الياسمين البيضاء مع لمسة ليمون منعشة، لتجربة انتعاش بعد الاستحمام وترطيب مغذي يحمي من الجفاف.",
        "highlights": "• رائحة ياسمين طبيعي نقي وغير مزعج\n• لوشن سريع الامتصاص بملمس مخملي\n• عبير فواح ينتشر بسرعة\n• حجم اقتصادي 300 مل",
        "seo": "بكج وردة الياسمين, سبلاش ياسمين, لوشن ياسمين, معطر جسم ياسمين, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 11.png",
        "sku": "GHAZ-SET-011",
        "img_name": "GHAZ-SET-011-yara-candy-set.webp",
        "name_ar": "بكج يارا كاندي (سبلاش + لوشن)",
        "name_en": "Yara Candy Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "غزل البنات (شعر البنات)، فراولة محلاة، فانيليا دافئة وخفيفة",
        "description": "تشكيلة سكرية لذيذة ومبهجة لعشاق الروائح الحلوة، تمنح الجسم ملمساً مخملياً ناعماً ونفحات حلويات تدوم طويلاً.",
        "highlights": "• رائحة كاندي وغزل بنات سويت مغرية\n• ترطيب غني يمنح البشرة إشراقة ونعومة\n• مناسب للجسم والشعر بعد الاستحمام\n• عبوتين 300 مل",
        "seo": "بكج يارا كاندي, سبلاش يارا كاندي, لوشن يارا كاندي, عطر يارا كاندي, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 12.png",
        "sku": "GHAZ-SET-012",
        "img_name": "GHAZ-SET-012-kayali-juicy-apple-set.webp",
        "name_ar": "بكج كيالي تفاح (سبلاش + لوشن)",
        "name_en": "Kayali Juicy Apple Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "تفاح أحمر منعش، فواكه حمراء حلوة، توت العليق، فانيليا",
        "description": "عبير فاكهي منعش ومرح مستوحى من عطر كيالي جوسي أبل، لإطلالة أنثوية مليئة بالحيوية وترطيب عميق للبشرة.",
        "highlights": "• انتعاش التفاح الأحمر والفواكه الحلوة\n• لوشن ناعم لتثبيت الرائحة لساعات أطول\n• مظهر جذاب وحجم كبير 300 مل\n• ثبات مضاعف",
        "seo": "بكج كيالي تفاح, سبلاش كيالي جوسي ابل, لوشن كيالي, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 13.png",
        "sku": "GHAZ-SET-013",
        "img_name": "GHAZ-SET-013-fasio-set.webp",
        "name_ar": "بكج فاسيو (سبلاش + لوشن)",
        "name_en": "FASIO Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "حلاوة سكرية، أزهار قوية، لمسات عطرية شرقية وغربية فواحة",
        "description": "تركيبة قوية وأنثوية (Sweet & Strong) مستوحاة من عطر فاسيو، تجمع بين الحلاوة والفوحان العالي مع ترطيب مغذي.",
        "highlights": "• عطر قوي وجذاب يدوم طوال اليوم\n• ترطيب عميق يحمي من الجفاف\n• عبوتين 300 مل مع مضخة عملية\n• إطلالة لافتة ومميزة",
        "seo": "بكج فاسيو, سبلاش فاسيو, لوشن فاسيو, عطر فاسيو, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 14.png",
        "sku": "GHAZ-SET-001",
        "img_name": "GHAZ-SET-001-qissat-one-and-only-set.webp",
        "name_ar": "بكج قصة (سبلاش + لوشن)",
        "name_en": "Qissat (One & Only) Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "باشن فروت، خوخ، ياسمين، كراميل، مسك أبيض، عنبر",
        "description": "ثنائية أنثوية ساحرة مستوحاة من عطر قصة ون أند أونلي، تمنحك عبقاً فواحاً يدوم طوال اليوم وترطيباً مخملياً كالحرير.",
        "highlights": "• مستوحى من أشهر العطور الخليجية\n• لوشن مخملي سريع الامتصاص\n• ثبات عطري عالي ومميز\n• حجم كبير 300 مل للعبوة",
        "seo": "بكج قصة, سبلاش قصة, لوشن قصة, ون اند اونلي, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 15.png",
        "sku": "GHAZ-SET-015",
        "img_name": "GHAZ-SET-015-armani-you-set.webp",
        "name_ar": "بكج أرماني يو (سبلاش + لوشن)",
        "name_en": "Armani You Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "توت بري، ورد جوري، فانيليا دافئة، لمسات عنبرية وخشبية",
        "description": "طابع عطري فاخر وجريء مستوحى من عطر أرماني يو، يعكس الفخامة والنعومة في كل تفصيلة مع ترطيب عميق.",
        "highlights": "• عطر فاخر يجمع بين الفخامة والنعومة\n• ترطيب مكثف يمنح البشرة ملمساً كالحرير\n• مناسب للمناسبات الخاصة واليومية\n• عبوتين 300 مل",
        "seo": "بكج ارماني يو, سبلاش ارماني يو, لوشن ارماني يو, عطر ارماني يو, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 16.png",
        "sku": "GHAZ-SET-016",
        "img_name": "GHAZ-SET-016-mousuf-oud-coffee-set.webp",
        "name_ar": "بكج موصوف عود وقهوة (سبلاش + لوشن)",
        "name_en": "Mousuf Oud & Coffee Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "قهوة محمصة دافئة، عود شرقي أصيل، لمسات كراميل ومسك",
        "description": "مزيج شرقي دافئ وساحر يجمع بين القهوة والعود الفاخر، لتجربة تعطير شتوية غنية وترطيب ناعم للبشرة.",
        "highlights": "• مزيج العود والقهوة الدافئ شديد الفخامة\n• لوشن معزز لترطيب البشرة وحمايتها من الجفاف\n• ثبات وقوة فوحان استثنائية\n• عبوتين 300 مل",
        "seo": "بكج موصوف عود وقهوة, سبلاش موصوف بني, لوشن موصوف عود, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 17.png",
        "sku": "GHAZ-SET-017",
        "img_name": "GHAZ-SET-017-qissa-oud-coffee-set.webp",
        "name_ar": "بكج قصة عود وقهوة (سبلاش + لوشن)",
        "name_en": "Qissa Oud & Coffee Body Mist & Lotion Set",
        "brand": "Alhanan Senses",
        "category": "العطور والبخور",
        "subcategory": "معطرات وبكجات الجسم",
        "cost": 3.00,
        "price": 5.00,
        "volume": "300 مل × 2 (إجمالي 600 مل)",
        "contents": "سبلاش معطر 300 مل + لوشن مرطب 300 مل",
        "notes": "العود الفاخر، القهوة الدافئة، الزهور البيضاء الناعمة",
        "description": "إصدار قصة الملكي الكحلي الذي يجمع بين أصالة العود والدفء المريح، لثبات يدوم ساعات طويلة على الجسم.",
        "highlights": "• عبير الفخامة بين العود والقهوة\n• توازن وانتعاش ناعم بالزهور البيضاء\n• ترطيب غني ومثالي بعد الاستحمام\n• عبوات فاخرة 300 مل",
        "seo": "بكج قصة كحلي, سبلاش قصة عود, لوشن قصة عود وقهوة, الحنان سينسز, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 18.png",
        "sku": "GHAZ-ASK-018",
        "img_name": "GHAZ-ASK-018-askim-rose-5pcs-set.webp",
        "name_ar": "مجموعة آشكيم روز 5 قطع",
        "name_en": "ASKIM Rose 5-Piece Body & Hair Care Collection",
        "brand": "ASKIM Cosmetics",
        "category": "الهدايا والبكجات",
        "subcategory": "بكجات العناية الفاخرة",
        "cost": 14.25,
        "price": 20.00,
        "volume": "طقم متكامل 5 قطع للشعر والجسم",
        "contents": "زبدة جسم + معطر شعر + جل استحمام + لوشن جسم + سبلاش جسم",
        "notes": "عبير الورد الأحمر الساحر، بتلات الورد المخملية، المسك الناعم",
        "description": "تشكيلة فاخرة ورومانسية للعناية بالجسم والشعر بنفحات الورد الأحمر، روتين كامل يمنحك النعومة والدلال المطلق.",
        "highlights": "• بوكس هدية فاخر متكامل 5 في 1\n• عناية شاملة للشعر والجسم بالورد الأحمر\n• زبدة ولوشن ترطيب مكثف وعميق\n• جل استحمام ومعطر شعر وسبلاش يدوم طويلاً",
        "seo": "مجموعة اشكيم روز, بكج اسكيم ورد, بوكس عناية اشكيم, عطور اشكيم, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 19.png",
        "sku": "GHAZ-ASK-019",
        "img_name": "GHAZ-ASK-019-askim-sweet-5pcs-set.webp",
        "name_ar": "مجموعة آشكيم سويت 5 قطع",
        "name_en": "ASKIM Sweet 5-Piece Body & Hair Care Collection",
        "brand": "ASKIM Cosmetics",
        "category": "الهدايا والبكجات",
        "subcategory": "بكجات العناية الفاخرة",
        "cost": 14.25,
        "price": 20.00,
        "volume": "طقم متكامل 5 قطع للشعر والجسم",
        "contents": "زبدة جسم + معطر شعر + جل استحمام + لوشن جسم + سبلاش جسم",
        "notes": "نفحات أنثوية سويت حلوة، فواكه، فانيليا ومسك أبيض",
        "description": "تشكيلة رقيقة ومبهجة للعناية بالجسم والشعر بنفحات سويت حلوة تمنحك إحساساً بالدلال والراحة اليومية الفاخرة.",
        "highlights": "• بوكس عناية سويت متكامل 5 قطع\n• رائحة حلوة تدوم لساعات طويلة\n• زبدة غنية تمنح البشرة نعومة فائقة\n• معطر شعر آمن ولطيف",
        "seo": "مجموعة اشكيم سويت, بكج اسكيم سويت, بوكس هدايا اشكيم, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 20.png",
        "sku": "GHAZ-ASK-020",
        "img_name": "GHAZ-ASK-020-askim-moon-5pcs-set.webp",
        "name_ar": "مجموعة آشكيم مون 5 قطع",
        "name_en": "ASKIM Moon 5-Piece Body & Hair Care Collection",
        "brand": "ASKIM Cosmetics",
        "category": "الهدايا والبكجات",
        "subcategory": "بكجات العناية الفاخرة",
        "cost": 14.25,
        "price": 20.00,
        "volume": "طقم متكامل 5 قطع للشعر والجسم",
        "contents": "زبدة جسم + معطر شعر + جل استحمام + لوشن جسم + سبلاش جسم",
        "notes": "غموض وجمال الليل، لافندر ناعم، أزهار بنفسجية، مسك ليلي ساحر",
        "description": "تشكيلة ساحرة وراقية مستوحاة من غموض وجمال الليل لتمنحك إحساساً بالأناقة المطلقة وترطيباً مكثفاً للبشرة والشعر.",
        "highlights": "• طابع عطري ليلي ساحر وغامض\n• روتين عناية ليلي مهدئ للأعصاب\n• جل استحمام منعش وزبدة ترطيب فائقة\n• 5 قطع بحجم مثالي",
        "seo": "مجموعة اشكيم مون, بكج اسكيم مون, بوكس اشكيم بنفسجي, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 21.png",
        "sku": "GHAZ-ASK-021",
        "img_name": "GHAZ-ASK-021-askim-classic-5pcs-set.webp",
        "name_ar": "مجموعة آشكيم كلاسيك 5 قطع",
        "name_en": "ASKIM Classic 5-Piece Body & Hair Care Collection",
        "brand": "ASKIM Cosmetics",
        "category": "الهدايا والبكجات",
        "subcategory": "بكجات العناية الفاخرة",
        "cost": 14.25,
        "price": 20.00,
        "volume": "طقم متكامل 5 قطع للشعر والجسم",
        "contents": "زبدة جسم + معطر شعر + جل استحمام + لوشن جسم + سبلاش جسم",
        "notes": "طابع كلاسيكي دافئ، عنبر، أزهار صفراء، لمسات خشبية راقية ومسك",
        "description": "تشكيلة فاخرة بطابع كلاسيكي دافئ يمنحك الأناقة والراحة، تركيبة غنية تغذي البشرة والشعر بنعومة تدوم طويلاً.",
        "highlights": "• عطر كلاسيكي دافئ وراقي يناسب كل الأوقات\n• زبدة ولوشن امتصاص سريع\n• بوكس 5 قطع أنيق جداً للإهداء\n• ثبات وفوحان رائع",
        "seo": "مجموعة اشكيم كلاسيك, بكج اسكيم اصفر, بوكس عناية كلاسيك, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 22.png",
        "sku": "GHAZ-ASK-022",
        "img_name": "GHAZ-ASK-022-askim-fresh-5pcs-set.webp",
        "name_ar": "مجموعة آشكيم فريش 5 قطع",
        "name_en": "ASKIM Fresh 5-Piece Body & Hair Care Collection",
        "brand": "ASKIM Cosmetics",
        "category": "الهدايا والبكجات",
        "subcategory": "بكجات العناية الفاخرة",
        "cost": 14.25,
        "price": 20.00,
        "volume": "طقم متكامل 5 قطع للشعر والجسم",
        "contents": "زبدة جسم + معطر شعر + جل استحمام + لوشن جسم + سبلاش جسم",
        "notes": "حمضيات طبيعية منعشة، زهور بيضاء مائية، شاي أخضر ومسك ناعم",
        "description": "تشكيلة متكاملة للعناية بالجسم والشعر مصممة لتمنحك انتعاشاً وإشراقة طبيعية مبهجة تدوم طوال اليوم.",
        "highlights": "• انتعاش فريش طبيعي لا يقاوم\n• جل استحمام برغوة غنية منعشة\n• ترطيب يومي خفيف وسريع الامتصاص\n• 5 قطع متكاملة",
        "seo": "مجموعة اشكيم فريش, بكج اسكيم اخضر, بوكس اشكيم فريش, محل غزل للمكياجات"
    },
    {
        "file": "ScreenHunter 23.png",
        "sku": "GHAZ-SPL-023",
        "img_name": "GHAZ-SPL-023-askim-rose-splash-250ml.webp",
        "name_ar": "سبلاش آشكيم روز 250ml",
        "name_en": "ASKIM Rose Body Splash 250ml",
        "brand": "ASKIM Cosmetics",
        "category": "العطور والبخور",
        "subcategory": "معطرات جسم وبودي سبلاش",
        "cost": 3.25,
        "price": 5.00,
        "volume": "250 مل",
        "contents": "عبوة بودي سبلاش بخاخ 250 مل",
        "notes": "توت وبرتقال، زهور بيضاء، ياسمين، فانيليا، مسك وعنبر",
        "description": "رذاذ عطري منعش برائحة الورد والفواكه، يُرش على كامل الجسم بعد الاستحمام ليمنحك إحساساً بالنظافة والأنوثة الدائمة.",
        "highlights": "• مزيج ساحر يجمع بين الفواكه والزهور والمسك\n• حجم 250 مل مناسب للحقيبة والاستخدام اليومي\n• ثبات عطري ممتاز\n• انتعاش فوري بعد الاستحمام",
        "seo": "سبلاش اشكيم روز, بودي سبلاش اشكيم, معطر جسم اشكيم 250, محل غزل للمكياجات"
    }
]

# 1. Process Images
print("--- بدء معالجة الصور وتحويلها للديزاين الموحد (WebP 1:1) ---")
inbox_dir = "design/00_سكرينات_جديدة_inbox"
done_dir = "design/07_سكرينات_مكتملة_done"
out_dir = "design/جاهز_للمتجر_processed_webp"

for p in products:
    f_path = os.path.join(inbox_dir, p["file"])
    if not os.path.exists(f_path):
        f_path = os.path.join(done_dir, p["file"])
        if not os.path.exists(f_path):
            print(f"Warning: file {p['file']} not found!")
            continue

    img = Image.open(f_path).convert("RGB")
    w, h = img.size

    # The product card is always the leading visual at the top of the WhatsApp
    # screenshot.  Crop that card explicitly, rather than trying to infer a
    # boundary from white text rows (which used to leak chat copy into the
    # store image).  ScreenHunter 02 contains two cards; the left card is the
    # Khamrah product recorded above.
    top = max(15, int(h * 0.03))
    bottom = int(h * 0.48)
    left = 18
    right = int(w * 0.70)
    if p["file"] == "ScreenHunter 02.png":
        right = int(w * 0.40)
        bottom = int(h * 0.41)
    elif p["sku"].startswith("GHAZ-SPL"):
        # The single 250 ml splash uses a wider visual card than the sets.
        top = int(h * 0.10)
        bottom = int(h * 0.59)
        left = int(w * 0.08)
        right = int(w * 0.76)

    # Keep a useful minimum crop when a future screenshot has a compact card.
    right = min(w - 12, max(right, left + 120))
    bottom = min(h - 12, max(bottom, top + 160))

    cropped = img.crop((left, top, right, bottom)).convert("RGBA")

    # Composite onto 1200x1200 pure white canvas with rounded corners and soft shadow
    canvas_size = 1200
    target_h = 960
    scale = target_h / cropped.height
    target_w = int(cropped.width * scale)
    if target_w > 1050:
        target_w = 1050
        target_h = int(cropped.height * (1050 / cropped.width))

    resized_crop = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # Rounded rectangle mask
    radius = 35
    mask = Image.new("L", (target_w, target_h), 0)
    draw_m = ImageDraw.Draw(mask)
    draw_m.rounded_rectangle((0, 0, target_w, target_h), radius=radius, fill=255)

    # Soft ambient drop shadow
    shadow_offset = 18
    shadow_blur = 30
    shadow = Image.new("RGBA", (target_w + shadow_blur * 2, target_h + shadow_blur * 2), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle(
        (shadow_blur, shadow_blur + shadow_offset, target_w + shadow_blur, target_h + shadow_blur + shadow_offset),
        radius=radius,
        fill=(0, 0, 0, 40)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_blur // 2))

    # Canvas
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))
    x_pos = (canvas_size - target_w) // 2
    y_pos = (canvas_size - target_h) // 2

    # Paste shadow then image
    canvas.paste(shadow, (x_pos - shadow_blur, y_pos - shadow_blur), shadow)
    canvas.paste(resized_crop, (x_pos, y_pos), mask)

    final_webp = canvas.convert("RGB")
    dest_path = os.path.join(out_dir, p["img_name"])
    final_webp.save(dest_path, format="WEBP", quality=90, method=6)

    # Copy to public/images/products for web display
    shutil.copy(dest_path, os.path.join("public/images/products", p["img_name"]))

    print(f"Processed: {p['name_ar']} -> {p['img_name']} ({os.path.getsize(dest_path)} bytes)")

# 2. Build Excel Catalog
print("\n--- توليد ملف الإكسل الاحترافي (products_catalog.xlsx) ---")
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "كتالوج محل غزل للمكياجات"
ws.views.sheetView[0].rightToLeft = True

headers = [
    "م",
    "رمز المنتج (SKU)",
    "اسم المنتج (المختصر الواضح)",
    "اسم المنتج بالإنجليزي",
    "المحل / المورد",
    "الماركة (Brand)",
    "القسم الرئيسي",
    "القسم الفرعي",
    "سعر التكلفة (د.أ)",
    "سعر البيع المقترح (د.أ)",
    "هامش الربح (د.أ)",
    "نسبة الربح %",
    "السعة والحجم",
    "محتويات البكج",
    "الهرم العطري والنوتات",
    "الوصف التسويقي",
    "أبرز الميزات",
    "الكلمات الدلالية (SEO)",
    "اسم ملف الصورة (.webp)",
    "حالة الجاهزية"
]

ws.append(headers)

for idx, p in enumerate(products, 1):
    row_num = idx + 1
    row = [
        idx,
        p["sku"],
        p["name_ar"],
        p["name_en"],
        "محل غزل للمكياجات",
        p["brand"],
        p["category"],
        p["subcategory"],
        p["cost"],
        p["price"],
        f"=J{row_num}-I{row_num}",
        f"=(J{row_num}-I{row_num})/J{row_num}",
        p["volume"],
        p["contents"],
        p["notes"],
        p["description"],
        p["highlights"],
        p["seo"],
        p["img_name"],
        "جاهز للرفع (بانتظار أمر البدء)"
    ]
    ws.append(row)

# Style Header
header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="3B1E40", end_color="3B1E40", fill_type="solid") # Deep luxury plum
border_thin = Border(
    left=Side(style="thin", color="E5E7EB"),
    right=Side(style="thin", color="E5E7EB"),
    top=Side(style="thin", color="E5E7EB"),
    bottom=Side(style="thin", color="E5E7EB")
)

for cell in ws[1]:
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = border_thin

# Style Data Rows
data_font = Font(name="Segoe UI", size=10)
for row_idx in range(2, len(products) + 2):
    ws.row_dimensions[row_idx].height = 45
    for col_idx, cell in enumerate(ws[row_idx], 1):
        cell.font = data_font
        cell.border = border_thin
        if col_idx in [9, 10, 11]: # Currency
            cell.number_format = "#,##0.00"
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif col_idx == 12: # Percentage
            cell.number_format = "0.0%"
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif col_idx in [1, 2, 5, 6, 7, 8, 20]:
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif col_idx == 19: # Image file
            cell.alignment = Alignment(horizontal="center", vertical="center")
        else:
            cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)

ws.row_dimensions[1].height = 32

col_widths = {
    "A": 6,   # م
    "B": 16,  # SKU
    "C": 30,  # Short Name Ar
    "D": 32,  # Name En
    "E": 20,  # Shop
    "F": 18,  # Brand
    "G": 18,  # Category
    "H": 22,  # Subcategory
    "I": 15,  # Cost
    "J": 18,  # Price
    "K": 16,  # Profit
    "L": 14,  # Margin %
    "M": 26,  # Volume
    "N": 35,  # Contents
    "O": 38,  # Notes
    "P": 45,  # Description
    "Q": 40,  # Highlights
    "R": 35,  # SEO
    "S": 38,  # Image Filename
    "T": 25   # Status
}

for col_letter, width in col_widths.items():
    ws.column_dimensions[col_letter].width = width

excel_path = "design/بيانات_المنتجات_excel/products_catalog.xlsx"
wb.save(excel_path)
print(f"SUCCESS: Saved {len(products)} products to {excel_path}")

# 3. Move screenshots to done folder
print("\n--- نقل السكرينات إلى مجلد 07_سكرينات_مكتملة_done ---")
for p in products:
    src_f = os.path.join(inbox_dir, p["file"])
    if os.path.exists(src_f):
        dest_f = os.path.join(done_dir, p["file"])
        shutil.move(src_f, dest_f)
        print(f"Moved: {p['file']} -> {done_dir}")

print("\n--- تم إنجاز العمل بالكامل بنجاح ---")
