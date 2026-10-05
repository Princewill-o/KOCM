"use client";
import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import { friendly, type Profile, type Campus } from "@/lib/koc";
import {
  listMaterials,
  uploadMaterial,
  archiveMaterial,
  readMaterial,
  type Material,
} from "@/lib/platform";
function Reader({
  material,
  profile,
  onClose,
}: {
  material: Material;
  profile: Profile;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [error, setError] = useState(""),
    [hidden, setHidden] = useState(false),
    [rendering, setRendering] = useState(true);
  const documentCache = useRef<Promise<PDFDocumentProxy> | null>(null);
  const loadingTask = useRef<PDFDocumentLoadingTask | null>(null);
  useEffect(
    () => () => {
      documentCache.current = null;
      void loadingTask.current?.destroy();
      loadingTask.current = null;
    },
    [],
  );
  useEffect(() => {
    const hide = () => setHidden(true),
      show = () => setHidden(document.hidden);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", show);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", show);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    async function render() {
      setRendering(true);
      setError("");
      if (canvas.current) {
        const context = canvas.current.getContext("2d");
        context?.clearRect(0, 0, canvas.current.width, canvas.current.height);
      }
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        if (!documentCache.current) {
          documentCache.current = (async () => {
            const blob = await readMaterial(material);
            const task = pdfjs.getDocument({
              data: new Uint8Array(await blob.arrayBuffer()),
            });
            loadingTask.current = task;
            return task.promise;
          })();
        }
        const doc = await documentCache.current;
        if (cancelled) return;
        setPages(doc.numPages);
        const pdfPage = await doc.getPage(page);
        if (cancelled || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: 1.4 });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        const ctx = canvas.current.getContext("2d");
        if (!ctx) return;
        renderTask = pdfPage.render({
          canvas: canvas.current,
          canvasContext: ctx,
          viewport,
        });
        await renderTask.promise;
        if (cancelled) return;
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#634514";
        ctx.font = "20px sans-serif";
        for (let y = 70; y < viewport.height; y += 150) {
          ctx.fillText(
            `${profile.full_name} · KOC · ${new Date().toLocaleDateString("en-GB")}`,
            25,
            y,
          );
        }
        ctx.restore();
      } catch (e) {
        if (!cancelled) setError(friendly(e));
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [material, profile.full_name, page]);
  return (
    <section
      className="panel padded feature-reader"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="feature-reader-controls">
        <h2>{material.title}</h2>
        <button className="button" onClick={onClose}>
          Close reader
        </button>
      </div>
      <p className="small muted">
        Personal reading copy. Content is watermarked and hidden when this
        window loses focus. Browser software cannot reliably prevent screenshots
        or screen recordings.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {rendering && <p role="status">Opening material…</p>}
      <div
        className="feature-reader-canvas"
        style={{ visibility: hidden ? "hidden" : "visible" }}
      >
        <canvas ref={canvas} aria-label={`Page ${page} of ${material.title}`} />
      </div>
      <div className="feature-reader-controls">
        <button
          className="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous page
        </button>
        <span>
          Page {page}
          {pages ? ` of ${pages}` : ""}
        </span>
        <button
          className="button"
          disabled={!pages || page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next page
        </button>
      </div>
    </section>
  );
}
export default function Materials({
  profile,
  campuses,
}: {
  profile: Profile;
  campuses: Campus[];
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Material[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Material | null>(null);
  const canUpload = profile.role === "admin" || profile.role === "editor";
  const refresh = () =>
    listMaterials()
      .then(setRows)
      .catch((e) => setError(friendly(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form),
      file = data.get("file");
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    setError("");
    try {
      await uploadMaterial(file, {
        title: String(data.get("title")),
        description: String(data.get("description")),
        campusId: String(data.get("campus")) || null,
      });
      await refresh();
      form.reset();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string) {
    setBusy(true);
    try {
      await archiveMaterial(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KOC RESOURCES</div>
          <h1>Materials</h1>
          <p>Read the teaching materials shared with your campus.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {canUpload && (
        <section className="panel padded">
          <h2>Upload material</h2>
          <form className="management-form feature-form" onSubmit={upload}>
            <label>
              Title
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Share with
              <select name="campus">
                <option value="">All campuses</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea name="description" maxLength={2000} />
            </label>
            <label>
              PDF file
              <input
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
              />
              <small>PDF format, maximum 20 MB.</small>
            </label>
            <button className="button button-yellow" disabled={busy}>
              {busy ? "Uploading…" : "Upload material"}
            </button>
          </form>
        </section>
      )}
      <section className="panel padded feature-section">
        <h2>Available materials</h2>
        {loading && <p role="status">Loading…</p>}
        {!loading && !error && !rows.length && (
          <p className="empty-line">No materials have been shared yet.</p>
        )}
        {rows.map((m) => (
          <article className="feature-material" key={m.id}>
            <div>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
              <span className="small muted">
                {m.campus_id
                  ? campuses.find((c) => c.id === m.campus_id)?.name
                  : "All campuses"}
              </span>
            </div>
            <div>
              <button
                className="button button-yellow"
                onClick={() => setSelected(m)}
              >
                Read material
              </button>
              {canUpload && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => archive(m.id)}
                >
                  Archive
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      {selected && (
        <Reader
          key={selected.id}
          material={selected}
          profile={profile}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
