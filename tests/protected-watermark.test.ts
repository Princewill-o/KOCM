import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { stampProtectedPng } from '../supabase/functions/protected-material-page/watermark';
function blank(width = 600, height = 800) {
  const image = new PNG({ width, height }); image.data.fill(255);
  return PNG.sync.write(image);
}
describe('permanent protected page watermark', () => {
  it('stamps visible repeated pixels, preserving dimensions and different reader identities', () => {
    const source = blank();
    const a = stampProtectedPng(source, 'ALICE | 11111111-1111-1111-1111-111111111111', 'KOC TRACE123 | PAGE 1 | 2026-10-05T12:00:00Z');
    const b = stampProtectedPng(source, 'BOB | 22222222-2222-2222-2222-222222222222', 'KOC TRACE123 | PAGE 1 | 2026-10-05T12:00:00Z');
    expect(Buffer.compare(a, b)).not.toBe(0);
    const decoded = PNG.sync.read(Buffer.from(a));
    expect([decoded.width, decoded.height]).toEqual([600, 800]);
    for (const [start,end] of [[0,200],[200,400],[400,600],[600,800]]) {
      expect(decoded.data.subarray(start * 600 * 4, end * 600 * 4).some((v,i) => i % 4 !== 3 && v < 230)).toBe(true);
    }
  });
  it('retains account attribution after a long name', () => {
    const source = blank();
    const name = 'LONG NAME '.repeat(40);
    const a = stampProtectedPng(source, `${name}| 11111111-1111-1111-1111-111111111111`, 'TRACE');
    const b = stampProtectedPng(source, `${name}| 22222222-2222-2222-2222-222222222222`, 'TRACE');
    expect(Buffer.compare(a, b)).not.toBe(0);
  });
  it('rejects malformed signatures, oversized input and oversized IHDR before decoding', () => {
    expect(() => stampProtectedPng(new Uint8Array([1,2,3]), 'NAME', 'TRACE')).toThrow();
    expect(() => stampProtectedPng(new Uint8Array(8 * 1024 * 1024 + 1), 'NAME', 'TRACE')).toThrow();
    const forged = Buffer.from(blank()); forged.writeUInt32BE(1601,16);
    expect(() => stampProtectedPng(forged, 'NAME', 'TRACE')).toThrow('dimensions');
  });
});
