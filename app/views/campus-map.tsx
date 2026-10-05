"use client";
import { UK_OUTLINE } from "@/lib/uk-outline";
import { useState } from "react";
import { type Campus, type Profile, friendly } from "@/lib/koc";
import { useEffect } from "react";
import { statsCampuses } from "@/lib/access";
import {
  updateCampusDetails,
  listClusters,
  type Cluster,
} from "@/lib/platform";
export default function CampusMap({
  profile,
  campuses,
  onCampus,
}: {
  profile: Profile;
  campuses: Campus[];
  onCampus: (id: string) => void;
}) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selected, setSelected] = useState<Campus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState<Record<string, Campus>>({});
  useEffect(() => {
    listClusters()
      .then(setClusters)
      .catch((e) => setError(friendly(e)));
  }, []);
  const all = campuses.map((c) => updated[c.id] ?? c);
  const located = all.filter((c) => c.latitude != null && c.longitude != null);
  const canEdit = profile.role === "admin";
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const data = new FormData(e.currentTarget);
    const latitude = String(data.get("latitude")),
      longitude = String(data.get("longitude"));
    setBusy(true);
    setError("");
    try {
      const values = {
        clusterId: String(data.get("cluster")) || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        address: String(data.get("address")),
        meetingInfo: String(data.get("meeting")),
        contactEmail: String(data.get("email")),
      };
      await updateCampusDetails(selected.id, values);
      const next = {
        ...selected,
        cluster_id: values.clusterId,
        latitude: values.latitude,
        longitude: values.longitude,
        address: values.address,
        meeting_info: values.meetingInfo,
        contact_email: values.contactEmail,
      };
      setUpdated({ ...updated, [selected.id]: next });
      setSelected(next);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const point = (c: Campus) => ({
    x: (((c.longitude ?? 0) + 8.5) / 10.5) * 420,
    y: ((59.5 - (c.latitude ?? 0)) / 10) * 560,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OUR CAMPUS NETWORK</div>
          <h1>KOC across the UK</h1>
          <p>Select a campus to see its meeting details and statistics.</p>
        </div>
      </div>
      <div className="feature-map-layout">
        <section className="panel padded">
          <svg
            className="feature-uk-map"
            viewBox="0 0 420 560"
            role="img"
            aria-label="UK campus map"
          >
            <title>UK campus locations</title>
            <path
              className="feature-land"
              d={UK_OUTLINE}
            />
            {located.map((c) => {
              const p = point(c);
              return (
                <g
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={c.name}
                  onClick={() => setSelected(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(c);
                    }
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={selected?.id === c.id ? 9 : 6}
                    fill="#c99100"
                    stroke="white"
                    strokeWidth="3"
                  />
                  <title>{c.name}</title>
                </g>
              );
            })}
          </svg>
          <p className="small muted">
            UK boundary: Natural Earth. University locations: © OpenStreetMap contributors (ODbL). Pins are not
            confirmed KOC meeting venues; campuses awaiting location details
            appear in the list.
          </p>
        </section>
        <section className="panel padded">
          <h2>{selected?.name ?? "Choose a university"}</h2>
          {selected && (
            <>
              <p>{selected.address || "Address not added yet."}</p>
              <p>
                {selected.meeting_info || "Meeting information not added yet."}
              </p>
              {selected.contact_email && (
                <a href={`mailto:${selected.contact_email}`}>
                  {selected.contact_email}
                </a>
              )}
              {statsCampuses(profile, all).some(
                (c) => c.id === selected.id,
              ) && (
                <p>
                  <button
                    className="button button-yellow"
                    onClick={() => onCampus(selected.id)}
                  >
                    View campus statistics
                  </button>
                </p>
              )}
              {canEdit && (
                <form
                  key={selected.id}
                  className="management-form"
                  onSubmit={save}
                >
                  <h3>Campus information</h3>
                  <label>
                    Cluster
                    <select
                      name="cluster"
                      defaultValue={selected.cluster_id ?? ""}
                    >
                      <option value="">Unassigned</option>
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Latitude
                    <input
                      name="latitude"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      defaultValue={selected.latitude ?? ""}
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      name="longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      defaultValue={selected.longitude ?? ""}
                    />
                  </label>
                  <label>
                    Address
                    <input
                      name="address"
                      defaultValue={selected.address ?? ""}
                    />
                  </label>
                  <label>
                    Meeting information
                    <textarea
                      name="meeting"
                      defaultValue={selected.meeting_info ?? ""}
                    />
                  </label>
                  <label>
                    Contact email
                    <input
                      name="email"
                      type="email"
                      defaultValue={selected.contact_email ?? ""}
                    />
                  </label>
                  {error && (
                    <p role="alert" className="form-error">
                      {error}
                    </p>
                  )}
                  <button className="button" disabled={busy}>
                    {busy ? "Saving…" : "Save campus details"}
                  </button>
                </form>
              )}
            </>
          )}
          <div className="feature-campus-list">
            {all.map((c) => (
              <button
                key={c.id}
                className={`feature-campus-choice ${selected?.id === c.id ? "selected" : ""}`}
                onClick={() => setSelected(c)}
              >
                <strong>{c.name}</strong>
                <span className="small muted">
                  {c.region}
                  {c.latitude == null || c.longitude == null
                    ? " · Location awaiting confirmation"
                    : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
