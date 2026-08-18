import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EMAIL_BANNER_CID = 'ttah-banner';
export const EMAIL_BANNER_NAME = 'oi-banner.jpg';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function loadEmailBanner(): Buffer | null {
  const candidates = [
    join(__dirname, 'assets', EMAIL_BANNER_NAME),
    join(__dirname, '..', 'src', 'mail', 'assets', EMAIL_BANNER_NAME),
    join(process.cwd(), 'src', 'mail', 'assets', EMAIL_BANNER_NAME),
    join(process.cwd(), 'apps', 'api', 'src', 'mail', 'assets', EMAIL_BANNER_NAME),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path);
  }
  return null;
}

interface BrandedEmailInput {
  preheader: string;
  heading: string;
  introHtml: string;
  extraHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnoteHtml?: string;
  includeBanner: boolean;
}

function ctaBlock(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `
          <tr>
            <td align="center" style="padding:20px 36px 8px 36px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="12%" stroke="f" fillcolor="#6a2c91">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:16px;font-weight:bold;">${safeLabel}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${safeUrl}" style="display:inline-block;background-color:#6a2c91;color:#ffffff;font-family:Segoe UI,Calibri,Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">${safeLabel}</a>
              <!--<![endif]-->
            </td>
          </tr>
          <tr>
            <td style="padding:16px 36px 8px 36px;font-family:Segoe UI,Calibri,Arial,sans-serif;">
              <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy this address into your browser:</p>
              <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:#00a3e0;text-decoration:underline;">${safeUrl}</a></p>
            </td>
          </tr>`;
}

export function brandedEmailHtml(input: BrandedEmailInput): string {
  const heading = escapeHtml(input.heading);
  const preheader = escapeHtml(input.preheader);
  const ctaUrl = input.ctaUrl?.trim() ?? '';
  const ctaLabel = input.ctaLabel?.trim() ?? '';
  const hasCta = Boolean(ctaUrl && ctaLabel);
  const banner = input.includeBanner
    ? `<img src="cid:${EMAIL_BANNER_CID}" width="600" alt="Orion Innovation" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(90deg,#00a3e0 0%,#6a2c91 52%,#ec1e79 100%);background-color:#6a2c91;">
         <tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
       </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">${banner}</td>
          </tr>
          <tr>
            <td style="padding:28px 36px 8px 36px;font-family:Segoe UI,Calibri,Arial,sans-serif;">
              <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6a2c91;font-weight:700;">TTAH Portal</p>
              <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:#0f172a;font-weight:700;">${heading}</h1>
              ${input.introHtml}
            </td>
          </tr>
          ${input.extraHtml ? `<tr><td style="padding:8px 36px 8px 36px;font-family:Segoe UI,Calibri,Arial,sans-serif;">${input.extraHtml}</td></tr>` : ''}
          ${hasCta ? ctaBlock(ctaLabel, ctaUrl) : ''}
          ${
            input.footnoteHtml
              ? `<tr><td style="padding:16px 36px 28px 36px;font-family:Segoe UI,Calibri,Arial,sans-serif;">${input.footnoteHtml}</td></tr>`
              : ''
          }
          <tr>
            <td style="padding:16px 36px 24px 36px;border-top:1px solid #e2e8f0;font-family:Segoe UI,Calibri,Arial,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">Envision what's next. Build what matters.<br />Orion Innovation · TTAH</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function detailsCardHtml(
  title: string,
  rows: { label: string; value: string; mono?: boolean }[],
): string {
  const body = rows
    .map((row) => {
      const font = row.mono
        ? 'Consolas,Courier New,monospace'
        : 'Segoe UI,Calibri,Arial,sans-serif';
      return `<tr>
              <td style="padding:6px 0;font-size:14px;color:#64748b;width:140px;vertical-align:top;">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;font-size:15px;color:#0f172a;font-family:${font};font-weight:700;letter-spacing:0.02em;word-break:break-word;">${escapeHtml(row.value)}</td>
            </tr>`;
    })
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:700;">${escapeHtml(title)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td>
      </tr>
    </table>`;
}

