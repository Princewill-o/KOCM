"use client";
import { useEffect, useRef, useState } from 'react';
import { friendly, type Profile } from '@/lib/koc';
import { readMaterialPage, type Material } from '@/lib/platform';
import { isRestrictedReaderShortcut, READER_IDLE_MS } from '@/lib/reader-guards';
import './material-reader.css';

async function decode(blob: Blob, signal: AbortSignal): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    if (signal.aborted) { bitmap.close(); throw new DOMException('Aborted', 'AbortError'); }
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const abort = () => { image.src = ''; reject(new DOMException('Aborted', 'AbortError')); };
      image.onload = () => { signal.removeEventListener('abort', abort); resolve(); };
      image.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('Cannot display this page.')); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort(); else image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ''; } };
  } finally { URL.revokeObjectURL(url); }
}

export default function Reader({ material, profile, onClose }: { material: Material; profile: Profile; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const session = useRef<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(material.page_count);
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden ? 'Reading paused while this page was hidden.' : '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const flush = () => {
    generation.current++;
    request.current?.abort();
    if (canvas.current) { canvas.current.width = 0; canvas.current.height = 0; }
  };
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    const pause = (reason: string) => { flush(); session.current = undefined; setPaused(reason); setLoading(false); };
    const resetIdle = () => { clearTimeout(idle); idle = setTimeout(() => pause('Reading paused after inactivity.'), READER_IDLE_MS); };
    const blur = () => pause('Reading paused because the window lost focus.');
    const visibility = () => { if (document.hidden) pause('Reading paused while this page was hidden.'); };
    const print = () => pause('Printing is restricted.');
    const key = (event: KeyboardEvent) => {
      if (isRestrictedReaderShortcut(event)) { event.preventDefault(); event.stopPropagation(); pause('Copying, saving and capture shortcuts are restricted.'); }
    };
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', blur);
    window.addEventListener('beforeprint', print);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', resetIdle);
    document.addEventListener('keydown', resetIdle);
    resetIdle();
    return () => {
      clearTimeout(idle); flush(); session.current = undefined;
      window.removeEventListener('blur', blur); window.removeEventListener('pagehide', blur); window.removeEventListener('beforeprint', print);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', resetIdle); document.removeEventListener('keydown', resetIdle);
    };
  }, []);
  useEffect(() => {
    flush();
    if (paused || !material.protected_ready) return;
    const controller = new AbortController(); request.current = controller;
    const current = generation.current;
    void (async () => {
      let decoded: Awaited<ReturnType<typeof decode>> | undefined;
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;
        setLoading(true); setError('');
        const result = await readMaterialPage(material.id, page, session.current, controller.signal);
        if (controller.signal.aborted || current !== generation.current) return;
        decoded = await decode(result.blob, controller.signal);
        if (controller.signal.aborted || current !== generation.current || !canvas.current) return;
        const context = canvas.current.getContext('2d');
        if (!context) throw new Error('Your browser cannot display protected pages.');
        canvas.current.width = decoded.width; canvas.current.height = decoded.height;
        context.drawImage(decoded.image, 0, 0);
        context.save(); context.globalAlpha = 0.18; context.fillStyle = '#634514'; context.font = `${Math.max(14, decoded.width / 55)}px sans-serif`;
        const identity = `${profile.full_name} · ${profile.email} · ${new Date().toISOString()}`;
        for (let y = 70; y < decoded.height; y += 160) context.fillText(identity, 20, y, decoded.width - 40);
        context.restore(); session.current = result.sessionId; setPages(result.pageCount);
      } catch (cause) { if (!controller.signal.aborted && current === generation.current) { flush(); session.current = undefined; setError(friendly(cause)); setLoading(false); } }
      finally { decoded?.close(); if (!controller.signal.aborted && current === generation.current) setLoading(false); }
    })();
    return flush;
  }, [material.id, material.protected_ready, page, paused, profile.full_name, profile.email]);
  const changePage = (value: number) => { flush(); setLoading(true); setPage(value); };
  const unavailable = !material.protected_ready;
  return <section className="panel padded feature-reader" onContextMenu={e => e.preventDefault()} onCopy={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
    <div className="feature-reader-controls"><h2>{material.title}</h2><button className="button" onClick={() => { flush(); session.current = undefined; onClose(); }}>Close reader</button></div>
    <p className="small muted">Personalised reading copy. Copying, saving and printing are restricted. Screenshots cannot be reliably blocked.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="protected-reader-page"><canvas ref={canvas} aria-label={`Page ${page} of ${material.title}`} />
      {(paused || unavailable || loading || error) && <div className="protected-reader-mask">
        <p role="status">{unavailable ? 'This material is unavailable until its protected reading copy is prepared.' : paused || error || 'Opening protected page…'}</p>
        {paused && !unavailable && <button className="button button-yellow" onClick={() => { if (!document.hidden && document.hasFocus()) { setLoading(true); setError(''); setPaused(''); } }}>Resume reading</button>}
        {error && !paused && !unavailable && <button className="button" onClick={() => setPaused('Reading paused. Resume to try again.')}>Try again</button>}
      </div>}
    </div>
    <div className="feature-reader-controls"><button className="button" disabled={page <= 1 || !!paused || loading || unavailable} onClick={() => changePage(page - 1)}>Previous page</button><span>Page {page}{pages ? ` of ${pages}` : ''}</span><button className="button" disabled={!pages || page >= pages || !!paused || loading || unavailable} onClick={() => changePage(page + 1)}>Next page</button></div>
  </section>;
}
