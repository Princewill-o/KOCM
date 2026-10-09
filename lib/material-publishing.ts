'use client';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { supabase } from './supabase';
import { friendly } from './koc';
import type { Material } from './platform';

type Progress = (message: string) => void;
type Input = { title: string; description: string; campusId: string | null };
function checked<T>(result: { data: unknown; error: unknown }): T {
  if (result.error) throw new Error(friendly(result.error));
  return result.data as T;
}
export async function validateMaterialFile(file: Blob): Promise<void> {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a PDF between 1 byte and 20 MB.');
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== '%PDF-') throw new Error('The file must contain a valid PDF document.');
}
export function protectedPageDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Invalid PDF page dimensions.');
  const scale = Math.min(1400 / width, 1600 / width, 2400 / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}
async function publisherId(): Promise<string> {
  const client = supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Please log in before publishing.');
  const profile = checked<{ role: string }>(await client.from('profiles').select('role').eq('id', data.user.id).single());
  if (profile.role !== 'admin') throw new Error('Only material publishers can prepare documents.');
  return data.user.id;
}
async function renderProtectedPages(file: Blob, publisher: string, material: Material, progress?: Progress): Promise<Material> {
  await validateMaterialFile(file);
  let task: PDFDocumentLoadingTask | undefined;
  const canvas = document.createElement('canvas');
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: false, disableFontFace: true });
    const pdf = await task.promise;
    if (!Number.isInteger(pdf.numPages) || pdf.numPages < 1 || pdf.numPages > 100) throw new Error('Materials must contain between 1 and 100 pages.');
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      progress?.(`Protecting page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      try {
        const original = page.getViewport({ scale: 1 });
        const dimensions = protectedPageDimensions(original.width, original.height);
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('The browser could not prepare the material.');
        await page.render({ canvas, canvasContext: context, viewport: page.getViewport({ scale: dimensions.scale }) }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the page image.')), 'image/png'));
        if (blob.size > 8 * 1024 * 1024) throw new Error('A rendered page exceeds the protected reader limit.');
        const objectPath = `${publisher}/${material.id}/page-${pageNumber}.png`;
        checked(await supabase().storage.from('koc-material-pages').upload(objectPath, blob, { contentType: 'image/png', upsert: true }));
        checked(await supabase().rpc('register_material_page', { p_material_id: material.id, p_page_number: pageNumber, p_object_path: objectPath, p_width: dimensions.width, p_height: dimensions.height }));
      } finally { page.cleanup(); canvas.width = 0; canvas.height = 0; }
    }
    progress?.('Publishing protected material…');
    checked(await supabase().rpc('finalize_material', { p_material_id: material.id, p_page_count: pdf.numPages }));
    return checked(await supabase().from('materials').select('*').eq('id', material.id).single());
  } catch (error) {
    progress?.('Preparation failed. This material has not been published.');
    throw error;
  } finally { canvas.width = 0; canvas.height = 0; await task?.destroy(); }
}
export async function publishProtectedMaterial(file: File, input: Input, onProgress?: Progress): Promise<Material> {
  await validateMaterialFile(file);
  const publisher = await publisherId();
  const storage = supabase().storage.from('koc-materials');
  const objectPath = `${publisher}/${crypto.randomUUID()}.pdf`;
  onProgress?.('Uploading private source…');
  checked(await storage.upload(objectPath, file, { contentType: 'application/pdf', upsert: false }));
  let material: Material | undefined;
  try {
    material = checked<Material>(await supabase().from('materials').insert({ title: input.title.trim(), description: input.description.trim(), campus_id: input.campusId || null, object_path: objectPath }).select().single());
    return await renderProtectedPages(file, publisher, material, onProgress);
  } catch (error) {
    if (material) await supabase().from('materials').update({ is_active: false }).eq('id', material.id);
    else await storage.remove([objectPath]);
    throw error;
  }
}
export async function prepareProtectedMaterial(material: Material, onProgress?: Progress): Promise<Material> {
  const publisher = await publisherId();
  onProgress?.('Loading private source…');
  const file = checked<Blob>(await supabase().storage.from('koc-materials').download(material.object_path));
  return renderProtectedPages(file, publisher, material, onProgress);
}
