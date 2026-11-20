import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "كتالوج المنتجات"
ws.views.sheetView[0].rightToLeft = True

headers = [
    "رمز المنتج (SKU)",
    "اسم ملف الصورة",
    "القسم الرئيسي",
    "القسم الفرعي",
    "الماركة (Brand)",
    "اسم المنتج بالعربي",
    "اسم المنتج بالإنجليزي",
    "سعر التكلفة (د.أ)",
    "سعر البيع المقترح (د.أ)",
    "هامش الربح (د.أ)",
    "نسبة الربح %",
    "السعة والحجم",
    "محتويات البكج",
    "الهرم العطري والنوتات",
    "الوصف التسويقي",
    "الميزات الرئيسية",
    "طريقة الاستخدام",
    "الكلمات الدلالية (SEO)",
    "ملاحظات المورد",
    "حالة الجاهزية"
]

row_data = [
    "PERF-SET-001",
    "PERF-BODY-001-alhanan-qissat-one-and-only.webp",
    "العطور والبخور",
    "معطرات جسم وبودي سبلاش",
    "Alhanan Senses",
    "مجموعة العناية والتعطير الفاخرة للجسم 'قصة' (One & Only) - قطعتين 300 مل",
    "ALHANAN Senses 'Qissat' (One & Only) Luxury Body Mist & Lotion Set",
    3.00,
    5.00,
    "=I2-H2",
    "=(I2-H2)/I2",
    "300 مل للعبوة (إجمالي 600 مل)",
    "بخاخ سبلاش معطر 300 مل + لوشن مرطب ومغذي بمضخة 300 مل",
    "مستوحى من عطر قصة One & Only الشهير: باشن فروت، خوخ، كراميل، ياسمين، مسك أبيض وعنبر",
    "ثنائية ساحرة تجمع بين التعطير الفاخر والترطيب العميق. يمنحك سبلاش الجسم عبقاً أنثوياً فواحاً يدوم طوال اليوم، بينما يعزز اللوشن نعومة بشرتك بملمس حريري مخملي بدون أي لزوجة.",
    "• ثبات عطري عالي يدوم طوال اليوم\n• لوشن سريع الامتصاص غني بالمرطبات المغذية\n• عبوات بحجم كبير واقتصادي (300 مل لكل عبوة)\n• غطاء بخاخ متين ومضخة لوشن عملية وسهلة الاستخدام",
    "يوزع اللوشن على بشرة نظيفة بعد الاستحمام بحركات دائرية، ثم يُرش السبلاش المعطر على الجسم ومناطق النبض لثبات وانتعاش مضاعف.",
    "سبلاش قصة, ون اند اونلي, لوشن معطر, بودي مست قصة, مجموعة عناية بالجسم, الحنان سينسز, عطور نسائية الاردن",
    "سعر الجملة 3 د.أ، سعر البيع الموصى به 5 د.أ (يفضل عدم كسر السعر للحفاظ على تسعيرة السوق الموحدة).",
    "جاهز للنشر"
]

ws.append(headers)
ws.append(row_data)

header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="3B1E40", end_color="3B1E40", fill_type="solid") # Elegant deep plum
border_thin = Border(
    left=Side(style="thin", color="D1D5DB"),
    right=Side(style="thin", color="D1D5DB"),
    top=Side(style="thin", color="D1D5DB"),
    bottom=Side(style="thin", color="D1D5DB")
)

for col_num, cell in enumerate(ws[1], 1):
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = border_thin

data_font = Font(name="Segoe UI", size=10)
for col_num, cell in enumerate(ws[2], 1):
    cell.font = data_font
    cell.border = border_thin
    if col_num in [8, 9, 10]:
        cell.number_format = "#,##0.00"
        cell.alignment = Alignment(horizontal="center", vertical="center")
    elif col_num == 11:
        cell.number_format = "0.0%"
        cell.alignment = Alignment(horizontal="center", vertical="center")
    elif col_num in [1, 2, 5, 20]:
        cell.alignment = Alignment(horizontal="center", vertical="center")
    else:
        cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)

ws.row_dimensions[1].height = 32
ws.row_dimensions[2].height = 70

column_widths = {
    "A": 16, # SKU
    "B": 38, # Image filename
    "C": 18, # Main Category
    "D": 22, # Sub Category
    "E": 18, # Brand
    "F": 35, # Name Ar
    "G": 35, # Name En
    "H": 15, # Cost
    "I": 18, # Retail Price
    "J": 16, # Profit
    "K": 14, # Margin %
    "L": 22, # Volume
    "M": 35, # Package contents
    "N": 35, # Fragrance Notes
    "O": 45, # Description
    "P": 40, # Highlights
    "Q": 35, # How to use
    "R": 35, # SEO tags
    "S": 35, # Supplier Notes
    "T": 15, # Status
}

for col_letter, width in column_widths.items():
    ws.column_dimensions[col_letter].width = width

os.makedirs("design/بيانات_المنتجات_excel", exist_ok=True)
excel_path = "design/بيانات_المنتجات_excel/products_catalog.xlsx"
wb.save(excel_path)
print("SUCCESS: Excel file created at", excel_path)
