"use client";

/**
 * Root error boundary. Next renders this (replacing the root layout)
 * when an uncaught error escapes rendering. We report it to Sentry —
 * a no-op when Sentry isn't configured (no DSN), so this is safe
 * whether or not error monitoring is turned on — and show a calm,
 * on-brand fallback with a retry, reassuring the user their data is
 * safe locally.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          background: "#08090B",
          color: "#F4F5F7",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#9aa0a6",
              marginTop: 10,
            }}
          >
            A rare error interrupted the app. Your data is saved on this
            device — nothing is lost.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 18,
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background: "#6FA8F5",
              color: "#08090B",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
