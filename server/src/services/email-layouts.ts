/**
 * email-layouts.ts
 *
 * Five branded HTML email wrapper templates for outgoing system emails.
 * Each template receives the inner body HTML and wraps it in a full
 * <!DOCTYPE html> document with header, footer, and responsive styles.
 *
 * Templates:
 *   clean     — Minimal white, text-only header/footer
 *   branded   — Full-color header banner + colored footer
 *   dark      — Dark header/footer, light body card
 *   card      — Floating center card, no full-width header
 *   corporate — Two-tone header, structured link footer
 */

import type { EmailTemplateId } from "@paperclipai/shared";

export interface EmailLayoutOptions {
  /** Inner HTML content — the email-specific body */
  body: string;
  /** App/brand name shown in header */
  appName: string;
  /** Public URL for the app — used in logo link and footer links */
  appUrl: string;
  /** Hex color used as accent/brand color, e.g. "#5c5fff" */
  primaryColor: string;
  /** Which layout template to use */
  template: EmailTemplateId;
  /** Optional: plain-text preview shown in email clients before open */
  previewText?: string;
  /** Optional: public URL to the app icon / logo image */
  appIconUrl?: string;
  /** Optional: URL for managing notification preferences / unsubscribing */
  unsubscribeUrl?: string;
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Return the hex color lightened slightly for backgrounds. */
function lighten(hex: string, amount = 0.92): string {
  try {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  } catch {
    return "#f5f5f5";
  }
}

const BASE_RESET = `
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;background:#f4f4f7}
  a{color:inherit}
`.trim();

const DARK_MODE_LIGHT_BODY = `
@media (prefers-color-scheme: dark) {
  .dm-bg{background:#0f1117!important}
  .dm-card{background:#1e2030!important;color:#e2e8f0!important}
  .dm-h{color:#f1f5f9!important}
  .dm-muted{color:#94a3b8!important}
  .dm-footer{color:#64748b!important}
  .dm-footer a{color:#64748b!important}
}
`.trim();

// ---------------------------------------------------------------------------
// Template 1 — Clean
// Minimal white background, text header, simple gray footer.
// ---------------------------------------------------------------------------

function renderClean(o: EmailLayoutOptions): string {
  const { appName, appUrl, body, primaryColor, previewText, appIconUrl, unsubscribeUrl } = o;
  const iconHtml = appIconUrl
    ? `<img src="${esc(appIconUrl)}" alt="" width="32" height="32" style="vertical-align:middle;margin-right:8px;border-radius:4px" />`
    : "";
  const unsubscribeHtml = unsubscribeUrl
    ? ` &middot; <a href="${esc(unsubscribeUrl)}">Manage preferences</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(appName)}</title>
<style>
${BASE_RESET}
${DARK_MODE_LIGHT_BODY}
.wrap{max-width:600px;margin:0 auto;padding:24px 16px}
.header{padding:20px 0 16px;border-bottom:2px solid ${esc(primaryColor)};display:flex;align-items:center}
.header a{font-size:18px;font-weight:700;color:${esc(primaryColor)};text-decoration:none;font-family:system-ui,sans-serif}
.body{background:#ffffff;border-radius:8px;padding:28px 32px;margin:24px 0;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#333}
.body h2{margin:0 0 16px;font-size:20px;color:#111}
.body p{margin:0 0 14px}
.body a{color:${esc(primaryColor)};text-decoration:underline}
.footer{text-align:center;font-size:11px;color:#999;font-family:system-ui,sans-serif;padding:8px 0 16px}
.footer a{color:#999;text-decoration:none}
</style>
</head>
<body class="dm-bg">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${esc(previewText)}&nbsp;&#8203;</div>` : ""}
<div class="wrap">
  <div class="header">
    <a href="${esc(appUrl)}">${iconHtml}${esc(appName)}</a>
  </div>
  <div class="body dm-card dm-h">${body}</div>
  <div class="footer dm-footer">
    <a href="${esc(appUrl)}">${esc(appName)}</a> &middot; You received this because you have an account on this instance.${unsubscribeHtml}
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template 2 — Branded
// Full-color header banner with white logo text, colored CTA links, colored footer.
// ---------------------------------------------------------------------------

function renderBranded(o: EmailLayoutOptions): string {
  const { appName, appUrl, body, primaryColor, previewText, appIconUrl, unsubscribeUrl } = o;
  const bg = lighten(primaryColor, 0.94);
  const iconHtml = appIconUrl
    ? `<img src="${esc(appIconUrl)}" alt="" width="28" height="28" style="vertical-align:middle;margin-right:8px;border-radius:4px" />`
    : "";
  const unsubscribeHtml = unsubscribeUrl
    ? ` &bull; <a href="${esc(unsubscribeUrl)}" style="color:rgba(255,255,255,0.9)">Manage preferences</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(appName)}</title>
<style>
${BASE_RESET}
body{background:${bg}}
.outer{max-width:600px;margin:0 auto}
.header{background:${esc(primaryColor)};padding:22px 32px;border-radius:8px 8px 0 0}
.header a{color:#ffffff;font-size:20px;font-weight:700;text-decoration:none;font-family:system-ui,sans-serif;letter-spacing:-0.3px}
.body{background:#ffffff;padding:28px 32px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#333}
.body h2{margin:0 0 16px;font-size:20px;color:#111}
.body p{margin:0 0 14px}
.body a{color:${esc(primaryColor)};font-weight:600;text-decoration:none}
.body a:hover{text-decoration:underline}
.body .btn{display:inline-block;padding:10px 22px;background:${esc(primaryColor)};color:#fff!important;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;margin:8px 0}
.footer{background:${esc(primaryColor)};border-radius:0 0 8px 8px;padding:14px 32px;text-align:center;font-family:system-ui,sans-serif;font-size:11px;color:rgba(255,255,255,0.75)}
.footer a{color:rgba(255,255,255,0.9);text-decoration:none}
${DARK_MODE_LIGHT_BODY}
</style>
</head>
<body class="dm-bg">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${esc(previewText)}&nbsp;&#8203;</div>` : ""}
<div style="padding:32px 16px">
<div class="outer">
  <div class="header"><a href="${esc(appUrl)}">${iconHtml}${esc(appName)}</a></div>
  <div class="body dm-card dm-h">${body}</div>
  <div class="footer">
    <a href="${esc(appUrl)}">${esc(appName)}</a> &bull; You received this because you have an account on this instance.${unsubscribeHtml}
  </div>
</div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template 3 — Dark
// Dark header and footer, white body, modern high-contrast look.
// ---------------------------------------------------------------------------

function renderDark(o: EmailLayoutOptions): string {
  const { appName, appUrl, body, primaryColor, previewText, appIconUrl, unsubscribeUrl } = o;
  const iconHtml = appIconUrl
    ? `<img src="${esc(appIconUrl)}" alt="" width="28" height="28" style="vertical-align:middle;margin-right:8px;border-radius:4px" />`
    : "";
  const unsubscribeHtml = unsubscribeUrl
    ? ` &mdash; <a href="${esc(unsubscribeUrl)}" style="color:#9ca3af">Manage preferences</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(appName)}</title>
<style>
${BASE_RESET}
body{background:#0f1117}
.outer{max-width:600px;margin:0 auto}
.header{background:#1a1d27;padding:22px 32px;border-bottom:3px solid ${esc(primaryColor)};border-radius:8px 8px 0 0}
.header a{color:#ffffff;font-size:19px;font-weight:700;text-decoration:none;font-family:system-ui,sans-serif}
.header span{color:${esc(primaryColor)}}
.body{background:#ffffff;padding:28px 32px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#222}
.body h2{margin:0 0 16px;font-size:20px;color:#000}
.body p{margin:0 0 14px}
.body a{color:${esc(primaryColor)};font-weight:600;text-decoration:none}
.body .btn{display:inline-block;padding:10px 22px;background:#111;color:#fff!important;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid ${esc(primaryColor)};margin:8px 0}
.footer{background:#1a1d27;border-radius:0 0 8px 8px;padding:14px 32px;text-align:center;font-family:system-ui,sans-serif;font-size:11px;color:#6b7280}
.footer a{color:#9ca3af;text-decoration:none}
${DARK_MODE_LIGHT_BODY}
</style>
</head>
<body>
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${esc(previewText)}&nbsp;&#8203;</div>` : ""}
<div style="padding:32px 16px">
<div class="outer">
  <div class="header"><a href="${esc(appUrl)}">${iconHtml}${esc(appName)}<span>.</span></a></div>
  <div class="body dm-card dm-h">${body}</div>
  <div class="footer">
    <a href="${esc(appUrl)}">${esc(appName)}</a> &mdash; You received this because you have an account on this instance.${unsubscribeHtml}
  </div>
</div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template 4 — Card
// Floating centered card on a light gray background. No full-width header.
// App name sits at the top of the card, footer is below the card.
// ---------------------------------------------------------------------------

function renderCard(o: EmailLayoutOptions): string {
  const { appName, appUrl, body, primaryColor, previewText, appIconUrl, unsubscribeUrl } = o;
  const bg = lighten(primaryColor, 0.96);
  const iconHtml = appIconUrl
    ? `<img src="${esc(appIconUrl)}" alt="" width="24" height="24" style="vertical-align:middle;margin-right:6px;border-radius:4px" />`
    : "";
  const unsubscribeHtml = unsubscribeUrl
    ? ` &middot; <a href="${esc(unsubscribeUrl)}">Manage preferences</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(appName)}</title>
<style>
${BASE_RESET}
body{background:${bg}}
.wrap{max-width:520px;margin:0 auto;padding:40px 16px}
.card{background:#ffffff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.08);overflow:hidden}
.card-header{padding:24px 32px 0;display:block}
.card-logo{font-size:14px;font-weight:700;color:${esc(primaryColor)};text-decoration:none;font-family:system-ui,sans-serif;letter-spacing:0.5px;text-transform:uppercase}
.divider{height:1px;background:#f0f0f0;margin:20px 32px}
.card-body{padding:0 32px 32px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#333}
.card-body h2{margin:0 0 14px;font-size:19px;color:#111}
.card-body p{margin:0 0 14px}
.card-body a{color:${esc(primaryColor)};font-weight:500;text-decoration:none}
.card-body .btn{display:inline-block;padding:10px 22px;background:${esc(primaryColor)};color:#fff!important;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;margin:8px 0}
.footer{text-align:center;font-size:11px;color:#aaa;font-family:system-ui,sans-serif;padding:16px 0}
.footer a{color:#aaa;text-decoration:none}
${DARK_MODE_LIGHT_BODY}
@media (prefers-color-scheme: dark) {
  .card{background:#1e2030!important}
  .divider{background:#2d3148!important}
}
</style>
</head>
<body class="dm-bg">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${esc(previewText)}&nbsp;&#8203;</div>` : ""}
<div class="wrap">
  <div class="card">
    <div class="card-header"><a class="card-logo" href="${esc(appUrl)}">${iconHtml}${esc(appName)}</a></div>
    <div class="divider"></div>
    <div class="card-body dm-h">${body}</div>
  </div>
  <div class="footer dm-footer">
    <a href="${esc(appUrl)}">${esc(appName)}</a> &middot; Sent by your instance administrator.${unsubscribeHtml}
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template 5 — Corporate
// Two-tone banner header (dark + accent stripe), structured two-column footer.
// ---------------------------------------------------------------------------

function renderCorporate(o: EmailLayoutOptions): string {
  const { appName, appUrl, body, primaryColor, previewText, appIconUrl, unsubscribeUrl } = o;
  const iconHtml = appIconUrl
    ? `<img src="${esc(appIconUrl)}" alt="" width="28" height="28" style="vertical-align:middle;margin-right:8px;border-radius:4px" />`
    : "";
  const prefsUrl = unsubscribeUrl || `${appUrl}/profile`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(appName)}</title>
<style>
${BASE_RESET}
body{background:#eef0f3}
.outer{max-width:600px;margin:0 auto}
.header-bar{background:#1e2433;padding:18px 32px 0}
.header-bar a{color:#ffffff;font-size:18px;font-weight:700;font-family:system-ui,sans-serif;text-decoration:none}
.accent-bar{height:4px;background:${esc(primaryColor)}}
.body{background:#ffffff;padding:28px 32px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#333}
.body h2{margin:0 0 16px;font-size:20px;color:#1e2433}
.body p{margin:0 0 14px}
.body a{color:${esc(primaryColor)};text-decoration:none;font-weight:500}
.body .btn{display:inline-block;padding:10px 22px;background:${esc(primaryColor)};color:#fff!important;border-radius:4px;font-size:14px;font-weight:600;text-decoration:none;margin:8px 0}
.footer{background:#1e2433;padding:20px 32px;border-radius:0 0 8px 8px}
.footer-cols{display:table;width:100%;border-collapse:collapse}
.footer-left{display:table-cell;vertical-align:middle}
.footer-right{display:table-cell;vertical-align:middle;text-align:right}
.footer .name{color:#ffffff;font-size:14px;font-weight:700;font-family:system-ui,sans-serif;text-decoration:none}
.footer .links{margin-top:4px}
.footer .links a{color:#9ca3af;font-size:11px;font-family:system-ui,sans-serif;text-decoration:none;margin-left:10px}
.footer .note{color:#6b7280;font-size:11px;font-family:system-ui,sans-serif;margin-top:4px}
${DARK_MODE_LIGHT_BODY}
@media (prefers-color-scheme: dark) {
  body{background:#0f1117!important}
}
</style>
</head>
<body>
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${esc(previewText)}&nbsp;&#8203;</div>` : ""}
<div style="padding:32px 16px">
<div class="outer">
  <div class="header-bar">
    <a href="${esc(appUrl)}">${iconHtml}${esc(appName)}</a>
    <div style="height:18px"></div>
  </div>
  <div class="accent-bar"></div>
  <div class="body dm-card dm-h">${body}</div>
  <div class="footer">
    <div class="footer-cols">
      <div class="footer-left">
        <a class="name" href="${esc(appUrl)}">${esc(appName)}</a>
        <div class="note">Automated notification — do not reply.</div>
      </div>
      <div class="footer-right">
        <div class="links">
          <a href="${esc(appUrl)}">Dashboard</a>
          <a href="${esc(prefsUrl)}">Preferences</a>
        </div>
      </div>
    </div>
  </div>
</div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Wrap an inner HTML body string with the chosen email layout template.
 * Falls back to "clean" for any unknown template id.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  switch (options.template) {
    case "branded":   return renderBranded(options);
    case "dark":      return renderDark(options);
    case "card":      return renderCard(options);
    case "corporate": return renderCorporate(options);
    case "clean":
    default:          return renderClean(options);
  }
}
