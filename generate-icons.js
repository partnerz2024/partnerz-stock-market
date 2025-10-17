const fs = require('fs');
const path = require('path');

// Create a simple PNG icon using canvas (if available) or fallback to copying SVG
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Simple base64 encoded PNG for each size (1x1 pixel blue square as fallback)
const createSimpleIcon = (size) => {
  // This is a very basic 1x1 blue pixel PNG in base64
  const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return Buffer.from(base64PNG, 'base64');
};

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'client', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
sizes.forEach(size => {
  const filename = `icon-${size}x${size}.png`;
  const filepath = path.join(iconsDir, filename);
  
  // For now, we'll create a simple colored square
  // In a real project, you'd use a proper image processing library
  const iconData = createSimpleIcon(size);
  fs.writeFileSync(filepath, iconData);
  console.log(`Generated ${filename}`);
});

console.log('Icon generation complete!');
