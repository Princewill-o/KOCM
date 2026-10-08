"use client";
import BrandLogo from '@/components/ui/brand-logo';
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, MailCheck, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./theme";
import {
  requestPasswordReset,
  setNewPassword,
  listCampuses,
  friendly,
  type Campus,
} from "@/lib/koc";
import { supabase } from "@/lib/supabase";
import { signInWithIdentifier, signUpWithUsername, USERNAME_PATTERN, USERNAME_HELP } from "@/lib/username-auth";
import { watchPasswordRecovery } from "@/lib/password-recovery";
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
    identifier: z.string().trim().min(1, "Enter your username or email."),
    password: z.string().min(1, "Enter your password."),
  }),
  signup: z.object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(100),
    campusId: z.string().min(1, "Select your university."),
    username: z.string().trim().regex(USERNAME_PATTERN, USERNAME_HELP),
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
  identifier?: string;
  username?: string;
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
    lead: "Enter the verified email you added to your profile. We’ll send you a password reset link.",
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
      return watchPasswordRecovery(
        supabase().auth, window.location.search, window.location.hash,
        state => { setReady(state.ready); setError(state.error); },
      );
    }
  }, [mode]);

  async function submit(values: Fields) {
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        await signInWithIdentifier(values.identifier!, values.password!);
        window.location.assign("/dashboard");
      } else if (mode === "signup") {
        await signUpWithUsername({
          fullName: values.fullName!, username: values.username!,
          password: values.password!, campusId: values.campusId!,
        });
        setNotice("Your account request has been received. An administrator will review your campus access. You can sign in with your username and password to check your approval status.");
      } else if (mode === "forgot") {
        await requestPasswordReset(values.email!);
        setNotice(
          "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder. Open the newest link in the same browser you used here.",
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
          <BrandLogo />
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
          {mode === "forgot" && <p className="auth-approval-note">If you have not added a verified email, contact your campus lead or an administrator for help resetting your password.</p>}
          {notice ? (
            <div className="auth-notice" role="status">
              {mode === "signup" ? <Check size={20} /> : <MailCheck size={20} />}
              <span>{notice}{mode === "signup" && <><br /><Link href="/login">Continue to sign in</Link></>}</span>
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
              {mode === "signup" && <label>Username<Input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30} {...register("username")} /><small>{USERNAME_HELP}</small>{errors.username && <small className="form-error">{errors.username.message}</small>}</label>}
              {mode === "login" && <label>Username or email<Input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register("identifier")} />{errors.identifier && <small className="form-error">{errors.identifier.message}</small>}</label>}
              {mode === "forgot" && <label>Email address<Input type="email" autoComplete="email" {...register("email")} />{errors.email && <small className="form-error">{errors.email.message}</small>}</label>}
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
              {mode === "update" && error && !ready && (
                <Link href="/forgot-password" className="text-button">Request a new reset link</Link>
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
              An administrator will verify your campus before granting access. Email is optional; you can add one in your profile for notifications and password recovery.
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
