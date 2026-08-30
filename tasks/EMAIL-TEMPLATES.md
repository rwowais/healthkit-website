# Auth email templates — Diurna Health

Paste into **Supabase → Authentication → Emails → Templates**. Each of the four
below is complete — copy the Subject into the subject field and the whole HTML
block into the message body. No assembly needed.

**Only edit these four.** Skip *Invite user* (no invite flow) and
*Reauthentication* (no MFA) — the app never triggers them.

`{{ .ConfirmationURL }}` is Supabase's variable for the action link; leave it
exactly as written.

### Why the HTML looks dated

Email clients are not browsers. Gmail and Outlook strip `<style>` blocks, so
every style is inline; layout is table-based because it is the only thing that
renders identically everywhere. No CSS variables, no flexbox, no web fonts, no
background images. A plain URL sits under every button because some clients do
not render buttons at all, and a user who cannot click otherwise has no way in.
The light background is deliberate — email dark-mode handling is inconsistent
enough that a fixed light card is the predictable choice.

---

## 1. Confirm sign up

**Subject**

```
Confirm your email — Diurna Health
```

**Message body**

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F6F7F9;margin:0;padding:32px 0;">
  <tr><td align="center">
    <span style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;">Confirm your email to finish setting up Diurna Health.</span>
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Diurna Health</p>
        <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">Confirm your email</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">You&rsquo;re one tap from your system. Confirm this address and we&rsquo;ll pick up where you left off.</p>
      </td></tr>
      <tr><td style="padding:26px 40px 0 40px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="background:#111827;border-radius:999px;">
            <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Confirm email address</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 40px 36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
          Button not working? Paste this into your browser:<br>
          <span style="color:#374151;word-break:break-all;">{{{{ .ConfirmationURL }}}}</span>
        </p>
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">If you didn&rsquo;t create a Diurna Health account, you can ignore this email &mdash; nothing will happen.</p>
        <p style="margin:22px 0 0 0;padding-top:18px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#9CA3AF;">
          Diurna Health &middot; operated by RO Group LLC<br>
          <a href="https://diurnahealth.com" style="color:#9CA3AF;text-decoration:underline;">diurnahealth.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 2. Magic link or OTP

**Subject**

```
Your sign-in link — Diurna Health
```

**Message body**

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F6F7F9;margin:0;padding:32px 0;">
  <tr><td align="center">
    <span style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;">Your one-time sign-in link for Diurna Health.</span>
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Diurna Health</p>
        <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">Sign in to Diurna Health</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">Tap below to sign in. No password needed.</p>
      </td></tr>
      <tr><td style="padding:26px 40px 0 40px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="background:#111827;border-radius:999px;">
            <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Sign in</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 40px 36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
          Button not working? Paste this into your browser:<br>
          <span style="color:#374151;word-break:break-all;">{{{{ .ConfirmationURL }}}}</span>
        </p>
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">This link works once and expires in one hour. If you didn&rsquo;t request it, ignore this email &mdash; your account is safe.</p>
        <p style="margin:22px 0 0 0;padding-top:18px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#9CA3AF;">
          Diurna Health &middot; operated by RO Group LLC<br>
          <a href="https://diurnahealth.com" style="color:#9CA3AF;text-decoration:underline;">diurnahealth.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 3. Reset password

**Subject**

```
Reset your password — Diurna Health
```

**Message body**

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F6F7F9;margin:0;padding:32px 0;">
  <tr><td align="center">
    <span style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;">Choose a new password for your Diurna Health account.</span>
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Diurna Health</p>
        <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">Reset your password</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">Choose a new password for your Diurna Health account.</p>
      </td></tr>
      <tr><td style="padding:26px 40px 0 40px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="background:#111827;border-radius:999px;">
            <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Choose a new password</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 40px 36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
          Button not working? Paste this into your browser:<br>
          <span style="color:#374151;word-break:break-all;">{{{{ .ConfirmationURL }}}}</span>
        </p>
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">This link expires in one hour. If you didn&rsquo;t ask to reset your password, ignore this email &mdash; your current password still works.</p>
        <p style="margin:22px 0 0 0;padding-top:18px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#9CA3AF;">
          Diurna Health &middot; operated by RO Group LLC<br>
          <a href="https://diurnahealth.com" style="color:#9CA3AF;text-decoration:underline;">diurnahealth.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 4. Change email address

**Subject**

```
Confirm your new email — Diurna Health
```

**Message body**

```html
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F6F7F9;margin:0;padding:32px 0;">
  <tr><td align="center">
    <span style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;">Confirm your new email address for Diurna Health.</span>
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;">
      <tr><td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Diurna Health</p>
        <h1 style="margin:14px 0 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">Confirm your new email</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">Confirm this address to use it for signing in to Diurna Health.</p>
      </td></tr>
      <tr><td style="padding:26px 40px 0 40px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="background:#111827;border-radius:999px;">
            <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Confirm new email</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 40px 36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
          Button not working? Paste this into your browser:<br>
          <span style="color:#374151;word-break:break-all;">{{{{ .ConfirmationURL }}}}</span>
        </p>
        <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">If you didn&rsquo;t request this change, ignore this email and contact us at hello@diurnahealth.com.</p>
        <p style="margin:22px 0 0 0;padding-top:18px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#9CA3AF;">
          Diurna Health &middot; operated by RO Group LLC<br>
          <a href="https://diurnahealth.com" style="color:#9CA3AF;text-decoration:underline;">diurnahealth.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## After pasting all four

1. **Send yourself one of each** — signup, magic link, password reset.
2. Check the **From** line reads `Diurna Health <hello@diurnahealth.com>`.
3. Open one **on a phone** — that is where most people will read them.
4. Confirm the link lands on `diurnahealth.com`, not the vercel.app host.

## Security notifications (same screen, lower down)

Turn ON **Password changed** and **Email address changed** — they are the
account-takeover tripwires, and the email-changed notice goes to the OLD
address, which is the user's last chance to catch a hijack. Leave Phone
number, Sign-in method linked/removed and the MFA notices off; the app has no
phone auth, no MFA, and OAuth is built but disabled, so they would never fire.
