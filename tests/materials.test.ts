// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), archive: vi.fn(), prepare: vi.fn(), reader: vi.fn() }));
vi.mock('../lib/platform', () => ({ listMaterials: mocks.list, uploadMaterial: mocks.upload, archiveMaterial: mocks.archive }));
vi.mock('../lib/material-publishing', () => ({ prepareProtectedMaterial: mocks.prepare }));
vi.mock('../lib/koc', () => ({ friendly: (error: Error) => error.message }));
vi.mock('../app/components/material-reader', () => ({ default: (props: unknown) => { mocks.reader(props); return createElement('div', { role: 'region', 'aria-label': 'Protected reader' }); } }));
import Materials from '../app/views/materials';
const material = { id: 'material', title: 'Teaching', description: 'Lesson', campus_id: 'campus', protected_ready: false, page_count: 0 };
const campus = { id: 'campus', name: 'Example University' };
const profile = { id: 'reader', full_name: 'Reader', role: 'campus', email: 'reader@example.com' };
function mount(role = 'campus') { return render(createElement(Materials, { profile: { ...profile, role } as never, campuses: [campus] as never })); }
beforeEach(() => { Object.values(mocks).forEach(mock => mock.mockReset()); mocks.list.mockResolvedValue([material]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('materials protected publishing and reading', () => {
  it('campus users cannot read or prepare an unpublished protected copy', async () => {
    mount();
    expect(await screen.findByText('Protected copy being prepared')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Read material' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prepare protected copy' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Upload material' })).toBeNull();
    expect(mocks.reader).not.toHaveBeenCalled();
  });
  it('campus reading uses the protected reader without source or download controls', async () => {
    mocks.list.mockResolvedValue([{ ...material, protected_ready: true, page_count: 2 }]);
    const view = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Read material' }));
    expect(screen.getByRole('region', { name: 'Protected reader' })).toBeTruthy();
    expect(mocks.reader.mock.calls.at(-1)?.[0]).toMatchObject({ material: { id: material.id, protected_ready: true }, profile });
    expect(view.container.querySelector('a,iframe,object,embed')).toBeNull();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it('publishers can prepare an existing material and see progress until completion', async () => {
    let finish!: () => void;
    mocks.prepare.mockImplementation((_material, progress) => { progress('Protecting page 1 of 2…'); return new Promise<void>(resolve => { finish = resolve; }); });
    mount('editor');
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare protected copy' }));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Protecting page 1 of 2…');
    expect(mocks.prepare).toHaveBeenCalledWith(material, expect.any(Function));
    expect((screen.getByRole('button', { name: 'Prepare protected copy' }) as HTMLButtonElement).disabled).toBe(true);
    finish();
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
  it('publisher upload passes file and campus inputs and reports protection progress', async () => {
    let finish!: () => void;
    const file = new File(['%PDF-example'], 'lesson.pdf', { type: 'application/pdf' });
    const NativeFormData = globalThis.FormData;
    vi.stubGlobal('FormData', class extends NativeFormData { constructor(form?: HTMLFormElement) { super(); if (form) { this.set('title', 'A lesson'); this.set('description', 'Lesson details'); this.set('campus', 'campus'); this.set('file', file); } } });
    mocks.upload.mockImplementation((_file, _input, progress) => { progress('Protecting page 1 of 1…'); return new Promise<void>(resolve => { finish = resolve; }); });
    mount('admin');
    await screen.findByText('Teaching');
    const form = screen.getByRole('button', { name: 'Upload material' }).closest('form')!;
    fireEvent.submit(form);
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Protecting page 1 of 1…');
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'lesson.pdf' }), { title: 'A lesson', description: 'Lesson details', campusId: 'campus' }, expect.any(Function));
    finish();
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
});
