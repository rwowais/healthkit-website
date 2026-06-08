"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInEmail,
  signUpEmail,
  sendMagicLink,
  resetPassword,
  signInOAuth,
  supabaseEnabled,
} from "@/lib/auth";
import { activeDataSource } from "@/lib/datasource";
import { Icon } from "@/components/ui/icons";

type Mode = "signin" | "signup" | "magic" | "forgot" | "sent";

function AuthInner() {
  const router = useRouter();
  const params = useSearchParams();
  // The landing "Create your free account" CTA links here with ?mode=signup
  // so the account-first funnel opens straight on the sign-up form.
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState("");

  const afterAuth = async () => {
    // Always route a signed-in user to /today and let its guard decide
    // (it re-loads synced state, and the conflict prompt lives in the
    // Shell which /onboarding doesn't render). Pull the cloud row first
    // so the guard sees the real completedOnboarding, not local default.
    await activeDataSource.load();
    router.push("/today");
  };

  const submit = async () => {
    setErr(null);
    if (mode === "signup" && password.length < 8) {
      setErr("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    let r;
    if (mode === "signin") r = await signInEmail(email, password);
    else if (mode === "signup") r = await signUpEmail(email, password);
    else if (mode === "magic") r = await sendMagicLink(email);
    else r = await resetPassword(email);
    setBusy(false);

    if (!r.ok) {
      setErr(r.error ?? "Something went wrong.");
      return;
    }
    if (r.pending) {
      setSentMsg(
        mode === "magic"
          ? `A sign-in link is on its way to ${email}. Open it on this device.`
          : mode === "forgot"
          ? `Password reset link sent to ${email}.`
          : `Confirm your email — we sent a link to ${email}.`
      );
      setMode("sent");
      return;
    }
    afterAuth();
  };

  const oauth = async (p: "google" | "apple") => {
    setErr(null);
    const r = await signInOAuth(p);
    if (!r.ok) setErr(r.error ?? "Couldn't start that sign-in.");
  };

  const headline =
    mode === "signup"
      ? "Keep your system safe"
      : mode === "forgot"
      ? "Reset your password"
      : mode === "magic"
      ? "Sign in with a link"
      : mode === "sent"
      ? "Check your email"
      : "Pick up where you left off";

  const sub =
    mode === "signup"
      ? "An account quietly preserves your protocols across every device — and lets your system follow you forward."
      : mode === "forgot"
      ? "We'll email you a secure link to set a new password."
      : mode === "magic"
      ? "No password — we'll email you a one-tap link."
      : mode === "sent"
      ? ""
      : "Sign in to continue your system on this device.";

  const input =
    "w-full rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-4 text-[16px] text-[var(--text-1)] outline-none focus:ring-1 focus:ring-[var(--readiness)] tr-fast";

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-6 py-12">
      <span
        className="ambient"
        style={{
          position: "fixed",
          background:
            "radial-gradient(80% 50% at 50% 0%, color-mix(in srgb, var(--readiness) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-[400px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            className="grid h-11 w-11 place-items-center rounded-[13px]"
            style={{
              background:
                "linear-gradient(145deg, var(--sleep), var(--readiness))",
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--bg)]" />
          </span>
          <h1 className="mt-7 text-[34px] font-bold leading-[1.1] tracking-tight text-[var(--text-1)]">
            {headline}
          </h1>
          {sub && (
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-2)]">
              {sub}
            </p>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9"
          >
            {mode === "sent" ? (
              <div className="space-y-6">
                <div
                  className="flex items-start gap-3 rounded-[var(--r-md)] p-4"
                  style={{ background: "var(--surface-2)" }}
                >
                  <Icon
                    name="check"
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--vitality)]"
                  />
                  <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
                    {sentMsg}
                  </p>
                </div>
                <button
                  onClick={() => setMode("signin")}
                  className="press text-[14px] font-semibold text-[var(--text-3)]"
                >
                  ← Back
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(mode === "signin" || mode === "signup") && (
                  <>
                    {/* Apple is visually primary — calmest, most familiar,
                        and the gesture that best fits a personal system. */}
                    <button
                      onClick={() => oauth("apple")}
                      disabled={!supabaseEnabled}
                      className="press tr-fast flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--text-1)] py-3.5 text-[15px] font-semibold text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="sparkle" size={16} />
                      Continue with Apple
                    </button>
                    <button
                      onClick={() => oauth("google")}
                      disabled={!supabaseEnabled}
                      className="press tr-fast flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--hairline-strong)] py-3.5 text-[14px] font-semibold text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="compass" size={16} />
                      Continue with Google
                    </button>
                  </>
                )}
                {(mode === "signin" || mode === "signup") && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-[var(--hairline)]" />
                    <span className="text-[11px] uppercase tracking-wider text-[var(--text-4)]">
                      or
                    </span>
                    <span className="h-px flex-1 bg-[var(--hairline)]" />
                  </div>
                )}

                <input
                  type="email"
                  inputMode="email"
                  autoFocus
                  data-testid="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className={input}
                />
                {(mode === "signin" || mode === "signup") && (
                  <input
                    type="password"
                    data-testid="auth-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    className={input}
                  />
                )}

                {err && (
                  <p className="px-1 text-[13px] text-[var(--alert)]">
                    {err}
                  </p>
                )}

                <button
                  onClick={submit}
                  disabled={busy || !email.trim()}
                  data-testid="auth-submit"
                  className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-4 text-[15px] font-semibold text-[var(--bg)] disabled:opacity-40"
                >
                  {busy
                    ? "…"
                    : mode === "signup"
                    ? "Create account"
                    : mode === "magic"
                    ? "Email me a link"
                    : mode === "forgot"
                    ? "Send reset link"
                    : "Sign in"}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[13px]">
                  {mode === "signin" && (
                    <>
                      <button
                        onClick={() => setMode("magic")}
                        className="press font-medium text-[var(--readiness)]"
                      >
                        Email me a link instead
                      </button>
                      <button
                        onClick={() => setMode("forgot")}
                        className="press font-medium text-[var(--text-3)]"
                      >
                        Forgot password?
                      </button>
                    </>
                  )}
                  {mode === "magic" && (
                    <button
                      onClick={() => setMode("signin")}
                      className="press font-medium text-[var(--text-3)]"
                    >
                      ← Use a password
                    </button>
                  )}
                  {mode === "forgot" && (
                    <button
                      onClick={() => setMode("signin")}
                      className="press font-medium text-[var(--text-3)]"
                    >
                      ← Back to sign in
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {mode !== "sent" && (
          <div className="mt-10 space-y-4 text-center">
            <p className="text-[13px] text-[var(--text-3)]">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode("signin")}
                    className="press font-semibold text-[var(--text-1)]"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New here?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="press font-semibold text-[var(--text-1)]"
                  >
                    Keep my system safe
                  </button>
                </>
              )}
            </p>
            {/* Guest bypass exists ONLY when accounts are off (local dev).
                With Supabase configured the app is account-gated, so this
                escape hatch would defeat the wall — hide it. */}
            {!supabaseEnabled && (
              <>
                <button
                  onClick={() => router.push("/onboarding")}
                  className="press text-[13px] font-medium text-[var(--text-4)]"
                >
                  Continue without an account →
                </button>
                <p className="px-2 text-[12px] leading-relaxed text-[var(--text-4)]">
                  Accounts aren&apos;t enabled in this build — you can still
                  use everything; your data is saved on this device.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}
