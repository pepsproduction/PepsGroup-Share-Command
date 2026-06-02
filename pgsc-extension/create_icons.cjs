#!/usr/bin/env node
// create_icons.cjs — Generate PNG icons for PGSC Share Helper Extension
// Run with: node create_icons.cjs
// Requires only Node.js built-ins (no npm install needed)

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// Minimal CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint32BE(buf, val, offset) {
  buf[offset]     = (val >>> 24) & 0xFF;
  buf[offset + 1] = (val >>> 16) & 0xFF;
  buf[offset + 2] = (val >>>  8) & 0xFF;
  buf[offset + 3] =  val         & 0xFF;
}

function makePngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const dataBuf   = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const lenBuf    = Buffer.alloc(4);
  writeUint32BE(lenBuf, dataBuf.length, 0);
  const crcInput  = Buffer.concat([typeBytes, dataBuf]);
  const crcBuf    = Buffer.alloc(4);
  writeUint32BE(crcBuf, crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, dataBuf, crcBuf]);
}

/**
 * Create a simple 3-color PNG icon:
 * Orange rounded square background with white "P" letter
 */
function createPng(size) {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR (RGB, 8-bit)
  const ihdr = Buffer.alloc(13);
  writeUint32BE(ihdr,  size, 0);
  writeUint32BE(ihdr,  size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // compression=0, filter=0, interlace=0

  // Build raw image rows
  // Colors
  const BG_R = 30,  BG_G = 30,  BG_B = 46;    // #1e1e2e dark background
  const OR_R = 255, OR_G = 107, OR_B = 43;      // #FF6B2B orange
  const WH_R = 255, WH_G = 255, WH_B = 255;    // white

  const rowLen = size * 3;
  const rawRows = Buffer.alloc((rowLen + 1) * size, 0);

  const radius   = size * 0.25;   // corner radius for rounded square
  const cx       = size / 2;
  const letterW  = size * 0.18;   // P letter stroke width
  const letterH  = size * 0.55;   // P letter height
  const letterX  = size * 0.28;   // P letter left x
  const letterY  = size * 0.22;   // P letter top y
  const pRadius  = size * 0.14;   // P bowl radius

  for (let y = 0; y < size; y++) {
    rawRows[y * (rowLen + 1)] = 0; // No filter
    for (let x = 0; x < size; x++) {
      const px = y * (rowLen + 1) + 1 + x * 3;
      const nx = x - cx;
      const ny = y - cx;
      const r  = Math.sqrt(nx * nx + ny * ny);

      let R, G, B;

      // Is this pixel inside the rounded square orange bg?
      const inRoundedSquare = isInRoundedRect(x, y, size * 0.06, size * 0.06, size * 0.88, size * 0.88, radius);

      if (inRoundedSquare) {
        // Check if it's part of the "P" letter
        const inLetter = isInP(x, y, letterX, letterY, letterW, letterH, pRadius);
        if (inLetter) {
          R = WH_R; G = WH_G; B = WH_B;
        } else {
          R = OR_R; G = OR_G; B = OR_B;
        }
      } else {
        R = BG_R; G = BG_G; B = BG_B;
      }

      rawRows[px]     = R;
      rawRows[px + 1] = G;
      rawRows[px + 2] = B;
    }
  }

  const compressed = zlib.deflateSync(rawRows);

  return Buffer.concat([
    PNG_SIG,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function isInRoundedRect(px, py, rx, ry, rw, rh, radius) {
  if (px < rx || px > rx + rw || py < ry || py > ry + rh) return false;
  // Corners
  const corners = [
    { cx: rx + radius,      cy: ry + radius },
    { cx: rx + rw - radius, cy: ry + radius },
    { cx: rx + radius,      cy: ry + rh - radius },
    { cx: rx + rw - radius, cy: ry + rh - radius },
  ];
  for (const c of corners) {
    if (px < rx + radius && py < ry + radius && dist(px, py, c.cx, c.cy) > radius) return false;
    if (px > rx + rw - radius && py < ry + radius && dist(px, py, c.cx, c.cy) > radius && c.cx === rx + rw - radius && c.cy === ry + radius) return false;
    if (px < rx + radius && py > ry + rh - radius && dist(px, py, c.cx, c.cy) > radius && c.cx === rx + radius && c.cy === ry + rh - radius) return false;
    if (px > rx + rw - radius && py > ry + rh - radius && dist(px, py, c.cx, c.cy) > radius && c.cx === rx + rw - radius && c.cy === ry + rh - radius) return false;
  }
  return true;
}

function isInP(px, py, lx, ly, lw, lh, pRadius) {
  const antiAlias = 0.5;
  // Vertical stroke of P
  const inStroke = px >= lx - antiAlias && px <= lx + lw + antiAlias && py >= ly && py <= ly + lh;
  // Bowl of P (right side, upper half)
  const bowlCX = lx + lw + pRadius;
  const bowlCY = ly + pRadius;
  const bowlDist = dist(px, py, bowlCX, bowlCY);
  const inBowl = bowlDist <= pRadius + lw && bowlDist >= pRadius - antiAlias && py <= bowlCY + pRadius;
  return inStroke || inBowl;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Create icons directory
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[16, 48, 128].forEach(size => {
  const pngData = createPng(size);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, pngData);
  console.log(`✅ Created ${outPath} (${pngData.length} bytes)`);
});

console.log('\nDone! Icons created in ./icons/');
