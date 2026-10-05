"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { gradeFormSchema } from "@/lib/platform-schemas";
import { friendly, type Campus, type Profile } from "@/lib/koc";
import { listGrades, submitGrade, type Grade } from "@/lib/platform";
export default function Grades({
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
    z.input<typeof gradeFormSchema>,
    unknown,
    z.output<typeof gradeFormSchema>
  >({
    resolver: zodResolver(gradeFormSchema),
    defaultValues: {
      student: "",
      course: "",
      assessment: "",
      percentage: "",
      date: "",
      notes: "",
    },
  });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Grade[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [campusId, setCampusId] = useState(
    profile.campus_id ?? campuses[0]?.id ?? "",
  );
  const refresh = () =>
    listGrades()
      .then(setRows)
      .catch((e) => setError(friendly(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  async function submit(data: z.output<typeof gradeFormSchema>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await submitGrade({
        campusId,
        studentName: data.student,
        course: data.course,
        assessment: data.assessment,
        percentage: data.percentage,
        assessmentDate: data.date,
        notes: data.notes,
      });
      await refresh();
      reset();
      setMessage(
        "Grade submitted. Grades below 59% notify the leads for acknowledgement.",
      );
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
          <div className="eyebrow">ACADEMIC SUPPORT</div>
          <h1>University grades</h1>
          <p>Submit assessment results so leaders can offer timely support.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
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
          <h2>Submit a grade</h2>
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
                required
                disabled={profile.role === "campus"}
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Student name
              <input {...register("student")} required maxLength={120} />
            </label>
            <label>
              Course
              <input {...register("course")} required maxLength={160} />
            </label>
            <label>
              Assessment
              <input {...register("assessment")} required maxLength={160} />
            </label>
            <label>
              Grade (%)
              <input
                {...register("percentage")}
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
              />
            </label>
            <label>
              Assessment date
              <input {...register("date")} type="date" required />
            </label>
            <label className="feature-wide">
              Notes
              <textarea {...register("notes")} maxLength={2000} />
            </label>
            <button
              className="button button-yellow"
              disabled={busy || !campusId}
            >
              {busy ? "Submitting…" : "Submit grade"}
            </button>
          </form>
        </section>
      )}
      <section className="panel padded feature-section">
        <h2>Submitted grades</h2>
        <div className="management-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>University</th>
                <th>Assessment</th>
                <th>Date</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.student_name}
                    <div className="muted small">{r.course}</div>
                  </td>
                  <td>
                    {campuses.find((c) => c.id === r.campus_id)?.name ??
                      "University"}
                  </td>
                  <td>{r.assessment}</td>
                  <td>{r.assessment_date}</td>
                  <td>
                    <strong className={r.percentage < 59 ? "feature-low" : ""}>
                      {r.percentage}%
                    </strong>
                    {r.percentage < 59 && (
                      <div className="small">Support alert sent</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <p role="status">Loading…</p>}
        {!loading && !error && !rows.length && (
          <p className="empty-line">No grades submitted yet.</p>
        )}
      </section>
    </>
  );
}
