import os
import math
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
os.makedirs(ICONS_DIR, exist_ok=True)

def create_app_icon(size, is_maskable=False):
    # Create RGBA canvas
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background gradient or rounded rectangle
    margin = 0 if is_maskable else int(size * 0.06)
    radius = int(size * 0.22) if not is_maskable else 0

    # Draw dark tech indigo-slate gradient
    steps = size
    for y in range(size):
        ratio = y / size
        # Gradient from #4f46e5 (Indigo) to #0f172a (Dark Slate)
        r = int(79 * (1 - ratio) + 15 * ratio)
        g = int(70 * (1 - ratio) + 23 * ratio)
        b = int(229 * (1 - ratio) + 42 * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask with rounded corners if not maskable
    if not is_maskable:
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([(margin, margin), (size - margin, size - margin)], radius=radius, fill=255)
        
        # Apply mask to background
        output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        output.paste(img, (0, 0), mask)
        img = output
        draw = ImageDraw.Draw(img)

    # Draw vibrant center emblem: Pulse Flame & Upward Trend line
    cx, cy = size / 2, size / 2
    scale = size / 512.0

    # Glow effect
    glow_color = (99, 102, 241, 70)
    for i in range(5, 0, -1):
        glow_radius = int(140 * scale + i * 8 * scale)
        draw.ellipse(
            [cx - glow_radius, cy - glow_radius, cx + glow_radius, cy + glow_radius],
            fill=glow_color
        )

    # Draw Flame silhouette
    flame_points = [
        (cx, cy - 130 * scale),
        (cx + 45 * scale, cy - 60 * scale),
        (cx + 85 * scale, cy + 10 * scale),
        (cx + 80 * scale, cy + 75 * scale),
        (cx + 45 * scale, cy + 120 * scale),
        (cx - 45 * scale, cy + 120 * scale),
        (cx - 80 * scale, cy + 75 * scale),
        (cx - 85 * scale, cy + 10 * scale),
        (cx - 45 * scale, cy - 60 * scale),
    ]
    draw.polygon(flame_points, fill=(245, 158, 11, 255)) # Amber flame

    # Inner Emerald Trend Arrow
    arrow_points = [
        (cx - 60 * scale, cy + 50 * scale),
        (cx - 15 * scale, cy + 10 * scale),
        (cx + 25 * scale, cy + 30 * scale),
        (cx + 65 * scale, cy - 40 * scale),
        (cx + 70 * scale, cy - 5 * scale),
        (cx + 70 * scale, cy - 50 * scale),
        (cx + 25 * scale, cy - 50 * scale),
        (cx + 50 * scale, cy - 25 * scale),
        (cx + 15 * scale, cy + 10 * scale),
        (cx - 20 * scale, cy - 10 * scale),
        (cx - 60 * scale, cy + 30 * scale),
    ]
    draw.polygon(arrow_points, fill=(16, 185, 129, 255)) # Emerald Green

    # Sharp white trend peak circle
    peak_x = cx + 60 * scale
    peak_y = cy - 40 * scale
    r_dot = 12 * scale
    draw.ellipse([peak_x - r_dot, peak_y - r_dot, peak_x + r_dot, peak_y + r_dot], fill=(255, 255, 255, 255))

    return img

print("Generating PWA Icons...")
icon_192 = create_app_icon(192)
icon_192.save(os.path.join(ICONS_DIR, 'icon-192x192.png'), 'PNG')

icon_512 = create_app_icon(512)
icon_512.save(os.path.join(ICONS_DIR, 'icon-512x512.png'), 'PNG')

maskable_512 = create_app_icon(512, is_maskable=True)
maskable_512.save(os.path.join(ICONS_DIR, 'maskable-icon-512x512.png'), 'PNG')

apple_icon = create_app_icon(180)
apple_icon.save(os.path.join(ICONS_DIR, 'apple-touch-icon.png'), 'PNG')

favicon = create_app_icon(64)
favicon.save(os.path.join(PUBLIC_DIR, 'favicon.png'), 'PNG')

print("All icons generated successfully!")
