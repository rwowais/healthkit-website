/**
 * POST /api/cms/generate — server-only AI behavior drafter.
 *
 * Why a server route: the Anthropic key is owner-paid and MUST never
 * reach the browser bundle. It lives only in `process.env.ANTHROPIC_API_KEY`
 * (never NEXT_PUBLIC_*). The route is admin-gated using the caller's own
 * Supabase access token + the `cms_admins` RLS self-read — no service
 * key is used or needed.
 *
 * Governance: this route only GENERATES a draft. It writes nothing to
 * the CMS and can never publish. The output is force-clamped server-side
 * (`clampDraft`) — evidence capped at 'emerging', aiUnverified always
 * true, status always draft — before it is returned. A human then edits
 * and saves it as a draft, and separately Publishes. Nothing here can
 * change what users see.
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  OUTPUT_JSON_SCHEMA,
  clampDraft,
} from "@/lib/cms/aiSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Validate the caller is a signed-in admin, using their token only. */
async function requireAdmin(req: Request): Promise<string | null> {
  if (!SB_URL || !SB_ANON) return null;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const sb = createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !u?.user) return null;
    // RLS ("admins self-read") only returns the row if this uid is an
    // admin — so a non-admin token yields no row.
    const { data, error } = await sb
      .from("cms_admins")
      .select("user_id")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return u.user.id;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const uid = await requireAdmin(req);
  if (!uid) return json({ ok: false, reason: "Admin only." }, 403);

  let description = "";
  try {
    const body = (await req.json()) as { description?: unknown };
    description =
      typeof body.description === "string" ? body.description.trim() : "";
  } catch {
    return json({ ok: false, reason: "Bad request." }, 400);
  }
  if (!description)
    return json({ ok: false, reason: "Describe the item first." }, 400);
  if (description.length > 500)
    description = description.slice(0, 500);

  if (!process.env.ANTHROPIC_API_KEY)
    return json(
      {
        ok: false,
        reason:
          "AI drafting is not configured. Add ANTHROPIC_API_KEY in Vercel to enable it.",
      },
      501
    );

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
    // Stream + finalMessage so a slow adaptive-thinking turn can't trip
    // a proxy idle timeout. The system prompt is the stable cached
    // prefix; the volatile description goes in the user turn after it.
    const message = await client.messages
      .stream({
        model: "claude-opus-4-7",
        max_tokens: 2000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: OUTPUT_JSON_SCHEMA },
        },
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Draft one behavior for this: "${description}"`,
          },
        ],
      })
      .finalMessage();

    const textBlock = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock)
      return json(
        { ok: false, reason: "The model returned no draft. Try again." },
        502
      );

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return json(
        { ok: false, reason: "Could not parse the draft. Try again." },
        502
      );
    }

    // THE safety boundary — never trust the model's shape or claims.
    const draft = clampDraft(parsed);
    return json({ ok: true, draft });
  } catch (e) {
    // Map to a friendly reason; never leak the key, stack, or raw error.
    let reason = "AI drafting failed. Try again.";
    if (e instanceof Anthropic.RateLimitError)
      reason = "AI is busy (rate limited). Try again shortly.";
    else if (e instanceof Anthropic.AuthenticationError)
      reason = "AI key is invalid. Check ANTHROPIC_API_KEY in Vercel.";
    else if (e instanceof Anthropic.APIError)
      reason = "AI service error. Try again.";
    return json({ ok: false, reason }, 502);
  }
}