function signInDetailsHtml(username: string, password: string): string {
  return detailsCardHtml('Sign-in details', [
    { label: 'Username', value: username, mono: true },
    { label: 'Initial password', value: password },
  ]);
}

export function plainTextToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const source = blocks.length > 0 ? blocks : [text.trim()];
  return source
    .map(
      (block) =>
        `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.55;color:#334155;">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');
}

function reportKindLabel(kind: string): string {
  if (kind === 'summary') return 'Summary';
  if (kind === 'pontaj') return 'Pontaj';
  if (kind === 'raw') return 'Raw events';
  return kind;
}

export function welcomeAccountEmailHtml(input: {
  firstName: string;
  username: string;
  initialPassword: string;
  loginUrl: string;
  includeBanner: boolean;
}): string {
  const name = input.firstName.trim() || input.username;
  return brandedEmailHtml({
    preheader: `Your TTAH account is ready. Sign in and choose your own password.`,
    heading: `Welcome, ${name}`,
    introHtml: `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.55;color:#334155;">An account was created for you on the TTAH Portal. Use the details below to sign in. After the first login you will be asked to set a new password of your own.</p>`,
    extraHtml: signInDetailsHtml(input.username, input.initialPassword),
    ctaLabel: 'Sign in to TTAH',
    ctaUrl: input.loginUrl,
    footnoteHtml: `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">Keep this password private. If you did not expect this email, contact your TTAH administrator.</p>`,
    includeBanner: input.includeBanner,
  });
}

export function adminSetPasswordEmailHtml(input: {
  firstName: string;
  username: string;
  initialPassword: string;
  loginUrl: string;
  includeBanner: boolean;
}): string {
  const name = input.firstName.trim() || input.username;
  return brandedEmailHtml({
    preheader: `An administrator set a new TTAH password for you. Sign in and choose your own.`,
    heading: `New password, ${name}`,
    introHtml: `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.55;color:#334155;">An administrator set a new initial password for your TTAH account. Use the details below to sign in. After login you will be asked to choose a password of your own.</p>`,
    extraHtml: signInDetailsHtml(input.username, input.initialPassword),
    ctaLabel: 'Sign in to TTAH',
    ctaUrl: input.loginUrl,
    footnoteHtml: `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">Keep this password private. If you did not expect this email, contact your TTAH administrator.</p>`,
    includeBanner: input.includeBanner,
  });
}

export function passwordResetEmailHtml(input: {
  username: string;
  resetUrl: string;
  expiresLabel: string;
  includeBanner: boolean;
}): string {
  return brandedEmailHtml({
    preheader: `Reset the password for your TTAH account (${input.username}). This link expires in ${input.expiresLabel}.`,
    heading: 'Reset your password',
    introHtml: `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.55;color:#334155;">We received a request to reset the password for your TTAH account. This link expires in <strong style="color:#0f172a;">${escapeHtml(input.expiresLabel)}</strong> and can be used only once.</p>`,
    extraHtml: detailsCardHtml('Reset details', [
      { label: 'Account', value: input.username, mono: true },
      { label: 'Expires in', value: input.expiresLabel },
    ]),
    ctaLabel: 'Set a new password',
    ctaUrl: input.resetUrl,
    footnoteHtml: `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">If you did not ask for this, you can ignore this email. Your password will stay the same.</p>`,
    includeBanner: input.includeBanner,
  });
}

