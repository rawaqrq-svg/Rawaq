import cv2
import numpy as np
from PIL import Image, ImageFilter

# Load the cropped product card from ScreenHunter 03
img = cv2.imread('design/07_سكرينات_مكتملة_done/ScreenHunter 03.png')
h, w, _ = img.shape

# Let's crop the banner area first
# Top ~ 15 to 350, x ~ 20 to 350
banner = img[15:350, 15:350]
bh, bw, _ = banner.shape

# The bottles occupy the central vertical region:
# Left bottle: x ~ bw*0.2 to bw*0.5
# Right bottle: x ~ bw*0.5 to bw*0.85
# Height: y ~ bh*0.2 to bh*0.95
rect = (int(bw * 0.18), int(bh * 0.18), int(bw * 0.65), int(bh * 0.77))

mask = np.zeros((bh, bw), np.uint8)
bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

cv2.grabCut(banner, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)

# In mask, 0 and 2 are background, 1 and 3 are foreground
mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')

# Convert to RGBA
b_rgb = cv2.cvtColor(banner, cv2.COLOR_BGR2RGB)
alpha = (mask2 * 255).astype(np.uint8)

# Smooth mask edges
alpha_pil = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.5))
alpha_smooth = np.array(alpha_pil)

# Composite on 1200x1200 pure white canvas
canvas = np.ones((1200, 1200, 3), dtype=np.uint8) * 255

# Extract foreground
fg = b_rgb.astype(float)
alpha_norm = (alpha_smooth.astype(float) / 255.0)[:, :, np.newaxis]

# Resize product so it fills 80% height (around 950px)
target_h = 950
scale = target_h / bh
target_w = int(bw * scale)

fg_pil = Image.fromarray(b_rgb)
fg_resized = fg_pil.resize((target_w, target_h), Image.Resampling.LANCZOS)
alpha_resized = alpha_pil.resize((target_w, target_h), Image.Resampling.LANCZOS)

# Create contact shadow
shadow = Image.new('RGBA', (1200, 1200), (255, 255, 255, 0))
# Let's paste on pure white canvas
final_canvas = Image.new('RGB', (1200, 1200), (255, 255, 255))
x_pos = (1200 - target_w) // 2
y_pos = (1200 - target_h) // 2

final_canvas.paste(fg_resized, (x_pos, y_pos), alpha_resized)
final_canvas.save('design/test_grabcut_03.webp', format='WEBP', quality=92)
print('SUCCESS: GrabCut test saved to design/test_grabcut_03.webp')
