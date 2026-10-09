import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: vi.fn() }));
import { protectedPageDimensions, validateMaterialFile } from '../lib/material-publishing';
describe('protected material limits', () => {
  it('caps page dimensions before allocating a canvas', () => {
    expect(protectedPageDimensions(600, 900)).toEqual({ width: 1400, height: 2100, scale: 1400 / 600 });
    expect(protectedPageDimensions(100, 10000).height).toBeLessThanOrEqual(2400);
    expect(protectedPageDimensions(10000, 100).width).toBeLessThanOrEqual(1600);
    expect(() => protectedPageDimensions(Infinity, 10)).toThrow();
  });
  it('checks PDF bytes rather than accepting a renamed document', async () => {
    await expect(validateMaterialFile(new Blob(['hello'], { type: 'application/pdf' }))).rejects.toThrow('PDF');
    await expect(validateMaterialFile(new Blob(['%PDF-1.7\n'], { type: 'application/octet-stream' }))).resolves.toBeUndefined();
    await expect(validateMaterialFile(new Blob([]))).rejects.toThrow();
    await expect(validateMaterialFile(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]))).rejects.toThrow();
  });
});

import { supabase } from '../lib/supabase';
import { prepareProtectedMaterial } from '../lib/material-publishing';
const pdfMock = vi.hoisted(() => ({ getDocument: vi.fn(), GlobalWorkerOptions: { workerSrc: '' } }));
vi.mock('pdfjs-dist', () => pdfMock);
const material = { id: 'material', object_path: 'owner/source.pdf' } as import('../lib/platform').Material;
function mockClient(role: string) {
  const single = vi.fn().mockResolvedValue({ data: { role }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
  const download = vi.fn().mockResolvedValue({ data: new Blob(['%PDF-1.7\n']), error: null });
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null }) }, from: vi.fn(() => query), storage: { from: vi.fn(() => ({ download })) }, rpc: vi.fn() };
  vi.mocked(supabase).mockReturnValue(client as unknown as ReturnType<typeof supabase>);
  return client;
}
describe('publisher boundaries', () => {
  it('rejects a campus reader before downloading the private source', async () => {
    const client = mockClient('campus');
    await expect(prepareProtectedMaterial(material)).rejects.toThrow('publishers');
    expect(client.storage.from).not.toHaveBeenCalled();
  });
  it('rejects excessive pages before rendering or finalizing and destroys PDF resources', async () => {
    const client = mockClient('admin');
    const destroy = vi.fn().mockResolvedValue(undefined);
    const getPage = vi.fn();
    pdfMock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 101, getPage }), destroy });
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0 }) });
    try {
      await expect(prepareProtectedMaterial(material)).rejects.toThrow('100 pages');
      expect(getPage).not.toHaveBeenCalled();
      expect(client.rpc).not.toHaveBeenCalled();
      expect(destroy).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});
import { publishProtectedMaterial } from '../lib/material-publishing';
it('publishes only after every page is registered and archives failed preparation', async () => {
  const client = mockClient('admin');
  const events: string[] = [];
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const selectResult = { single: vi.fn().mockResolvedValue({ data: material, error: null }) };
  client.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: { ...material, role: 'admin' }, error: null }) }) }),
    insert: () => ({ select: () => selectResult }), update,
  }) as never);
  const upload = vi.fn(async () => { events.push('upload'); return { data: {}, error: null }; });
  client.storage.from.mockReturnValue({ upload, remove: vi.fn() } as never);
  client.rpc.mockImplementation(async (name: string) => { events.push(name); return { data: material, error: null }; });
  const render = vi.fn(() => ({ promise: Promise.resolve() }));
  const cleanup = vi.fn();
  const destroy = vi.fn().mockResolvedValue(undefined);
  pdfMock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage: async () => ({ getViewport: ({ scale }: {scale:number}) => ({ width: 600 * scale, height: 800 * scale }), render, cleanup }) }), destroy });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({}), toBlob: (cb: (b: Blob) => void) => cb(new Blob(['page'])) }) });
  try {
    await publishProtectedMaterial(new File(['%PDF-1.7\n'], 'document.pdf'), { title: 'Title', description: '', campusId: null });
    expect(events).toEqual(['upload', 'upload', 'register_material_page', 'upload', 'register_material_page', 'finalize_material']);
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
    events.length = 0;
    client.rpc.mockImplementation(async (name: string) => { events.push(name); return { data: null, error: { message: 'Denied' } }; });
    await expect(publishProtectedMaterial(new File(['%PDF-1.7\n'], 'document.pdf'), { title: 'Title', description: '', campusId: null })).rejects.toThrow();
    expect(events).not.toContain('finalize_material');
    expect(update).toHaveBeenCalledWith({ is_active: false });
  } finally { vi.unstubAllGlobals(); }
});

it('removed editor role cannot download sources or prepare protected copies',async()=>{const client=mockClient('editor');await expect(prepareProtectedMaterial(material)).rejects.toThrow('publishers');expect(client.storage.from).not.toHaveBeenCalled();});
