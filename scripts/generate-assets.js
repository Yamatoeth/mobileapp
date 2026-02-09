const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const PRIMARY = '#0066ff'
const WHITE = '#ffffff'
const ASSETS_DIR = path.join(__dirname, '..', 'assets')

// Draw a medical cross / plus symbol
function drawMedicalCross(ctx, cx, cy, size, color) {
  const armWidth = size * 0.35
  const armLength = size * 0.85
  
  ctx.fillStyle = color
  ctx.beginPath()
  // Vertical arm
  ctx.roundRect(cx - armWidth/2, cy - armLength/2, armWidth, armLength, size * 0.08)
  ctx.fill()
  // Horizontal arm
  ctx.beginPath()
  ctx.roundRect(cx - armLength/2, cy - armWidth/2, armLength, armWidth, size * 0.08)
  ctx.fill()
}

// Draw a heart icon
function drawHeart(ctx, cx, cy, size, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  
  const width = size * 0.9
  const height = size * 0.85
  const topCurveHeight = height * 0.3
  
  ctx.moveTo(cx, cy + height * 0.35)
  
  // Left curve
  ctx.bezierCurveTo(
    cx - width/2, cy + height * 0.1,
    cx - width/2, cy - topCurveHeight,
    cx, cy - topCurveHeight * 0.6
  )
  
  // Right curve
  ctx.bezierCurveTo(
    cx + width/2, cy - topCurveHeight,
    cx + width/2, cy + height * 0.1,
    cx, cy + height * 0.35
  )
  
  ctx.fill()
}

// Generate app icon (1024x1024)
function generateIcon() {
  const size = 1024
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  // Background with rounded corners
  const cornerRadius = size * 0.22
  ctx.fillStyle = PRIMARY
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, cornerRadius)
  ctx.fill()
  
  // Draw medical cross
  drawMedicalCross(ctx, size/2, size/2, size * 0.5, WHITE)
  
  // Small heart accent in the center
  const heartSize = size * 0.15
  ctx.globalAlpha = 0.95
  drawHeart(ctx, size/2, size/2, heartSize, '#ff4466')
  ctx.globalAlpha = 1
  
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), buffer)
  console.log('✓ Generated icon.png (1024x1024)')
}

// Generate adaptive icon foreground (1024x1024 with safe zone)
function generateAdaptiveIcon() {
  const size = 1024
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  // Transparent background (the bg color is set in app.json)
  ctx.clearRect(0, 0, size, size)
  
  // Safe zone is 66% of the icon (center 66%)
  const safeSize = size * 0.5
  
  // Draw medical cross
  drawMedicalCross(ctx, size/2, size/2, safeSize, PRIMARY)
  
  // Small heart accent
  const heartSize = safeSize * 0.3
  drawHeart(ctx, size/2, size/2, heartSize, '#ff4466')
  
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(ASSETS_DIR, 'adaptive-icon.png'), buffer)
  console.log('✓ Generated adaptive-icon.png (1024x1024)')
}

// Generate splash icon (200x200 centered element)
function generateSplashIcon() {
  const size = 200
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  ctx.clearRect(0, 0, size, size)
  
  // Draw medical cross
  drawMedicalCross(ctx, size/2, size/2, size * 0.7, PRIMARY)
  
  // Heart accent
  const heartSize = size * 0.2
  drawHeart(ctx, size/2, size/2, heartSize, '#ff4466')
  
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(ASSETS_DIR, 'splash-icon.png'), buffer)
  console.log('✓ Generated splash-icon.png (200x200)')
}

// Generate favicon (48x48)
function generateFavicon() {
  const size = 48
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  
  // Background
  ctx.fillStyle = PRIMARY
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()
  
  // Cross
  drawMedicalCross(ctx, size/2, size/2, size * 0.5, WHITE)
  
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(ASSETS_DIR, 'favicon.png'), buffer)
  console.log('✓ Generated favicon.png (48x48)')
}

// Generate full splash screen image (1284x2778 for iPhone 14 Pro Max)
function generateSplashImage() {
  const width = 1284
  const height = 2778
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  
  // White background
  ctx.fillStyle = WHITE
  ctx.fillRect(0, 0, width, height)
  
  // Center icon
  const iconSize = 180
  const cx = width / 2
  const cy = height / 2 - 50
  
  // Draw medical cross
  drawMedicalCross(ctx, cx, cy, iconSize, PRIMARY)
  
  // Heart accent
  const heartSize = iconSize * 0.28
  drawHeart(ctx, cx, cy, heartSize, '#ff4466')
  
  // App name below icon
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('Medicus', cx, cy + iconSize/2 + 40)
  
  // Tagline
  ctx.fillStyle = '#666666'
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Your Health Assistant', cx, cy + iconSize/2 + 110)
  
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(ASSETS_DIR, 'splash.png'), buffer)
  console.log('✓ Generated splash.png (1284x2778)')
}

// Run all generators
console.log('\nGenerating Medicus app assets...\n')
generateIcon()
generateAdaptiveIcon()
generateSplashIcon()
generateFavicon()
generateSplashImage()
console.log('\n✓ All assets generated!\n')
