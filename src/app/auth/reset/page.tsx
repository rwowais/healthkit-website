"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { updatePassword } from "@/lib/auth";
import { Icon } from "@/components/ui/icons";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 8) {
      setErr("Use at least 8 characters.");
      return;
    }
    setErr(null);
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (!r.ok) {
      setErr(
        r.error ??
          "This reset link may have expired — request a new one from sign in."
      );
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/today"), 1200);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[400px]"
      >
        <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-1)]">
          Set a new password
        </h1>
        {done ? (
          <div
            className="mt-7 flex items-start gap-3 rounded-[var(--r-md)] p-4"
            style={{ background: "var(--surface-2)" }}
          >
            <Icon
              name="check"
              size={16}
              className="mt-0.5 shrink-0 text-[var(--vitality)]"
            />
            <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
              Password updated. Taking you in…
            </p>
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="New password"
              className="w-full rounded-[var(--r-md)] bg-[var(--surface-2)] px-4 py-4 text-[16px] text-[var(--text-1)] outline-none focus:ring-1 focus:ring-[var(--readiness)] tr-fast"
            />
            {err && (
              <p className="px-1 text-[13px] text-[var(--alert)]">{err}</p>
            )}
            <button
              onClick={submit}
              disabled={busy || !password}
              className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-4 text-[15px] font-semibold text-[#08090B] disabled:opacity-40"
            >
              {busy ? "…" : "Update password"}
            </button>
            <button
              onClick={() => router.push("/auth")}
              className="press pt-1.5 text-[13px] font-medium text-[var(--text-3)]"
            >
              ← Back to sign in
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
