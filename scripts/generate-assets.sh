#!/bin/bash

# Generate placeholder assets for AI Filing Cabinet
# This creates simple colored placeholder images for development

echo "Generating placeholder assets..."

# Create assets directory if it doesn't exist
mkdir -p assets

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is not installed."
    echo "Please install it:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    echo ""
    echo "Or create the following files manually:"
    echo "  assets/icon.png (1024x1024)"
    echo "  assets/adaptive-icon.png (1024x1024)"
    echo "  assets/splash.png (2048x2048)"
    echo "  assets/favicon.png (48x48)"
    exit 1
fi

# Generate icon.png (1024x1024)
convert -size 1024x1024 xc:#2563eb \
    -gravity center \
    -pointsize 200 \
    -fill white \
    -annotate +0+0 '📁' \
    assets/icon.png

echo "✓ Created assets/icon.png"

# Generate adaptive-icon.png (1024x1024)
convert -size 1024x1024 xc:#2563eb \
    -gravity center \
    -pointsize 200 \
    -fill white \
    -annotate +0+0 '📁' \
    assets/adaptive-icon.png

echo "✓ Created assets/adaptive-icon.png"

# Generate splash.png (2048x2048)
convert -size 2048x2048 xc:white \
    -gravity center \
    -pointsize 400 \
    -fill #2563eb \
    -annotate +0-200 '📁' \
    -pointsize 120 \
    -fill #1f2937 \
    -annotate +0+200 'AI Filing Cabinet' \
    assets/splash.png

echo "✓ Created assets/splash.png"

# Generate favicon.png (48x48)
convert -size 48x48 xc:#2563eb \
    -gravity center \
    -pointsize 32 \
    -fill white \
    -annotate +0+0 '📁' \
    assets/favicon.png

echo "✓ Created assets/favicon.png"

echo ""
echo "✅ All placeholder assets generated successfully!"
echo ""
echo "These are basic placeholders. For production, replace them with:"
echo "  - Professional app icon design"
echo "  - Branded splash screen"
echo "  - Optimized favicon"
