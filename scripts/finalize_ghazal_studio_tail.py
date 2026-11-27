"""Convert the final verified studio renders to store-ready WebP files."""

from pathlib import Path
from PIL import Image

GENERATED = Path(r"C:\Users\و\.codex\generated_images\01a20e30-6f13-77f0-a4e9-b58054625bdf")
READY = Path(r"C:\Users\و\Desktop\RAWAQ Progject\design\جاهز_للمتجر_studio_webp")

FILES = {
    "exec-51fcde57-12a8-4844-ae69-de3ee08d9776.png": "enchanteur-satin-lotion-romantic-studio.webp",
    "exec-a87e7a98-fa3b-42b6-b913-692faac8f22b.png": "enchanteur-satin-lotion-enticing-studio.webp",
    "exec-e1e27d97-60b3-4e49-b818-cf1057963e97.png": "enchanteur-satin-lotion-gorgeous-studio.webp",
    "exec-62c0f31b-cb62-4d47-a0f8-0c5c15ff1474.png": "agrado-body-milk-rosa-mosqueta-400ml-studio.webp",
    "exec-d3af1276-1cdd-4ef7-a8e0-d5b4bd9de853.png": "agrado-body-milk-aloe-vera-400ml-studio.webp",
    "exec-ce075e27-b44c-4d52-bf0e-117d3ab1d29b.png": "agrado-body-milk-coconut-400ml-studio.webp",
    "exec-2f7724b6-6198-40a5-8453-22b079162d4c.png": "agrado-body-milk-argan-400ml-studio.webp",
    "exec-a66e85da-6450-4e28-a909-40c601f1f8cb.png": "agrado-body-milk-sweet-almond-400ml-studio.webp",
    "exec-3c2ffea3-ba8f-4d37-8249-bb36499cff82.png": "vaseline-intensive-care-cocoa-glow-400ml-studio.webp",
    "exec-c9463707-038f-414e-aa74-9e1f3fa07b59.png": "vaseline-intensive-care-advanced-repair-400ml-studio.webp",
    "exec-46436fdb-773c-4db6-bdd9-00219954f548.png": "vaseline-intensive-care-aloe-soothe-400ml-studio.webp",
    "exec-413937ab-2bcd-467d-9518-af2629f44644.png": "vaseline-intensive-care-dry-skin-repair-400ml-studio.webp",
    "exec-35051f3c-4e97-49ce-aa34-c97f477bf95f.png": "mbc-ultra-almond-oil-lotion-500ml-studio.webp",
    "exec-3d8a0eb9-12f9-412f-9b68-8c2dd26e1c42.png": "mbc-ultra-argan-oil-lotion-500ml-studio.webp",
    "exec-50c17c05-d4b7-460f-8424-43a98145a58f.png": "mbc-ultra-jojoba-oil-lotion-500ml-studio.webp",
    "exec-8fa49ae9-4777-40a4-b5d2-5d98cf3bbfc2.png": "mbc-ultra-coconut-oil-lotion-500ml-studio.webp",
    "exec-afefe6d7-748b-4d53-a0be-78a22783b025.png": "boutique-charcoal-scrub-600ml-studio.webp",
    "exec-5fd4ebea-589b-406b-aec8-dd988c26e8b4.png": "boutique-avocado-scrub-600ml-studio.webp",
    "exec-17bccd7a-690e-488a-94ff-fb37f0d3dcfd.png": "boutique-peach-scrub-600ml-studio.webp",
    "exec-6e03ea99-bbec-4e62-9968-1c514c97a514.png": "boutique-aloe-vera-scrub-600ml-studio.webp",
    "exec-11ac2780-3abe-46eb-9439-76911a83d592.png": "boutique-strawberry-scrub-600ml-studio.webp",
    "exec-fa25c20e-89ee-4cb0-8819-2c3f2cb2ef36.png": "glysolid-classic-body-lotion-studio.webp",
    "exec-3c06afde-236d-437f-b23b-861cb4c16275.png": "glysolid-musk-body-lotion-studio.webp",
    "exec-6b7d3bb6-f0ae-41ff-8b22-76504cd52776.png": "sence-hydro-shock-body-lotion-studio.webp",
    "exec-e9afb42d-914e-4dd4-8d66-a670db8aa1cb.png": "boutique-baby-powder-pink-lotion-480ml-studio.webp",
}

for source_name, output_name in FILES.items():
    with Image.open(GENERATED / source_name) as image:
        image.convert("RGB").resize((1254, 1254), Image.Resampling.LANCZOS).save(
            READY / output_name, "WEBP", quality=92, method=6
        )

print(f"Converted {len(FILES)} verified studio images")
