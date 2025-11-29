# Assets Directory

This directory should contain the following image assets for the app:

## Required Assets

### App Icon
- **icon.png** - 1024x1024 px
  - Square app icon with rounded corners
  - Suggested: Filing cabinet or folder icon with AI/tech elements
  - Use vibrant blue (#2563eb) as primary color

### Adaptive Icon (Android)
- **adaptive-icon.png** - 1024x1024 px
  - Foreground layer for Android adaptive icons
  - Should be the main icon centered with transparent background

### Splash Screen
- **splash.png** - 2048x2048 px
  - Displayed while app is loading
  - White background with centered logo/icon
  - Keep it simple and clean

### Favicon (Web)
- **favicon.png** - 48x48 px
  - Small icon for browser tabs
  - Simplified version of the app icon

## Creating Assets

### Option 1: Using Figma/Design Tools
1. Create designs based on the specs above
2. Export as PNG files
3. Place in this directory

### Option 2: Using Online Tools
- [Icon Kitchen](https://icon.kitchen/) - Free app icon generator
- [App Icon Generator](https://appicon.co/) - Generate all sizes
- [Figma](https://figma.com) - Free design tool

### Option 3: Using AI Generation
- Use DALL-E, Midjourney, or Stable Diffusion
- Prompt example: "Modern minimalist app icon for a digital filing cabinet, blue gradient, simple geometric shapes, tech-inspired, flat design"

## Temporary Solution

For development, you can use placeholder colors:
1. Create solid color PNG files with the dimensions above
2. Use a blue (#2563eb) background
3. Add white text or simple shapes

## Tools for Creating PNGs

**Mac:**
```bash
# Create a 1024x1024 blue PNG
sips -z 1024 1024 --setProperty format png /path/to/blue-square.png
```

**Online:**
- [Placeholder.com](https://placeholder.com)
- [DummyImage.com](https://dummyimage.com)

**After creating the files:**
```
assets/
├── icon.png
├── adaptive-icon.png
├── splash.png
└── favicon.png
```

The app will not build without these assets, so create them before running the app for the first time.
