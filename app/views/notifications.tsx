"use client";
import { useEffect, useState } from "react";
import { friendly } from "@/lib/koc";
import {
  listNotifications,
  acknowledgeNotification,
  type Notification,
} from "@/lib/platform";
export default function Notifications({onOpenReports}:{onOpenReports?:()=>void} = {}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Notification[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const refresh = () =>
    listNotifications()
      .then(setRows)
      .catch((e) => setError(friendly(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  async function mark(id: string) {
    setBusy(id);
    setError("");
    try {
      await acknowledgeNotification(id);
      await refresh();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LEADERSHIP INBOX</div>
          <h1>Notifications</h1>
          <p>
            Review cluster submissions, late weekly reports and grades requiring support. Acknowledge
            each alert after reading.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <section className="panel padded">
        {loading && <p role="status">Loading…</p>}
        {!loading && !error && !rows.length && (
          <p className="empty-line">No notifications yet.</p>
        )}
        {rows.map((r) => (
          <article
            className={`feature-notification ${r.read_at ? "" : "unread"}`}
            key={r.id}
          >
            <div>
              <span className="eyebrow">
                {r.kind === "low_grade" ? "ACADEMIC SUPPORT" : r.kind === "cluster_report" ? "CLUSTER REPORT" : "LATE REPORT"}
              </span>
              <h2>{r.title}</h2>
              <p>{r.message}</p>{r.kind === "cluster_report" && <button type="button" className="text-button" onClick={onOpenReports}>Read cluster reports</button>}
              <time className="small muted">
                {new Date(r.created_at).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                })}
              </time>
            </div>
            {r.read_at ? (
              <span className="success-message">
                Read · {new Date(r.read_at).toLocaleDateString("en-GB")}
              </span>
            ) : (
              <button
                className="button button-yellow"
                disabled={busy === r.id}
                onClick={() => mark(r.id)}
              >
                {busy === r.id ? "Saving…" : "Mark as read"}
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
