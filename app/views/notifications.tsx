"use client";
import { useEffect, useState } from "react";
import { friendly } from "@/lib/koc";
import {
  listNotifications,
  acknowledgeNotification,
  type Notification,
} from "@/lib/platform";
export default function Notifications({onOpenReports,onOpenApplication,onOpenReporting}:{onOpenReports?:()=>void;onOpenApplication?:(campusId:string|null)=>void;onOpenReporting?:(scope:string,scopeId:string|null,week:string|null)=>void}) {
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
            Review report reminders, missing submissions, lead applications, cluster submissions and grades requiring support. Acknowledge
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
                {r.kind === "lead_application" ? "LEAD APPLICATION" : r.kind === "low_grade" ? "ACADEMIC SUPPORT" : r.kind === "cluster_report" ? "CLUSTER REPORT" : r.kind === "report_reminder" ? "REPORT REMINDER" : r.kind === "missing_report" ? "MISSING REPORT" : "LATE REPORT"}
              </span>
              <h2>{r.title}</h2>{r.resolved_at && <p className="success-message">Resolved — this report is no longer outstanding.</p>}
              <p>{r.message}</p>{r.kind === "lead_application" && <button type="button" className="text-button" onClick={()=>onOpenApplication?.(r.campus_id)}>Review application</button>}{r.kind === "cluster_report" && <button type="button" className="text-button" onClick={onOpenReports}>Read cluster reports</button>}
              {onOpenReporting && !r.resolved_at && (r.kind === "report_reminder" || r.kind === "missing_report") && <button type="button" className="text-button" onClick={()=>onOpenReporting(r.reporting_scope??"campus",r.reporting_scope_id??r.campus_id,r.reporting_week??null)}>Open weekly report</button>}
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
