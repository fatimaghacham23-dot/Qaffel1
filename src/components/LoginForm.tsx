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
    <div className="panel mx-auto w-full max-w-md">
      <div className="mb-5 flex rounded-md bg-slate-100 p-1">
        <button
          className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${mode === "login" ? "bg-white shadow-sm" : "text-slate-600"}`}
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
          className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-white shadow-sm" : "text-slate-600"}`}
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
        {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button className="btn btn-primary w-full" disabled={loading} type="submit">
          {loading ? "Working..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>
    </div>
  );
}
