import { Buffer } from 'node:buffer';
// @deno-types="npm:@types/pngjs@6.0.5"
import { PNG } from 'pngjs';
const MAX_BYTES = 8 * 1024 * 1024;
// A fixed bitmap font keeps edge rendering deterministic and requires no fonts,
// DOM, native libraries, or network fetches. Names normalize to readable ASCII.
const glyphs: Record<string, string> = {
 A:'01110/10001/10001/11111/10001/10001/10001', B:'11110/10001/10001/11110/10001/10001/11110', C:'01111/10000/10000/10000/10000/10000/01111', D:'11110/10001/10001/10001/10001/10001/11110', E:'11111/10000/10000/11110/10000/10000/11111', F:'11111/10000/10000/11110/10000/10000/10000', G:'01111/10000/10000/10111/10001/10001/01111', H:'10001/10001/10001/11111/10001/10001/10001', I:'11111/00100/00100/00100/00100/00100/11111', J:'00111/00010/00010/00010/10010/10010/01100', K:'10001/10010/10100/11000/10100/10010/10001', L:'10000/10000/10000/10000/10000/10000/11111', M:'10001/11011/10101/10101/10001/10001/10001', N:'10001/11001/10101/10011/10001/10001/10001', O:'01110/10001/10001/10001/10001/10001/01110', P:'11110/10001/10001/11110/10000/10000/10000', Q:'01110/10001/10001/10001/10101/10010/01101', R:'11110/10001/10001/11110/10100/10010/10001', S:'01111/10000/10000/01110/00001/00001/11110', T:'11111/00100/00100/00100/00100/00100/00100', U:'10001/10001/10001/10001/10001/10001/01110', V:'10001/10001/10001/10001/10001/01010/00100', W:'10001/10001/10001/10101/10101/10101/01010', X:'10001/10001/01010/00100/01010/10001/10001', Y:'10001/10001/01010/00100/00100/00100/00100', Z:'11111/00001/00010/00100/01000/10000/11111',
 '0':'01110/10001/10011/10101/11001/10001/01110', '1':'00100/01100/00100/00100/00100/00100/01110', '2':'01110/10001/00001/00010/00100/01000/11111', '3':'11110/00001/00001/01110/00001/00001/11110', '4':'00010/00110/01010/10010/11111/00010/00010', '5':'11111/10000/10000/11110/00001/00001/11110', '6':'01110/10000/10000/11110/10001/10001/01110', '7':'11111/00001/00010/00100/01000/01000/01000', '8':'01110/10001/10001/01110/10001/10001/01110', '9':'01110/10001/10001/01111/00001/00001/01110',
 '-':'00000/00000/00000/11111/00000/00000/00000', '|':'00100/00100/00100/00100/00100/00100/00100', ':':'00000/00100/00100/00000/00100/00100/00000', '.':'00000/00000/00000/00000/00000/00110/00110', '?':'01110/10001/00001/00010/00100/00000/00100', ' ':'00000/00000/00000/00000/00000/00000/00000',
};
const font = Object.fromEntries(Object.entries(glyphs).map(([key, value]) => [key, value.split('/')]));
function normalized(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 |:?.-]/g, '?').slice(0, 180);
}
function validateHeader(bytes: Uint8Array) {
  if (bytes.length < 33 || bytes.length > MAX_BYTES) throw new Error('Invalid protected PNG size.');
  const signature = [137,80,78,71,13,10,26,10];
  if (!signature.every((v,i) => bytes[i] === v)) throw new Error('Invalid protected PNG signature.');
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12,16)) !== 'IHDR') throw new Error('Invalid protected PNG header.');
  const width = header.getUint32(16), height = header.getUint32(20);
  if (!width || !height || width > 1600 || height > 2400) throw new Error('Invalid protected PNG dimensions.');
  // Only non-interlaced eight-bit raster pages produced by the publisher.
  if (bytes[24] !== 8 || ![0,2,4,6].includes(bytes[25]) || bytes[26] || bytes[27] || bytes[28]) throw new Error('Unsupported protected PNG format.');
}
export function stampProtectedPng(bytes: Uint8Array, identity: string, trace: string): Uint8Array {
  validateHeader(bytes);
  if (!identity || !trace) throw new Error('Missing protected reader identity.');
  const image = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
  const scale = image.width >= 900 ? 2 : 1;
  const columns = Math.max(1, Math.floor((image.width - 24) / (70 * 6 * scale)));
  const tileWidth = Math.floor(image.width / columns);
  const lineChars = Math.max(1, Math.floor((tileWidth - 24) / (6 * scale)));
  const wrap = (text: string) => {
    const result: string[] = [];
    for (let pos = 0; pos < text.length; pos += lineChars) result.push(text.slice(pos, pos + lineChars));
    return result;
  };
  const separator = identity.lastIndexOf('|');
  const readerIdentity = separator >= 0
    ? `${normalized(identity.slice(0, separator)).slice(0, 80)} | ${normalized(identity.slice(separator + 1)).slice(0, 40)}`
    : normalized(identity);
  const lines = [...wrap(readerIdentity), ...wrap(normalized(trace))];
  const rowHeight = Math.max(150, lines.length * 10 * scale + 50);
  for (let y = 24; y < image.height; y += rowHeight) {
    for (let column = 0; column < columns; column++) {
      const startX = column * tileWidth + 12;
      lines.forEach((line, lineIndex) => {
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const glyph = font[line[charIndex]] ?? font['?'];
          for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
            if (glyph[gy][gx] !== '1') continue;
            for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
              const px = startX + charIndex * 6 * scale + gx * scale + sx;
              const py = y + lineIndex * 10 * scale + gy * scale + sy;
              if (px >= image.width || py >= image.height) continue;
              const offset = (py * image.width + px) * 4;
              const luminance = (image.data[offset] + image.data[offset+1] + image.data[offset+2]) / 3;
              const ink = luminance > 128 ? [80,61,30] : [255,230,168];
              for (let channel = 0; channel < 3; channel++) image.data[offset+channel] = Math.round(image.data[offset+channel] * 0.7 + ink[channel] * 0.3);
              image.data[offset+3] = 255;
            }
          }
        }
      });
    }
  }
  // Low compression bounds synchronous edge CPU while keeping raster pages small.
  const output = PNG.sync.write(image, { deflateLevel: 3, filterType: 0 });
  if (output.length > MAX_BYTES) throw new Error('Protected PNG exceeds the delivery limit.');
  return output;
}
