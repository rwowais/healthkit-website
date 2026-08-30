# Auth email templates — Diurna Health

Paste these into **Supabase → Authentication → Email Templates**. Each section
gives the Subject and the HTML body.

Only three templates are actually reachable from the app (`src/lib/auth.ts`):
**Confirm signup**, **Magic Link**, and **Reset Password**. "Change Email" is
included because Supabase sends it if a user ever changes their address.

### Design constraints these follow (email HTML is not web HTML)

- **Inline styles only** — Gmail and Outlook strip `<style>` blocks.
- **Table-based layout** — the only thing every client renders the same.
- **No CSS variables, no flexbox, no `@media` reliance.**
- **600px max width**, system font stack, no web fonts, no background images.
- **A visible plain URL under every button** — some clients don't render
  buttons, and a user who can't click has no other way in.
- **Light background committed to on purpose.** Email dark-mode handling is
  inconsistent across clients; a light card renders predictably everywhere.

### Voice

Calm and plain, matching the app. No exclamation marks, no "Welcome aboard!",
no marketing. These are functional messages sent to someone mid-task — the
job is to be unmistakably from us, and to get out of the way.

Every template states **what to do if you didn't request it**, which is the
line that stops a legitimate email reading like phishing.

---

## 1. Confirm signup

**Subject:** `Confirm your email — Diurna Health`

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F6F7F9;margin:0;padding:32px 0;">
  <tr><td align="center">
    <span style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;">Confirm your email to finish setting up Diurna Health.</span>
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Diurna Health</p>
        <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">Confirm your email</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">
          You're one tap from your system. Confirm this address and we'll pick up where you left off.
        </p>
      </td></tr>
      <tr><td style="padding:26px 40px 0 40px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="background:#111827;border-radius:999px;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Confirm email address</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 40px 36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
          Button not working? Paste this into your browser:<br>
          <span style="color:#374151;word-break:break-all;">{{ .ConfirmationURL }}</span>
        </p>
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">
          If you didn't create a Diurna Health account, you can ignore this email — nothing will happen.
        </p>
        <p style="margin:22px 0 0 0;padding-top:18px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#9CA3AF;">
          Diurna Health · operated by RO Group LLC<br>
          <a href="https://diurnahealth.com" style="color:#9CA3AF;text-decoration:underline;">diurnahealth.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 2. Magic Link

**Subject:** `Your sign-in link — Diurna Health`

Same shell as above with these three swaps:

- Heading → `Sign in to Diurna Health`
- Intro → `Tap below to sign in. No password needed.`
- Button label → `Sign in`
- Expiry/safety line → `This link works once and expires in one hour. If you didn't request it, ignore this email — your account is safe.`

---

## 3. Reset Password

**Subject:** `Reset your password — Diurna Health`

Same shell with:

- Heading → `Reset your password`
- Intro → `Choose a new password for your Diurna Health account.`
- Button label → `Choose a new password`
- Safety line → `This link expires in one hour. If you didn't ask to reset your password, ignore this email — your current password still works.`

## 4. Change Email Address

**Subject:** `Confirm your new email — Diurna Health`

Same shell with:

- Heading → `Confirm your new email`
- Intro → `Confirm this address to use it for signing in to Diurna Health.`
- Button label → `Confirm new email`
- Safety line → `If you didn't request this change, ignore this email and contact us at hello@diurnahealth.com.`

---

## After pasting

1. **Send yourself one of each** — signup, magic link, password reset.
2. Check the **From** line reads `Diurna Health <hello@diurnahealth.com>`, not
   Supabase.
3. Check on a **phone**, where most people will open them.
4. Confirm the link lands on `diurnahealth.com`, not the vercel.app host
   (Supabase → Authentication → URL Configuration governs this).
