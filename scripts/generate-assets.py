#!/usr/bin/env python3
"""
Generate placeholder assets for AI Filing Cabinet
Creates simple colored placeholder images for development
"""

import os

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("PIL (Pillow) is not installed.")
    print("Install it with: pip install Pillow")
    print("")
    print("Or install via npm: npm install -g canvas")
    exit(1)

# Create assets directory if it doesn't exist
os.makedirs("assets", exist_ok=True)

# Colors
BLUE = "#2563eb"
WHITE = "#ffffff"
DARK_GRAY = "#1f2937"

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_icon(size, filename):
    """Create a simple icon with a folder emoji approximation"""
    img = Image.new('RGB', (size, size), hex_to_rgb(BLUE))
    draw = ImageDraw.Draw(img)

    # Draw a simple folder shape
    folder_color = hex_to_rgb(WHITE)
    margin = size // 4

    # Main folder rectangle
    draw.rectangle(
        [margin, margin + size//8, size - margin, size - margin],
        fill=folder_color
    )

    # Folder tab
    draw.rectangle(
        [margin, margin, margin + size//3, margin + size//8],
        fill=folder_color
    )

    img.save(filename)
    print(f"✓ Created {filename}")

def create_splash():
    """Create a splash screen"""
    img = Image.new('RGB', (2048, 2048), hex_to_rgb(WHITE))
    draw = ImageDraw.Draw(img)

    # Draw folder icon in center
    folder_color = hex_to_rgb(BLUE)
    margin = 2048 // 3

    draw.rectangle(
        [margin, margin + 100, 2048 - margin, 2048 - margin],
        fill=folder_color
    )

    draw.rectangle(
        [margin, margin, margin + 200, margin + 100],
        fill=folder_color
    )

    try:
        # Try to add text
        font = ImageFont.truetype("Arial", 80)
    except:
        font = ImageFont.load_default()

    text = "AI Filing Cabinet"
    # Center text
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (2048 - text_width) // 2
    y = 1500

    draw.text((x, y), text, fill=hex_to_rgb(DARK_GRAY), font=font)

    img.save("assets/splash.png")
    print("✓ Created assets/splash.png")

def main():
    print("Generating placeholder assets...")
    print("")

    # Generate icon (1024x1024)
    create_icon(1024, "assets/icon.png")

    # Generate adaptive icon (1024x1024)
    create_icon(1024, "assets/adaptive-icon.png")

    # Generate splash (2048x2048)
    create_splash()

    # Generate favicon (48x48)
    create_icon(48, "assets/favicon.png")

    print("")
    print("✅ All placeholder assets generated successfully!")
    print("")
    print("These are basic placeholders. For production, replace them with:")
    print("  - Professional app icon design")
    print("  - Branded splash screen")
    print("  - Optimized favicon")

if __name__ == "__main__":
    main()
