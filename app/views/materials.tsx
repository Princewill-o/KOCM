"use client";
import { useEffect, useState } from "react";
import { friendly, type Profile, type Campus } from "@/lib/koc";
import {
  listMaterials,
  uploadMaterial,
  archiveMaterial,
  type Material,
} from "@/lib/platform";
import Reader from "../components/material-reader";
import { prepareProtectedMaterial } from "@/lib/material-publishing";
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
    [progress, setProgress] = useState(""),
    [selected, setSelected] = useState<Material | null>(null);
  const canUpload = profile.role === "admin";
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
      }, setProgress);
      await refresh();
      form.reset();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function prepare(material: Material) {
    setBusy(true);
    setError("");
    try {
      await prepareProtectedMaterial(material, setProgress);
      await refresh();
    } catch (cause) { setError(friendly(cause)); }
    finally { setBusy(false); setProgress(""); }
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
      setProgress("");
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
              <small>PDF format, maximum 20 MB and 100 pages. Protected reading copies are prepared before sharing.</small>
            </label>
            <button className="button button-yellow" disabled={busy}>
              {busy ? "Uploading…" : "Upload material"}
            </button>
          </form>
        </section>
      )}
      {busy && progress && <p role="status">{progress}</p>}
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
              {m.protected_ready ? <button
                className="button button-yellow"
                onClick={() => setSelected(m)}
              >
                Read material
              </button> : canUpload ? <button className="button button-yellow" disabled={busy} onClick={() => prepare(m)}>Prepare protected copy</button> : <span className="small muted">Protected copy being prepared</span>}
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
