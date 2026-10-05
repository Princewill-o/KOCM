import { describe, expect, it } from 'vitest';
import { isRestrictedReaderShortcut } from '../lib/reader-guards';
const key = (value: string, ctrlKey = false, metaKey = false, shiftKey = false) => ({ key: value, ctrlKey, metaKey, shiftKey });
describe('protected reader shortcuts', () => {
  it('restricts browser copying, saving and printing on Windows and Mac', () => {
    for (const value of ['p','s','c']) {
      expect(isRestrictedReaderShortcut(key(value,true))).toBe(true);
      expect(isRestrictedReaderShortcut(key(value,false,true))).toBe(true);
    }
  });
  it('detects delivered capture shortcuts without blocking navigation', () => {
    expect(isRestrictedReaderShortcut(key('PrintScreen'))).toBe(true);
    for (const value of ['3','4','5']) expect(isRestrictedReaderShortcut(key(value,false,true,true))).toBe(true);
    for (const value of ['ArrowRight','Tab','Enter','3','c']) expect(isRestrictedReaderShortcut(key(value))).toBe(false);
  });
});
