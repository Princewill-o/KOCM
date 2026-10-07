import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { stampProtectedPng } from '../supabase/functions/protected-material-page/watermark';
function blank(width = 600, height = 800) {
  const image = new PNG({ width, height }); image.data.fill(255);
  return PNG.sync.write(image);
}
describe('permanent corner logo watermark', () => {
  it('changes only the bottom-right corner while preserving page dimensions and readable content', () => {
    const source = PNG.sync.read(blank(900, 1200));
    // A dark content line must stay untouched outside the reserved corner.
    source.data.fill(40, 200 * 900 * 4, 201 * 900 * 4);
    const decoded = PNG.sync.read(Buffer.from(stampProtectedPng(PNG.sync.write(source), 'ALICE', 'TRACE')));
    expect([decoded.width, decoded.height]).toEqual([900, 1200]);
    let changed = 0;
    for (let y = 0; y < decoded.height; y++) for (let x = 0; x < decoded.width; x++) {
      const offset = (y * decoded.width + x) * 4;
      const differs = decoded.data.subarray(offset, offset + 4).some((value, channel) => value !== source.data[offset + channel]);
      if (differs) {
        changed++;
        expect(x).toBeGreaterThanOrEqual(786);
        expect(x).toBeLessThan(876);
        expect(y).toBeGreaterThan(1000);
        expect(y).toBeLessThan(1176);
      }
    }
    expect(changed).toBeGreaterThan(500);
    expect(decoded.data.subarray(200 * 900 * 4, 201 * 900 * 4)).toEqual(source.data.subarray(200 * 900 * 4, 201 * 900 * 4));
  });
  it('does not render personal names or traces into the visible logo', () => {
    const source = blank();
    expect(stampProtectedPng(source, 'ALICE | ACCOUNT A', 'TRACE A')).toEqual(stampProtectedPng(source, 'BOB | ACCOUNT B', 'TRACE B'));
  });
  it('fits a logo within a very small valid page', () => {
    const decoded = PNG.sync.read(Buffer.from(stampProtectedPng(blank(20, 20), 'NAME', 'TRACE')));
    expect([decoded.width, decoded.height]).toEqual([20, 20]);
  });
  it('requires reader identity and audit trace even though they are not visible', () => {
    expect(() => stampProtectedPng(blank(), '', 'TRACE')).toThrow('identity');
    expect(() => stampProtectedPng(blank(), 'NAME', '')).toThrow('identity');
  });
  it('rejects malformed signatures, oversized input and oversized IHDR before decoding', () => {
    expect(() => stampProtectedPng(new Uint8Array([1,2,3]), 'NAME', 'TRACE')).toThrow();
    expect(() => stampProtectedPng(new Uint8Array(8 * 1024 * 1024 + 1), 'NAME', 'TRACE')).toThrow();
    const forged = Buffer.from(blank()); forged.writeUInt32BE(1601,16);
    expect(() => stampProtectedPng(forged, 'NAME', 'TRACE')).toThrow('dimensions');
  });
  it('rejects PNGs with invalid CRC data', () => {
    const corrupted = Buffer.from(blank()); corrupted[29] ^= 255;
    expect(() => stampProtectedPng(corrupted, 'NAME', 'TRACE')).toThrow();
  });
});
