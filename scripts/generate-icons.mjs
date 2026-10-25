/**
 * Gera os ícones do app (PNG + ICO) sem depender de ferramentas externas.
 *
 *   node scripts/generate-icons.mjs
 *
 * Saída em src-tauri/icons/:
 *   32x32.png, 128x128.png, 128x128@2x.png (256px), icon.png (512px), icon.ico
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* PNG mínimo (truecolor + alpha)                                      */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Desenho do logo                                                      */
/* ------------------------------------------------------------------ */

function insideRoundedRect(x, y, size, radius) {
  const minX = radius;
  const minY = radius;
  const maxX = size - radius;
  const maxY = size - radius;
  const cx = Math.min(Math.max(x, minX), maxX);
  const cy = Math.min(Math.max(y, minY), maxY);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function insideEllipse(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

function renderIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      if (!insideRoundedRect(x + 0.5, y + 0.5, size, r)) continue; // alpha 0

      // fundo em gradiente violeta -> índigo
      const t = (x + y) / (2 * size);
      const red = Math.round(124 + (76 - 124) * t);
      const green = Math.round(58 + (29 - 58) * t);
      const blue = Math.round(237 + (196 - 237) * t);

      // brilho sutil no canto superior esquerdo
      const glow = Math.max(0, 1 - Math.hypot(x / size - 0.2, y / size - 0.15) * 1.6);
      px[i] = Math.min(255, red + Math.round(glow * 40));
      px[i + 1] = Math.min(255, green + Math.round(glow * 40));
      px[i + 2] = Math.min(255, blue + Math.round(glow * 30));
      px[i + 3] = 255;

      // nota musical em branco
      const inHead = insideEllipse(x, y, size * 0.36, size * 0.7, size * 0.15, size * 0.115);
      const inStem = x >= size * 0.475 && x <= size * 0.535 && y >= size * 0.24 && y <= size * 0.71;
      const inFlag =
        x >= size * 0.475 &&
        x <= size * 0.76 &&
        y >= size * 0.24 + ((x - size * 0.475) / (size * 0.285)) * size * 0.06 &&
        y <= size * 0.34 + ((x - size * 0.475) / (size * 0.285)) * size * 0.06;

      if (inHead || inStem || inFlag) {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = 255;
      }
    }
  }

  return px;
}

function pngFor(size) {
  return encodePng(size, size, renderIcon(size));
}

/* ------------------------------------------------------------------ */
/* ICO (contêineres PNG, suportado desde o Vista)                       */
/* ------------------------------------------------------------------ */

function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, data: pngFor(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];

  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size >= 256 ? 0 : image.size;
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

/* ------------------------------------------------------------------ */

const outputs = [
  ["32x32.png", pngFor(32)],
  ["128x128.png", pngFor(128)],
  ["128x128@2x.png", pngFor(256)],
  ["icon.png", pngFor(512)],
  ["icon.ico", buildIco([16, 32, 48, 64, 128, 256])],
];

for (const [name, data] of outputs) {
  writeFileSync(join(outDir, name), data);
  console.log(`✓ ${name} (${data.length} bytes)`);
}
