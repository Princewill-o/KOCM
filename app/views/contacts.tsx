"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { contactFormSchema } from "@/lib/platform-schemas";
import { friendly, type Profile, type Campus } from "@/lib/koc";
import {
  listContacts,
  saveContact,
  archiveContact,
  type Contact,
} from "@/lib/platform";
export default function Contacts({
  profile,
  campuses,
}: {
  profile: Profile;
  campuses: Campus[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<
    z.input<typeof contactFormSchema>,
    unknown,
    z.output<typeof contactFormSchema>
  >({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      fellowship: false,
      branch: false,
      notes: "",
    },
  });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Contact[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [campusId, setCampusId] = useState(
      profile.campus_id ?? campuses[0]?.id ?? "",
    );
  const refresh = () =>
    listContacts()
      .then(setRows)
      .catch((e) => setError(friendly(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  async function submit(data: z.output<typeof contactFormSchema>) {
    setBusy(true);
    setError("");
    try {
      await saveContact({
        campusId,
        fullName: data.name,
        phone: data.phone,
        fellowshipAttended: data.fellowship,
        branchAttended: data.branch,
        notes: data.notes,
      });
      await refresh();
      reset();
      setMessage("Contact added.");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  async function update(
    row: Contact,
    field: "fellowshipAttended" | "branchAttended",
    value: boolean,
  ) {
    setError("");
    setBusy(true);
    try {
      await saveContact({
        id: row.id,
        campusId: row.campus_id,
        fullName: row.full_name,
        phone: row.phone,
        fellowshipAttended:
          field === "fellowshipAttended" ? value : row.fellowship_attended,
        branchAttended:
          field === "branchAttended" ? value : row.branch_attended,
        notes: row.notes,
      });
      await refresh();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string) {
    setBusy(true);
    try {
      await archiveContact(id);
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
          <div className="eyebrow">CAMPUS CONNECTIONS</div>
          <h1>People &amp; follow-up</h1>
          <p>
            Keep contact details and record fellowship and branch attendance for
            your university.
          </p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      {profile.role !== "cluster" && (
        <section className="panel padded">
          <h2>Add a person</h2>
          {Object.values(errors).map((error, i) => (
            <p key={i} role="alert" className="form-error">
              {error.message}
            </p>
          ))}
          <form
            className="management-form feature-form"
            onSubmit={handleSubmit(submit)}
          >
            <label>
              University
              <select
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                disabled={profile.role === "campus"}
                required
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Full name
              <input {...register("name")} required maxLength={120} />
            </label>
            <label>
              Phone number
              <input
                {...register("phone")}
                type="tel"
                required
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            <div className="feature-checks">
              <label>
                <input type="checkbox" {...register("fellowship")} /> Attended
                fellowship
              </label>
              <label>
                <input type="checkbox" {...register("branch")} /> Attended
                branch
              </label>
            </div>
            <label className="feature-wide">
              Follow-up notes
              <textarea {...register("notes")} maxLength={2000} />
            </label>
            <p className="small muted feature-wide">
              Only add details shared with permission for KOC follow-up.
            </p>
            <button
              className="button button-yellow"
              disabled={busy || !campusId}
            >
              {busy ? "Saving…" : "Add person"}
            </button>
          </form>
        </section>
      )}
      <section className="panel padded feature-section">
        <h2>Contact directory</h2>
        <div className="management-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>University</th>
                <th>Phone</th>
                <th>Fellowship</th>
                <th>Branch</th>
                <th>Follow-up</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{campuses.find((c) => c.id === r.campus_id)?.name}</td>
                  <td>
                    <a href={`tel:${r.phone}`}>{r.phone}</a>
                  </td>
                  <td>
                    <input
                      aria-label={`Fellowship attendance for ${r.full_name}`}
                      type="checkbox"
                      checked={r.fellowship_attended}
                      disabled={busy || profile.role === "cluster"}
                      onChange={(e) =>
                        update(r, "fellowshipAttended", e.target.checked)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Branch attendance for ${r.full_name}`}
                      type="checkbox"
                      checked={r.branch_attended}
                      disabled={busy || profile.role === "cluster"}
                      onChange={(e) =>
                        update(r, "branchAttended", e.target.checked)
                      }
                    />
                  </td>
                  <td>{r.notes || "—"}</td>
                  <td>
                    {profile.role !== "cluster" && (
                      <button
                        className="icon-text"
                        disabled={busy}
                        onClick={() => archive(r.id)}
                      >
                        Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <p role="status">Loading…</p>}
        {!loading && !error && !rows.length && (
          <p className="empty-line">
            Add your first contact to start recording follow-up.
          </p>
        )}
      </section>
    </>
  );
}
