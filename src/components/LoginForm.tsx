"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const fullName = String(form.get("full_name") || "");
    const businessName = String(form.get("business_name") || "");
    const supabase = createClient();

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                business_name: businessName
              }
            }
          });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/[0.92] p-6 backdrop-blur-xl sm:p-7"
      style={{ boxShadow: "var(--q-shadow-elevated)" }}
    >
      {/* Subtle top accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cedar/20 to-transparent" aria-hidden="true" />

      {/* Mode toggle — premium tab switcher */}
      <div className="mb-6 flex rounded-xl bg-slate-100/70 p-1">
        <button
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] ${
            mode === "login"
              ? "bg-white text-ink"
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{
            boxShadow: mode === "login" ? "var(--q-shadow-xs)" : undefined,
            transitionDuration: "var(--q-duration-normal)",
            transitionTimingFunction: "var(--q-ease)"
          }}
          onClick={() => {
            setMode("login");
            setError("");
            setMessage("");
          }}
          type="button"
        >
          Login
        </button>
        <button
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] ${
            mode === "signup"
              ? "bg-white text-ink"
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{
            boxShadow: mode === "signup" ? "var(--q-shadow-xs)" : undefined,
            transitionDuration: "var(--q-duration-normal)",
            transitionTimingFunction: "var(--q-ease)"
          }}
          onClick={() => {
            setMode("signup");
            setError("");
            setMessage("");
          }}
          type="button"
        >
          Sign up
        </button>
      </div>

      <form className="grid gap-4" onSubmit={submit}>
        {mode === "signup" ? (
          <>
            <div>
              <label className="label" htmlFor="full_name">
                Full name
              </label>
              <input className="field" id="full_name" name="full_name" required />
            </div>
            <div>
              <label className="label" htmlFor="business_name">
                Business name
              </label>
              <input className="field" id="business_name" name="business_name" required />
            </div>
          </>
        ) : null}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="field" id="email" name="email" required type="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="field" id="password" minLength={6} name="password" required type="password" />
        </div>
        {message ? (
          <div
            className="rounded-xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800"
            style={{ boxShadow: "var(--q-shadow-xs)" }}
          >
            {message}
          </div>
        ) : null}
        {error ? (
          <div
            className="rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700"
            style={{ boxShadow: "var(--q-shadow-xs)" }}
          >
            {error}
          </div>
        ) : null}
        <button
          className="btn btn-primary mt-1 w-full"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Working…
            </span>
          ) : mode === "login" ? (
            "Login"
          ) : (
            "Create account"
          )}
        </button>
      </form>

      {/* Footer note */}
      <p className="mt-5 text-center text-[11px] text-slate-400">
        {mode === "login"
          ? "Don't have an account? Switch to Sign up above."
          : "Already have an account? Switch to Login above."}
      </p>
    </div>
  );
}