export function reportExportEmailHtml(input: {
  kind: string;
  scopeLabel: string;
  rangeFrom: string;
  rangeTo: string;
  filename: string;
  appUrl?: string;
  includeBanner: boolean;
}): string {
  const kind = reportKindLabel(input.kind);
  const appUrl = input.appUrl?.trim() ?? '';
  return brandedEmailHtml({
    preheader: `${kind} report for ${input.scopeLabel}, ${input.rangeFrom} – ${input.rangeTo}.`,
    heading: 'Your report is ready',
    introHtml: `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.55;color:#334155;">The <strong style="color:#0f172a;">${escapeHtml(kind)}</strong> export for <strong style="color:#0f172a;">${escapeHtml(input.scopeLabel)}</strong> is attached to this email.</p>`,
    extraHtml: detailsCardHtml('Report details', [
      { label: 'Report', value: kind },
      { label: 'For', value: input.scopeLabel },
      { label: 'Period', value: `${input.rangeFrom} – ${input.rangeTo}` },
      { label: 'File', value: input.filename, mono: true },
    ]),
    ctaLabel: appUrl ? 'Open TTAH' : undefined,
    ctaUrl: appUrl ? `${appUrl}/time-tracking/exports` : undefined,
    footnoteHtml: `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">Generated from the TTAH Portal. Open the attachment to review the data.</p>`,
    includeBanner: input.includeBanner,
  });
}

export function testEmailHtml(input: {
  body: string;
  appUrl?: string;
  includeBanner: boolean;
}): string {
  const appUrl = input.appUrl?.trim() ?? '';
  const preview = input.body.replace(/\s+/g, ' ').trim().slice(0, 120);
  return brandedEmailHtml({
    preheader: preview || 'Test message from the TTAH Portal.',
    heading: 'Mail is working',
    introHtml: plainTextToHtml(input.body),
    ctaLabel: appUrl ? 'Open TTAH' : undefined,
    ctaUrl: appUrl ? `${appUrl}/time-tracking/mail` : undefined,
    footnoteHtml: `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">This is a test message from TTAH Mail settings. If you received it, Graph sending is configured correctly.</p>`,
    includeBanner: input.includeBanner,
  });
}

function answerBlock(title: string, text: string): string {
  return `<div style="margin:0 0 18px 0;">
    <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6a2c91;font-weight:700;">${escapeHtml(title)}</p>
    ${plainTextToHtml(text)}
  </div>`;
}

export function problemReportEmailHtml(input: {
  referenceId: string;
  username: string;
  role: string;
  email: string;
  pageUrl: string;
  userAgent: string;
  viewport: string;
  reportedAt: string;
  intendedAction: string;
  whatHappened: string;
  expected: string;
  hasScreenshot: boolean;
  appUrl?: string;
  includeBanner: boolean;
}): string {
  const pageUrl = input.pageUrl.trim();
  const ctaUrl = pageUrl || input.appUrl?.trim() || '';
  const extraHtml = `${detailsCardHtml('Report context', [
    { label: 'Reference', value: input.referenceId, mono: true },
    { label: 'User', value: input.username, mono: true },
    { label: 'Role', value: input.role },
    { label: 'Email', value: input.email || '—' },
    { label: 'Page', value: pageUrl || '—' },
    { label: 'When', value: input.reportedAt, mono: true },
    { label: 'Viewport', value: input.viewport || '—' },
    { label: 'Browser', value: input.userAgent || '—' },
    { label: 'Screenshot', value: input.hasScreenshot ? 'Attached' : 'Not captured' },
  ])}
    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
    ${answerBlock('What they wanted to do', input.intendedAction)}
    ${answerBlock('What happened', input.whatHappened)}
    ${answerBlock('What should have happened', input.expected)}`;

  return brandedEmailHtml({
    preheader: `${input.referenceId} from ${input.username}: ${input.whatHappened.replace(/\s+/g, ' ').trim().slice(0, 80)}`,
    heading: 'Problem report',
    introHtml: `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.55;color:#334155;"><strong style="color:#0f172a;">${escapeHtml(input.username)}</strong> sent a problem report from the TTAH Portal. Reference <strong style="color:#0f172a;">${escapeHtml(input.referenceId)}</strong>.</p>`,
    extraHtml,
    ctaLabel: ctaUrl ? 'Open this page' : undefined,
    ctaUrl: ctaUrl || undefined,
    footnoteHtml: `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">The screenshot (if attached) shows what was on screen before they filled in this form. It may include employee data that was visible on the page.</p>`,
    includeBanner: input.includeBanner,
  });
}
