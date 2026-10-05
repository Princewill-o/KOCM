// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const readPage = vi.hoisted(() => vi.fn());
vi.mock('../lib/platform', () => ({ readMaterialPage: readPage }));
vi.mock('../lib/koc', () => ({ friendly: (error: Error) => error.message }));
import Reader from '../app/components/material-reader';
const material = { id: 'm', title: 'Teaching', protected_ready: true, page_count: 2 };
const profile = { full_name: 'Reader', email: 'reader@example.com' };
function mount(ready = true) { return render(createElement(Reader, { material: { ...material, protected_ready: ready } as never, profile: profile as never, onClose: vi.fn() })); }
beforeEach(() => {
  readPage.mockReset().mockResolvedValue({ blob: new Blob(), sessionId: 'session', pageCount: 2 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), fillText: vi.fn() } as never);
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 100, height: 150, close: vi.fn() }));
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('protected reader', () => {
  it('renders only page images, clears on blur, and requires explicit resume', async () => {
    mount();
    await waitFor(() => expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('100'));
    fireEvent(window, new Event('blur'));
    expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('0');
    fireEvent(window, new Event('focus'));
    expect(readPage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Resume reading'));
    await waitFor(() => expect(readPage).toHaveBeenCalledTimes(2));
  });
  it('flushes when print or save shortcuts are delivered', async () => {
    mount();
    await waitFor(() => expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('100'));
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('0');
    expect(screen.getByText('Resume reading')).toBeTruthy();
  });
  it('flushes before browser printing', async () => {
    mount();
    await waitFor(() => expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('100'));
    fireEvent(window, new Event('beforeprint'));
    expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('0');
    expect(screen.getByText('Printing is restricted.')).toBeTruthy();
  });
  it('fails closed for material with no protected copy', () => {
    mount(false);
    expect(readPage).not.toHaveBeenCalled();
    expect(screen.getByText(/unavailable until/)).toBeTruthy();
  });
  it('ignores a page response delivered after hiding', async () => {
    let resolve!: (value: unknown) => void;
    readPage.mockImplementation(() => new Promise(done => { resolve = done; }));
    mount();
    await waitFor(() => expect(readPage).toHaveBeenCalledTimes(1));
    const signal = readPage.mock.calls[0][3];
    fireEvent(window, new Event('blur'));
    expect(signal.aborted).toBe(true);
    resolve({ blob: new Blob(), sessionId: 'session', pageCount: 2 });
    await waitFor(() => expect(screen.getByLabelText('Page 1 of Teaching').getAttribute('width')).toBe('0'));
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
});
