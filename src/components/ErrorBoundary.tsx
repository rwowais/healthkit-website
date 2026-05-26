"use client";

import React from "react";

/**
 * Root-level ErrorBoundary. Wraps the entire app shell so any uncaught
 * render error shows a calm recovery surface instead of a white screen.
 *
 * Why this is here:
 *   The audit found there was no ErrorBoundary anywhere in src/. A
 *   single render throw — bad data shape from cloud sync, malformed
 *   localStorage, an icon name that doesn't exist — would white-screen
 *   the entire app with no path back. This component catches that
 *   class of bug, shows the user what happened in plain language, and
 *   gives them a way out: reload, or as a last resort, clear-and-
 *   start-fresh (which they can also reach from Profile if reload
 *   doesn't help).
 *
 * Logging:
 *   We log to console.error so it shows up in browser devtools and in
 *   any future analytics seam. We do NOT auto-report — that's a
 *   monetization-phase decision (Sentry / similar).
 *
 * Why a class component:
 *   React error boundaries can only be class components. This is the
 *   only class component in the codebase by necessity.
 */
interface State {
  err: Error | null;
}
interface Props {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo): void {
    // Log to console for now — wire to analytics later (Phase 0.9).
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  reset = () => this.setState({ err: null });

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  clearAndReload = () => {
    if (typeof window === "undefined") return;
    try {
      // Best-effort wipe of just our keys (leave other site data alone).
      localStorage.removeItem("protocolize-v3");
      localStorage.removeItem("protocolize-v2");
      localStorage.removeItem("protocolize-v1");
    } catch {}
    window.location.href = "/";
  };

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{
          background: "var(--bg)",
          color: "var(--text-1)",
        }}
      >
        <div className="max-w-md text-center">
          <p className="t-eyebrow">Something went wrong</p>
          <h1 className="t-title mt-3 mb-4">
            We hit an unexpected error
          </h1>
          <p className="t-body text-[var(--text-2)] mb-6 leading-relaxed">
            Your data is safe — this is a display problem, not a data
            loss. Try reloading first. If it keeps happening, you can
            clear local data and start fresh; cloud-synced accounts
            will restore on sign-in.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={this.reload}
              className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[14px] font-semibold text-[#08090B]"
            >
              Reload
            </button>
            <button
              onClick={this.clearAndReload}
              className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--surface-3)] py-3 text-[13px] font-medium text-[var(--text-2)]"
            >
              Clear local data and start fresh
            </button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.err && (
            <details className="mt-6 text-left text-[11px] text-[var(--text-4)]">
              <summary className="cursor-pointer">Technical details</summary>
              <pre className="mt-2 overflow-auto rounded-[var(--r-sm)] bg-[var(--surface-2)] p-3 text-[10px] leading-snug">
                {this.state.err.message}
                {"\n\n"}
                {this.state.err.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
