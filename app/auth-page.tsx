"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./theme";
import {
  signIn,
  signUp,
  requestPasswordReset,
  setNewPassword,
  listCampuses,
  friendly,
  type Campus,
} from "@/lib/koc";
import { supabase } from "@/lib/supabase";
import "./management.css";
import "./auth-design.css";

type Mode = "login" | "signup" | "forgot" | "update";

const email = z.string().trim().email("Enter a valid email address.");
const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.");
const schemas = {
  login: z.object({
    email,
    password: z.string().min(1, "Enter your password."),
  }),
  signup: z.object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(100),
    campusId: z.string().min(1, "Select your university."),
    email,
    password: strongPassword,
  }),
  forgot: z.object({ email }),
  update: z
    .object({ password: strongPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, {
      message: "Passwords do not match.",
      path: ["confirm"],
    }),
};
type Fields = {
  email?: string;
  password?: string;
  fullName?: string;
  campusId?: string;
  confirm?: string;
};

const copy: Record<Mode, { title: string; lead: string; button: string }> = {
  login: {
    title: "Sign in to your workspace",
    lead: "Access your campus reports, fellowship records and shared materials.",
    button: "Sign in",
  },
  signup: {
    title: "Request a campus account",
    lead: "Tell us who you are and which university you represent.",
    button: "Request campus access",
  },
  forgot: {
    title: "Reset your password",
    lead: "Enter your account email and we’ll send you a secure reset link.",
    button: "Send reset link",
  },
  update: {
    title: "Choose a new password",
    lead: "Use at least 12 characters. You’ll stay signed in afterwards.",
    button: "Save new password",
  },
};

export default function AuthPage({ mode = "login" }: { mode?: Mode }) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(mode !== "update");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schemas[mode] as z.ZodType<Fields>),
  });

  useEffect(() => {
    if (mode === "login" || mode === "signup") {
      // Already signed in? Go straight to the workspace.
      supabase()
        .auth.getSession()
        .then(({ data }) => {
          if (data.session) window.location.replace("/dashboard");
        });
    }
    if (mode === "signup")
      listCampuses()
        .then(setCampuses)
        .catch(() =>
          setError(
            "Unable to load universities. Please refresh and try again.",
          ),
        );
    if (mode === "update") {
      // The reset link signs the user in with a short-lived recovery session.
      const { data: sub } = supabase().auth.onAuthStateChange(
        (event, session) => {
          if (
            session &&
            (event === "PASSWORD_RECOVERY" ||
              event === "SIGNED_IN" ||
              event === "INITIAL_SESSION")
          )
            setReady(true);
        },
      );
      const timer = setTimeout(async () => {
        const { data } = await supabase().auth.getSession();
        if (data.session) setReady(true);
        else
          setError(
            "This reset link is invalid or has expired. Request a new one.",
          );
      }, 1500);
      return () => {
        sub.subscription.unsubscribe();
        clearTimeout(timer);
      };
    }
  }, [mode]);

  async function submit(values: Fields) {
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        await signIn(values.email!, values.password!);
        window.location.assign("/dashboard");
      } else if (mode === "signup") {
        const { needsConfirmation } = await signUp({
          fullName: values.fullName!,
          email: values.email!,
          password: values.password!,
          campusId: values.campusId!,
        });
        if (needsConfirmation)
          setNotice(
            "Check your inbox to confirm your email address. After that, an administrator will verify your campus.",
          );
        else window.location.assign("/dashboard");
      } else if (mode === "forgot") {
        await requestPasswordReset(values.email!);
        setNotice(
          "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.",
        );
      } else {
        await setNewPassword(values.password!);
        window.location.assign("/dashboard");
      }
    } catch (e) {
      setError(friendly(e));
    }
  }

  const { title, lead, button } = copy[mode];
  const top =
    mode === "signup"
      ? { text: "Already registered?", href: "/login", link: "Sign in" }
      : mode === "login"
        ? {
            text: "New campus representative?",
            href: "/signup",
            link: "Request access",
          }
        : { text: "Remembered it?", href: "/login", link: "Sign in" };

  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <Link className="auth-brand" href="/">
          <img src="/kharis-logo.png" alt="" />
          <span>Kharis On Campus</span>
        </Link>
        <div className="auth-brand-description">
          <span className="auth-section-label">CAMPUS WORKSPACE</span>
          <h1>
            Care for your
            <br />
            campus community.
          </h1>
          <p>
            Keep your fellowship connected, with a clear view of your campus and
            the support of your ministry leads.
          </p>
          <ul className="auth-workspace-details">
            <li>Submit weekly campus reports</li>
            <li>Keep fellowship and follow-up records</li>
            <li>Read resources shared by your leaders</li>
          </ul>
        </div>
        <div className="auth-brand-bottom">
          <span>Prayer · Outreach · Fellowship</span>
          <Link href="/">
            Back to home <ArrowRight size={14} />
          </Link>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-top">
          <span>{top.text}</span>
          <Link href={top.href}>{top.link}</Link>
          <ThemeToggle />
        </div>
        <div className="auth-content">
          <span className="auth-kicker">
            {mode === "login"
              ? "MEMBER ACCESS"
              : mode === "signup"
                ? "CAMPUS REGISTRATION"
                : "ACCOUNT RECOVERY"}
          </span>
          <h2>{title}</h2>
          <p>{lead}</p>
          {notice ? (
            <div className="auth-notice" role="status">
              <MailCheck size={20} />
              <span>{notice}</span>
            </div>
          ) : (
            <form
              className="management-form"
              onSubmit={handleSubmit(submit)}
              noValidate
            >
              {mode === "signup" && (
                <>
                  <label>
                    Your name
                    <Input autoComplete="name" {...register("fullName")} />
                    {errors.fullName && (
                      <small className="form-error">
                        {errors.fullName.message}
                      </small>
                    )}
                  </label>
                  <label>
                    University
                    <select {...register("campusId")} defaultValue="">
                      <option value="" disabled>
                        Select your university
                      </option>
                      {campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {errors.campusId && (
                      <small className="form-error">
                        {errors.campusId.message}
                      </small>
                    )}
                  </label>
                </>
              )}
              {mode !== "update" && (
                <label>
                  Email address
                  <Input
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && (
                    <small className="form-error">{errors.email.message}</small>
                  )}
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  {mode === "update" ? "New password" : "Password"}
                  <Input
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    {...register("password")}
                  />
                  {mode !== "login" && <small>At least 12 characters</small>}
                  {errors.password && (
                    <small className="form-error">
                      {errors.password.message}
                    </small>
                  )}
                </label>
              )}
              {mode === "login" && (
                <Link
                  href="/forgot-password"
                  className="inline-link forgot-link"
                >
                  Forgot password?
                </Link>
              )}
              {mode === "update" && (
                <label>
                  Confirm new password
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...register("confirm")}
                  />
                  {errors.confirm && (
                    <small className="form-error">
                      {errors.confirm.message}
                    </small>
                  )}
                </label>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                className="button button-yellow auth-submit"
                disabled={isSubmitting || !ready}
              >
                {isSubmitting
                  ? "Please wait…"
                  : !ready
                    ? "Checking link…"
                    : button}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {mode === "signup" && (
            <p className="auth-approval-note">
              After confirming your email, an administrator will verify your
              campus before granting access.
            </p>
          )}
        </div>
        <footer className="auth-footer">
          <span>© Kharis On Campus</span>
        </footer>
      </section>
    </main>
  );
}
