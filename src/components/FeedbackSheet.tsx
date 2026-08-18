"use client";

/**
 * FeedbackSheet — Profile → "Request a feature / report a bug".
 *
 * Owner request 2026-08-17, modeled on Built With Science's version but
 * simpler: they ask for an email because their form serves signed-out web
 * visitors; ours only renders for signed-in users, so the account IS the
 * reply channel and asking again would be noise.
 */
import { useState } from "react";
import { Sheet, Button, Segmented, useToast } from "@/components/ui";
import {
  submitFeedback,
  FEEDBACK_TITLE_MAX,
  FEEDBACK_BODY_MAX,
  type FeedbackKind,
} from "@/lib/feedback";

const inputCls =
  "w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none";

export default function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<FeedbackKind>("feature");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const close = () => {
    onClose();
    // Keep drafts on accidental dismiss; clear only after a successful send.
  };

  return (
    <Sheet open={open} onClose={close} title="Request a feature">
      <p className="t-caption mb-4 leading-relaxed">
        Tell us what would make Protocolize work better for you. Every note
        goes straight to the person building the app.
      </p>
      <Segmented
        value={kind}
        onChange={(v) => setKind(v as FeedbackKind)}
        options={[
          { value: "feature", label: "Feature idea" },
          { value: "bug", label: "Something's broken" },
        ]}
      />
      <input
        value={title}
        maxLength={FEEDBACK_TITLE_MAX}
        placeholder={
          kind === "feature" ? "e.g. Zone 2 and HIIT tracking" : "What broke?"
        }
        aria-label="Short title"
        onChange={(e) => setTitle(e.target.value)}
        className={`mt-4 ${inputCls}`}
      />
      <textarea
        value={body}
        maxLength={FEEDBACK_BODY_MAX}
        rows={4}
        placeholder={
          kind === "feature"
            ? "How would it work? Why does it matter to you?"
            : "What did you do, and what happened instead?"
        }
        aria-label="Details"
        onChange={(e) => setBody(e.target.value)}
        className={`mt-2.5 resize-none ${inputCls}`}
      />
      <div className="mt-5">
        <Button
          full
          disabled={sending || !title.trim()}
          onClick={async () => {
            setSending(true);
            const r = await submitFeedback({ kind, title, body });
            setSending(false);
            if (!r.ok) {
              toast.show(r.reason ?? "Couldn't send — try again.");
              return;
            }
            toast.show(
              kind === "feature" ? "Idea sent — thank you" : "Report sent — thank you"
            );
            setTitle("");
            setBody("");
            onClose();
          }}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </Sheet>
  );
}
