"use client";

/**
 * InteractionsEditor — author behavior-to-behavior interactions.
 *
 * Self-contained: loads/saves its own data via the authoring CRUD, so the
 * admin page only renders <InteractionsEditor /> (keeps the monolith small).
 *
 * Flow the operator follows:
 *   1. Add a relationship (pick two behaviors, a type, a calm nudge).
 *   2. If it makes a scientific claim, set an evidence tier + paste the
 *      source, then click "Verify source" (confirms a human checked it).
 *   3. Set status → Published, then use the Publish tab to ship it.
 *
 * Safety: assembleBundleFromCMS() holds back any Published interaction that
 * has an evidence tier but no verified source — so an unchecked claim can
 * never reach a user. The 9 built-in conflicts ship automatically and are
 * NOT listed here (they live in code); this manages additional relationships.
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { Eyebrow, useToast } from "@/components/ui";
import { buildAtomRegistry } from "@/lib/governance";
import {
  listInteractions,
  saveInteraction,
  verifyInteractionSource,
  deleteInteraction,
  type InteractionRow,
} from "@/lib/cms/authoring";

type Form = {
  id?: string;
  a_key: string;
  b_key: string;
  type: string;
  severity: string;
  nudge: string;
  evidence_tier: string; // "" = none
  source: string;
  gap_hours: string; // text input; "" = none
  version?: number;
};

const EMPTY: Form = {
  a_key: "",
  b_key: "",
  type: "conflict",
  severity: "soft",
  nudge: "",
  evidence_tier: "",
  source: "",
  gap_hours: "",
};

const surf = { background: "var(--surface-1)", border: "1px solid var(--hairline)" };

export default function InteractionsEditor() {
  const toast = useToast();
  const [rows, setRows] = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const atoms = useMemo(() => {
    const reg = buildAtomRegistry();
    return Array.from(reg.entries())
      .map(([key, v]) => ({ key, title: v.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, []);
  const titleOf = (k: string) =>
    atoms.find((a) => a.key === k)?.title ?? k;

  async function reload() {
    setLoading(true);
    setRows(await listInteractions());
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  function edit(r: InteractionRow) {
    setForm({
      id: r.id,
      a_key: r.a_key,
      b_key: r.b_key,
      type: r.type,
      severity: r.severity,
      nudge: r.nudge ?? "",
      evidence_tier: r.evidence_tier ?? "",
      source: r.source ?? "",
      gap_hours: r.gap_hours != null ? String(r.gap_hours) : "",
      version: r.version,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function save() {
    if (!form.a_key || !form.b_key) {
      toast.show("Pick both behaviors first.");
      return;
    }
    if (form.a_key === form.b_key) {
      toast.show("A behavior can't interact with itself.");
      return;
    }
    setBusy(true);
    const res = await saveInteraction({
      id: form.id,
      a_key: form.a_key,
      b_key: form.b_key,
      type: form.type,
      severity: form.severity,
      nudge: form.nudge.trim(),
      evidence_tier: form.evidence_tier || null,
      source: form.source.trim() || null,
      gap_hours: form.gap_hours.trim() ? Number(form.gap_hours) : null,
      version: form.version,
    });
    setBusy(false);
    if (!res.ok) {
      toast.show(res.reason ?? "Save failed.");
      return;
    }
    toast.show(form.id ? "Interaction updated." : "Interaction added.");
    setForm(EMPTY);
    reload();
  }

  async function verify(r: InteractionRow) {
    setBusy(true);
    const res = await verifyInteractionSource(r.id);
    setBusy(false);
    toast.show(res.ok ? "Source marked verified." : res.reason ?? "Failed.");
    if (res.ok) reload();
  }

  async function setStatus(r: InteractionRow, status: string) {
    setBusy(true);
    const res = await saveInteraction({
      id: r.id,
      a_key: r.a_key,
      b_key: r.b_key,
      type: r.type,
      severity: r.severity,
      nudge: r.nudge ?? "",
      evidence_tier: r.evidence_tier,
      source: r.source,
      gap_hours: r.gap_hours,
      direction: r.direction,
      version: r.version,
      status,
    });
    setBusy(false);
    toast.show(res.ok ? `Status → ${status}` : res.reason ?? "Failed.");
    if (res.ok) reload();
  }

  async function remove(r: InteractionRow) {
    if (
      !window.confirm(
        `Delete the ${r.type} between "${titleOf(r.a_key)}" and "${titleOf(
          r.b_key
        )}"? This can't be undone.`
      )
    )
      return;
    setBusy(true);
    const res = await deleteInteraction(r.id);
    setBusy(false);
    toast.show(res.ok ? "Deleted." : res.reason ?? "Failed.");
    if (res.ok) reload();
  }

  const claimUnverified = (r: InteractionRow) =>
    !!r.evidence_tier && !r.source_verified_at;

  return (
    <div className="space-y-4 pb-10">
      {/* Intro / flow */}
      <div className="rounded-[var(--r-xl)] p-5" style={surf}>
        <Eyebrow color="var(--sleep)">Interactions</Eyebrow>
        <p className="mt-2 text-[16px] font-bold leading-snug text-[var(--text-1)]">
          How behaviors affect each other
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-3)]">
          Author a relationship, then set it Published and (for any scientific
          claim) verify its source. A Published claim with an unverified source
          is held back automatically — it never reaches a user. Use the{" "}
          <strong>Publish</strong> tab to ship. The 9 built-in conflicts apply
          automatically and aren&rsquo;t listed here.
        </p>
      </div>

      {/* Add / edit form */}
      <div className="rounded-[var(--r-xl)] p-5" style={surf}>
        <p className="text-[13px] font-semibold text-[var(--text-1)]">
          {form.id ? "Edit interaction" : "Add an interaction"}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Behavior A">
            <KeySelect
              value={form.a_key}
              atoms={atoms}
              onChange={(v) => setForm({ ...form, a_key: v })}
            />
          </Field>
          <Field label="Behavior B">
            <KeySelect
              value={form.b_key}
              atoms={atoms}
              onChange={(v) => setForm({ ...form, b_key: v })}
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={[
                ["conflict", "Conflict (they undermine each other)"],
                ["timing", "Timing (distance from each other / sleep)"],
                ["ordering", "Ordering (sequence matters)"],
                ["synergy", "Synergy (they reinforce)"],
              ]}
            />
          </Field>
          <Field label="Severity">
            <Select
              value={form.severity}
              onChange={(v) => setForm({ ...form, severity: v })}
              options={[
                ["soft", "Soft — a calm note"],
                ["firm", "Firm — set the behavior aside (conflict only)"],
              ]}
            />
          </Field>
          <Field label="Evidence tier">
            <Select
              value={form.evidence_tier}
              onChange={(v) => setForm({ ...form, evidence_tier: v })}
              options={[
                ["", "None (no scientific claim)"],
                ["established", "Established"],
                ["emerging", "Emerging"],
                ["exploratory", "Exploratory"],
              ]}
            />
          </Field>
          <Field label="Gap (hours, optional)">
            <input
              type="number"
              value={form.gap_hours}
              onChange={(e) => setForm({ ...form, gap_hours: e.target.value })}
              placeholder="e.g. 3"
              className="w-full rounded-[var(--r-sm)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
              style={{ background: "var(--surface-2)" }}
            />
          </Field>
        </div>
        <Field label="Calm nudge (what the user sees)">
          <textarea
            value={form.nudge}
            onChange={(e) => setForm({ ...form, nudge: e.target.value })}
            rows={2}
            placeholder="e.g. Take your cold plunge before lifting or hours after — not right after."
            className="w-full rounded-[var(--r-sm)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text-1)] outline-none"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        <Field label="Source URL (required for any evidence tier)">
          <input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="https://…"
            className="w-full rounded-[var(--r-sm)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
            style={{ background: "var(--surface-2)" }}
          />
        </Field>
        {form.evidence_tier && !form.source.trim() && (
          <p className="mt-1 text-[12px]" style={{ color: "var(--alert)" }}>
            A claim needs a source — and you&rsquo;ll need to verify it before it
            ships.
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="press tr-fast rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: "var(--text-1)", color: "var(--bg)" }}
          >
            {form.id ? "Save changes" : "Add interaction"}
          </button>
          {form.id && (
            <button
              onClick={() => setForm(EMPTY)}
              className="press tr-fast rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-[var(--r-xl)] p-5" style={surf}>
        <p className="text-[13px] font-semibold text-[var(--text-1)]">
          Authored interactions {loading ? "" : `(${rows.length})`}
        </p>
        {loading ? (
          <p className="mt-3 text-[13px] text-[var(--text-3)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--text-3)]">
            None yet. Add one above — it starts as a draft and won&rsquo;t affect
            anyone until you publish.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-[var(--r-md)] p-3"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-semibold text-[var(--text-1)]">
                    {titleOf(r.a_key)}
                  </span>
                  <span className="text-[var(--text-4)]">→</span>
                  <span className="text-[13px] font-semibold text-[var(--text-1)]">
                    {titleOf(r.b_key)}
                  </span>
                  <Tag>{r.type}</Tag>
                  <Tag color={r.severity === "firm" ? "var(--alert)" : undefined}>
                    {r.severity}
                  </Tag>
                  {r.evidence_tier && <Tag>{r.evidence_tier}</Tag>}
                  <Tag
                    color={
                      r.status === "published"
                        ? "var(--vitality)"
                        : "var(--text-3)"
                    }
                  >
                    {r.status}
                  </Tag>
                </div>
                {r.nudge && (
                  <p className="mt-1.5 text-[12.5px] text-[var(--text-2)]">
                    {r.nudge}
                  </p>
                )}
                {claimUnverified(r) && (
                  <p
                    className="mt-1.5 flex items-center gap-1 text-[12px]"
                    style={{ color: "var(--alert)" }}
                  >
                    <Icon name="info" size={12} /> Source not verified — held
                    back from publishing until you verify it.
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => edit(r)}
                    className="press tr-fast text-[12px] font-medium text-[var(--text-2)] underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                  {r.evidence_tier && !r.source_verified_at && r.source && (
                    <button
                      onClick={() => verify(r)}
                      disabled={busy}
                      className="press tr-fast text-[12px] font-semibold disabled:opacity-50"
                      style={{ color: "var(--recovery)" }}
                    >
                      Verify source
                    </button>
                  )}
                  {r.source_verified_at && (
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "var(--vitality)" }}
                    >
                      ✓ source verified
                    </span>
                  )}
                  <select
                    value={r.status}
                    onChange={(e) => setStatus(r, e.target.value)}
                    disabled={busy}
                    className="ml-auto rounded-[var(--r-sm)] px-2 py-1 text-[12px] text-[var(--text-2)] outline-none"
                    style={{ background: "var(--surface-1)" }}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    onClick={() => remove(r)}
                    disabled={busy}
                    className="press tr-fast text-[12px] font-medium disabled:opacity-50"
                    style={{ color: "var(--alert)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[var(--r-sm)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
      style={{ background: "var(--surface-2)" }}
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function KeySelect({
  value,
  atoms,
  onChange,
}: {
  value: string;
  atoms: { key: string; title: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[var(--r-sm)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
      style={{ background: "var(--surface-2)" }}
    >
      <option value="">Pick a behavior…</option>
      {atoms.map((a) => (
        <option key={a.key} value={a.key}>
          {a.title}
        </option>
      ))}
    </select>
  );
}

function Tag({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: "var(--surface-1)", color: color ?? "var(--text-3)" }}
    >
      {children}
    </span>
  );
}
