import { Buffer } from 'node:buffer';
// @deno-types="npm:@types/pngjs@6.0.5"
import { PNG } from 'pngjs';
import { CORNER_LOGO_PNG } from './logo-data.ts';
const MAX_BYTES = 8 * 1024 * 1024;
const logo = PNG.sync.read(Buffer.from(CORNER_LOGO_PNG, 'base64'), { checkCRC: true });
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
  // A single subdued mark leaves the reading area clear. Reader attribution is
  // retained by the delivery audit; personal details are not printed on pages.
  const margin = Math.min(24, Math.floor(Math.min(image.width, image.height) / 10));
  const ratio = Math.min(image.width / 900, (image.width - margin * 2) / logo.width, (image.height - margin * 2) / logo.height, 1);
  const width = Math.max(1, Math.round(logo.width * ratio));
  const height = Math.max(1, Math.round(logo.height * ratio));
  const startX = image.width - margin - width;
  const startY = image.height - margin - height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceOffset = (Math.min(logo.height - 1, Math.floor(y / height * logo.height)) * logo.width + Math.min(logo.width - 1, Math.floor(x / width * logo.width))) * 4;
    const sourceAlpha = logo.data[sourceOffset + 3] / 255 * 0.3;
    if (!sourceAlpha) continue;
    const offset = ((startY + y) * image.width + startX + x) * 4;
    const destinationAlpha = image.data[offset + 3] / 255;
    const alpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    for (let channel = 0; channel < 3; channel++) {
      image.data[offset + channel] = Math.round((logo.data[sourceOffset + channel] * sourceAlpha + image.data[offset + channel] * destinationAlpha * (1 - sourceAlpha)) / alpha);
    }
    image.data[offset + 3] = Math.round(alpha * 255);
  }
  // Low compression bounds synchronous edge CPU while keeping raster pages small.
  const output = PNG.sync.write(image, { deflateLevel: 3, filterType: 0 });
  if (output.length > MAX_BYTES) throw new Error('Protected PNG exceeds the delivery limit.');
  return output;
}
