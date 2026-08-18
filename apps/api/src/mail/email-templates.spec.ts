import {
  adminSetPasswordEmailHtml,
  brandedEmailHtml,
  escapeHtml,
  passwordResetEmailHtml,
  plainTextToHtml,
  problemReportEmailHtml,
  reportExportEmailHtml,
  testEmailHtml,
  welcomeAccountEmailHtml,
} from './email-templates';

describe('email-templates', () => {
  it('escapes HTML in credentials so a password cannot break the markup', () => {
    const html = welcomeAccountEmailHtml({
      firstName: 'Alex <script>',
      username: 'alexsece',
      initialPassword: 'A&b<>"\'',
      loginUrl: 'https://ttah.example/login',
      includeBanner: false,
    });
    expect(html).toContain('Welcome, Alex &lt;script&gt;');
    expect(html).toContain('A&amp;b&lt;&gt;&quot;&#39;');
    expect(html).toContain('Sign in to TTAH');
    expect(html).toContain('https://ttah.example/login');
    expect(html).toContain('TTAH Portal');
    expect(html).toContain('Orion Innovation · TTAH');
    expect(html).not.toContain('<script>');
  });

  it('admin-set password email does not say the account was created', () => {
    const html = adminSetPasswordEmailHtml({
      firstName: 'Alex',
      username: 'alexsece',
      initialPassword: 'TempPass12',
      loginUrl: 'https://ttah.example/login',
      includeBanner: false,
    });
    expect(html).toContain('New password, Alex');
    expect(html).toContain('TempPass12');
    expect(html).toContain('Sign in to TTAH');
    expect(html).not.toContain('account was created');
    expect(html).not.toContain('Welcome,');
  });

  it('password reset uses the branded card and CTA', () => {
    const html = passwordResetEmailHtml({
      username: 'alexsece',
      resetUrl: 'https://ttah.example/reset-password?token=abc',
      expiresLabel: '1 hour',
      includeBanner: false,
    });
    expect(html).toContain('Reset your password');
    expect(html).toContain('Reset details');
    expect(html).toContain('alexsece');
    expect(html).toContain('1 hour');
    expect(html).toContain('Set a new password');
    expect(html).toContain('TTAH Portal');
  });

  it('report email uses the branded layout and can omit the CTA', () => {
    const html = reportExportEmailHtml({
      kind: 'summary',
      scopeLabel: 'Alex Seceleanu',
      rangeFrom: '2026-08-01',
      rangeTo: '2026-08-31',
      filename: 'summary-alex.xlsx',
      includeBanner: false,
    });
    expect(html).toContain('Your report is ready');
    expect(html).toContain('Report details');
    expect(html).toContain('Summary');
    expect(html).toContain('Alex Seceleanu');
    expect(html).toContain('summary-alex.xlsx');
    expect(html).toContain('TTAH Portal');
    expect(html).not.toContain('Open TTAH');
    expect(html).not.toContain('If the button does not work');
  });

  it('report email links to exports when an app URL is provided', () => {
    const html = reportExportEmailHtml({
      kind: 'pontaj',
      scopeLabel: 'HR',
      rangeFrom: '2026-08-01',
      rangeTo: '2026-08-31',
      filename: 'pontaj.xlsx',
      appUrl: 'https://ttah.example',
      includeBanner: false,
    });
    expect(html).toContain('Pontaj');
    expect(html).toContain('Open TTAH');
    expect(html).toContain('https://ttah.example/time-tracking/exports');
  });

  it('test email wraps the typed body in the branded layout', () => {
    const html = testEmailHtml({
      body: 'Hello <admin>\n\nGraph check.',
      appUrl: 'https://ttah.example',
      includeBanner: false,
    });
    expect(html).toContain('Mail is working');
    expect(html).toContain('Hello &lt;admin&gt;');
    expect(html).toContain('Graph check.');
    expect(html).toContain('TTAH Portal');
    expect(html).toContain('https://ttah.example/time-tracking/mail');
  });

  it('plainTextToHtml turns paragraphs into safe markup', () => {
    expect(plainTextToHtml('A & B\n\nNext')).toContain('A &amp; B');
    expect(plainTextToHtml('A & B\n\nNext')).toContain('Next');
  });

  it('branded layout without a CTA still has the footer', () => {
    const html = brandedEmailHtml({
      preheader: 'Hello',
      heading: 'Title',
      introHtml: '<p>Hi</p>',
      includeBanner: false,
    });
    expect(html).toContain('TTAH Portal');
    expect(html).toContain('Orion Innovation · TTAH');
    expect(html).not.toContain('If the button does not work');
  });

  it('escapeHtml encodes the usual markup characters', () => {
    expect(escapeHtml(`a&b<"'>`)).toBe('a&amp;b&lt;&quot;&#39;&gt;');
  });

  it('problem report email escapes user answers and includes context', () => {
    const html = problemReportEmailHtml({
      referenceId: 'TTAH-PR-deadbeef',
      username: 'alex<script>',
      role: 'admin',
      email: 'alex@orioninc.com',
      pageUrl: 'https://ttah.example/time-tracking/anomalies',
      userAgent: 'Mozilla/5.0',
      viewport: '1440x900',
      reportedAt: '2026-08-18T09:42:00.000Z',
      intendedAction: 'Filter by office <b>HQ</b>',
      whatHappened: 'The table stayed empty & showed "none".',
      expected: 'Rows for HQ should appear.',
      hasScreenshot: true,
      includeBanner: false,
    });
    expect(html).toContain('Problem report');
    expect(html).toContain('TTAH-PR-deadbeef');
    expect(html).toContain('alex&lt;script&gt;');
    expect(html).toContain('Filter by office &lt;b&gt;HQ&lt;/b&gt;');
    expect(html).toContain('The table stayed empty &amp; showed &quot;none&quot;.');
    expect(html).toContain('Rows for HQ should appear.');
    expect(html).toContain('https://ttah.example/time-tracking/anomalies');
    expect(html).toContain('Attached');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>HQ</b>');
  });
});
