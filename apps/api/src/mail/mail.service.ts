import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  SETTING_KEYS,
  mailConfigSchema,
  parseMailRecipients,
  type MailConfigInput,
  type MailConfigView,
  type MailProblemReportPolicy,
  type MailReportPolicy,
  type ProblemReportResult,
  type SendTestMailInput,
  type SessionUser,
} from '@ttah/shared';
import { AuditService } from '../audit/audit.service';
import type { MailGraphEnvConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_BANNER_CID,
  EMAIL_BANNER_NAME,
  adminSetPasswordEmailHtml,
  loadEmailBanner,
  passwordResetEmailHtml,
  problemReportEmailHtml,
  reportExportEmailHtml,
  testEmailHtml,
  welcomeAccountEmailHtml,
} from './email-templates';

interface StoredMailConfig {
  authority?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  senderMailbox?: string;
  fromAddress?: string;
  fromName?: string;
  reportRecipient?: string;
  sendReportByDefault?: boolean;
  problemReportRecipient?: string;
}

interface ResolvedMailConfig {
  authority: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  senderMailbox: string;
  fromAddress: string;
  fromName: string;
  reportRecipient: string;
  sendReportByDefault: boolean;
  problemReportRecipient: string;
}

interface GraphEmailAddress {
  address: string;
  name?: string;
}

interface GraphAttachment {
  '@odata.type': '#microsoft.graph.fileAttachment';
  name: string;
  contentType: string;
  contentBytes: string;
  contentId?: string;
  isInline?: boolean;
}

interface GraphMailRequest {
  message: {
    subject: string;
    from: { emailAddress: GraphEmailAddress };
    body: { contentType: 'Text' | 'HTML'; content: string };
    toRecipients: { emailAddress: { address: string } }[];
    ccRecipients?: { emailAddress: { address: string } }[];
    attachments?: GraphAttachment[];
  };
  saveToSentItems: 'false' | 'true';
}

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  contentType?: 'Text' | 'HTML';
  attachments?: {
    name: string;
    contentType: string;
    content: Buffer | Uint8Array;
    contentId?: string;
    isInline?: boolean;
  }[];
}

export interface GeneratedExportMail {
  filename: string;
  buffer: Buffer | Uint8Array;
  contentType: string;
  kind: string;
  rangeFrom: string;
  rangeTo: string;
  scopeLabel: string;
}

/** Graph simple-attachment limit is 3 MB. */
const MAX_SIMPLE_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const SEND_MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function mailErrorMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const response = err.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response && 'message' in response) {
      const message = (response as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
  }
  return err instanceof Error ? err.message : 'Email failed';
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async getPublicConfig(): Promise<MailConfigView> {
    const resolved = await this.resolveConfig();
    return {
      authority: resolved.authority,
      clientId: resolved.clientId,
      scope: resolved.scope,
      senderMailbox: resolved.senderMailbox,
      fromAddress: resolved.fromAddress,
      fromName: resolved.fromName,
      reportRecipient: resolved.reportRecipient,
      sendReportByDefault: resolved.sendReportByDefault,
      problemReportRecipient: resolved.problemReportRecipient,
      hasClientSecret: Boolean(resolved.clientSecret),
      configured: this.isConfigured(resolved),
    };
  }

  async setConfig(input: MailConfigInput, actorId?: number | null): Promise<MailConfigView> {
    const parsed = mailConfigSchema.parse(input);
    const before = await this.readStored();
    const next: StoredMailConfig = {
      authority: parsed.authority,
      clientId: parsed.clientId,
      scope: parsed.scope,
      senderMailbox: parsed.senderMailbox,
      fromAddress: parsed.fromAddress,
      fromName: parsed.fromName?.trim() ?? '',
      reportRecipient: parsed.reportRecipient?.trim() ?? '',
      sendReportByDefault: parsed.sendReportByDefault ?? false,
      problemReportRecipient: parsed.problemReportRecipient?.trim() ?? '',
      clientSecret: parsed.clientSecret?.trim()
        ? parsed.clientSecret.trim()
        : before?.clientSecret,
    };

    await this.prisma.setting.upsert({
      where: { key: SETTING_KEYS.MAIL },
      create: { key: SETTING_KEYS.MAIL, value: next as Prisma.InputJsonValue },
      update: { value: next as Prisma.InputJsonValue },
    });

    this.cachedToken = null;

    await this.audit.log({
      userId: actorId ?? null,
      action: 'update',
      entity: 'Setting',
      entityId: SETTING_KEYS.MAIL,
      before: this.auditSafe(before),
      after: this.auditSafe(next),
    });

    return this.getPublicConfig();
  }

  async getReportPolicy(): Promise<MailReportPolicy> {
    const resolved = await this.resolveConfig();
    const recipients = parseMailRecipients(resolved.reportRecipient);
    return {
      sendByDefault: resolved.sendReportByDefault,
      recipient: resolved.reportRecipient,
      canSend: this.isConfigured(resolved) && recipients.length > 0,
    };
  }

  async getProblemReportPolicy(): Promise<MailProblemReportPolicy> {
    const resolved = await this.resolveConfig();
    const recipients = parseMailRecipients(resolved.problemReportRecipient);
    return {
      canSend: this.isConfigured(resolved) && recipients.length > 0,
    };
  }

  async sendProblemReport(input: {
    user: SessionUser;
    intendedAction: string;
    whatHappened: string;
    expected: string;
    pageUrl: string;
    viewport: string;
    userAgent: string;
    screenshot?: { buffer: Buffer; contentType: string; filename: string };
  }): Promise<ProblemReportResult> {
    const cfg = await this.resolveConfig();
    const recipients = parseMailRecipients(cfg.problemReportRecipient);
    if (!this.isConfigured(cfg) || recipients.length === 0) {
      throw new BadRequestException(
        'Problem report recipients are not configured in Mail settings.',
      );
    }

    const id = `TTAH-PR-${randomBytes(4).toString('hex')}`;
    const account = await this.prisma.user.findUnique({
      where: { id: input.user.id },
      select: { email: true },
    });
    const branded = this.brandedChrome();
    const attachments = [...branded.attachments];

    if (input.screenshot && input.screenshot.buffer.length > 0) {
      if (input.screenshot.buffer.length > MAX_SIMPLE_ATTACHMENT_BYTES) {
        this.logger.warn(
          `Problem report ${id}: screenshot omitted (${input.screenshot.buffer.length} bytes)`,
        );
      } else {
        attachments.push({
          name: input.screenshot.filename,
          contentType: input.screenshot.contentType.split(';')[0] || 'image/jpeg',
          content: input.screenshot.buffer,
        });
      }
    }

    const hasScreenshot = attachments.some((att) => !att.isInline);
    const pageUrl = input.pageUrl.trim();

    await this.send({
      to: recipients,
      subject: `[TTAH] Problem report ${id} — ${input.user.username}`,
      contentType: 'HTML',
      body: problemReportEmailHtml({
        referenceId: id,
        username: input.user.username,
        role: input.user.role,
        email: account?.email ?? '',
        pageUrl,
        userAgent: input.userAgent,
        viewport: input.viewport,
        reportedAt: new Date().toISOString(),
        intendedAction: input.intendedAction,
        whatHappened: input.whatHappened,
        expected: input.expected,
        hasScreenshot,
        appUrl: pageUrl || branded.appUrl,
        includeBanner: branded.includeBanner,
      }),
      attachments,
    });

    await this.audit.log({
      userId: input.user.id,
      action: 'create',
      entity: 'ProblemReport',
      entityId: id,
      after: {
        pageUrl: pageUrl || null,
        username: input.user.username,
        hasScreenshot,
      },
    });

    return { id };
  }

  async sendGeneratedExport(file: GeneratedExportMail): Promise<{ recipients: string[] }> {
    const cfg = await this.resolveConfig();
    const recipients = parseMailRecipients(cfg.reportRecipient);
    if (!this.isConfigured(cfg) || recipients.length === 0) {
      throw new BadRequestException(
        'Set a report recipient in Mail settings before emailing exports.',
      );
    }

    const who = file.scopeLabel;
    const branded = this.brandedChrome();

    await this.send({
      to: recipients,
      subject: `TTAH report: ${file.kind} for ${who} (${file.rangeFrom} – ${file.rangeTo})`,
      contentType: 'HTML',
      body: reportExportEmailHtml({
        kind: file.kind,
        scopeLabel: who,
        rangeFrom: file.rangeFrom,
        rangeTo: file.rangeTo,
        filename: file.filename,
        appUrl: branded.appUrl,
        includeBanner: branded.includeBanner,
      }),
      attachments: [
        ...branded.attachments,
        {
          name: file.filename,
          contentType: file.contentType.split(';')[0],
          content: file.buffer,
        },
      ],
    });

    return { recipients };
  }

  async verifyConnection(): Promise<{ ok: true; expiresIn: number }> {
    const { expiresIn } = await this.acquireToken();
    return { ok: true, expiresIn };
  }

  async sendTest(input: SendTestMailInput): Promise<{ ok: true }> {
    const branded = this.brandedChrome();
    await this.send({
      to: [input.to],
      cc: input.cc ? [input.cc] : undefined,
      subject: input.subject,
      contentType: 'HTML',
      body: testEmailHtml({
        body: input.body,
        appUrl: branded.appUrl,
        includeBanner: branded.includeBanner,
      }),
      attachments: branded.attachments,
    });
    return { ok: true };
  }

  async isReady(): Promise<boolean> {
    const resolved = await this.resolveConfig();
    return this.isConfigured(resolved);
  }

  async sendPasswordReset(input: {
    to: string;
    username: string;
    resetUrl: string;
    expiresMinutes: number;
  }): Promise<void> {
    const hoursLabel =
      input.expiresMinutes % 60 === 0
        ? `${input.expiresMinutes / 60} hour${input.expiresMinutes === 60 ? '' : 's'}`
        : `${input.expiresMinutes} minutes`;
    const branded = this.brandedChrome();
    await this.send({
      to: [input.to],
      subject: 'Reset your TTAH password',
      contentType: 'HTML',
      body: passwordResetEmailHtml({
        username: input.username,
        resetUrl: input.resetUrl,
        expiresLabel: hoursLabel,
        includeBanner: branded.includeBanner,
      }),
      attachments: branded.attachments,
    });
  }

  async sendAdminSetPassword(input: {
    to: string;
    firstName: string;
    username: string;
    initialPassword: string;
    loginUrl: string;
  }): Promise<void> {
    const branded = this.brandedChrome();
    await this.send({
      to: [input.to],
      subject: 'Your TTAH password was updated',
      contentType: 'HTML',
      body: adminSetPasswordEmailHtml({
        firstName: input.firstName,
        username: input.username,
        initialPassword: input.initialPassword,
        loginUrl: input.loginUrl,
        includeBanner: branded.includeBanner,
      }),
      attachments: branded.attachments,
    });
  }

  async sendWelcomeAccount(input: {
    to: string;
    firstName: string;
    username: string;
    initialPassword: string;
    loginUrl: string;
  }): Promise<void> {
    const branded = this.brandedChrome();
    await this.send({
      to: [input.to],
      subject: 'Your TTAH account is ready',
      contentType: 'HTML',
      body: welcomeAccountEmailHtml({
        firstName: input.firstName,
        username: input.username,
        initialPassword: input.initialPassword,
        loginUrl: input.loginUrl,
        includeBanner: branded.includeBanner,
      }),
      attachments: branded.attachments,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    const cfg = await this.resolveConfig();
    if (!this.isConfigured(cfg)) {
      throw new BadRequestException(
        'Mail is not configured. Set Graph credentials, sender mailbox and from address first.',
      );
    }

    const to = this.normalizeRecipients(options.to);
    if (to.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    const fromEmail: GraphEmailAddress = { address: cfg.fromAddress };
    if (cfg.fromName) fromEmail.name = cfg.fromName;

    const payload: GraphMailRequest = {
      message: {
        subject: options.subject,
        from: { emailAddress: fromEmail },
        body: {
          contentType: options.contentType ?? 'Text',
          content: options.body,
        },
        toRecipients: to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: 'false',
    };

    const cc = this.normalizeRecipients(options.cc ?? []);
    if (cc.length > 0) {
      payload.message.ccRecipients = cc.map((address) => ({ emailAddress: { address } }));
    }

    if (options.attachments?.length) {
      payload.message.attachments = options.attachments.map((att) => {
        const bytes = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
        if (bytes.length > MAX_SIMPLE_ATTACHMENT_BYTES) {
          throw new BadRequestException(
            `Attachment ${att.name} is too large for Graph sendMail (${bytes.length} bytes; max 3 MB).`,
          );
        }
        return {
          '@odata.type': '#microsoft.graph.fileAttachment' as const,
          name: att.name,
          contentType: att.contentType,
          contentBytes: bytes.toString('base64'),
          ...(att.contentId ? { contentId: att.contentId } : {}),
          ...(att.isInline ? { isInline: true } : {}),
        };
      });
    }

    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.senderMailbox)}/sendMail`;
    const body = JSON.stringify(payload);
    let lastMessage = 'Graph sendMail failed';
    let waitMs = 0;

    for (let attempt = 0; attempt < SEND_MAX_ATTEMPTS; attempt++) {
      if (waitMs > 0) await this.sleep(waitMs);

      const { token } = await this.acquireToken(cfg);
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body,
        });
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : 'Cannot reach Microsoft Graph';
        this.logger.warn(
          `Graph sendMail network error (attempt ${attempt + 1}/${SEND_MAX_ATTEMPTS}): ${lastMessage}`,
        );
        if (attempt === SEND_MAX_ATTEMPTS - 1) {
          throw new ServiceUnavailableException(lastMessage);
        }
        waitMs = this.retryDelayMs(attempt);
        continue;
      }

      if (res.status === 202 || res.status === 200) {
        if (attempt > 0) {
          this.logger.log(`Graph sendMail succeeded on attempt ${attempt + 1}`);
        }
        return;
      }

      lastMessage = await this.readGraphError(res, 'Graph sendMail failed');
      const retryable = res.status === 401 || RETRYABLE_STATUS.has(res.status);
      if (res.status === 401) this.cachedToken = null;

      if (!retryable || attempt === SEND_MAX_ATTEMPTS - 1) {
        this.logger.error(lastMessage);
        throw new BadRequestException(lastMessage);
      }

      this.logger.warn(
        `Graph sendMail ${res.status} (attempt ${attempt + 1}/${SEND_MAX_ATTEMPTS}): ${lastMessage}`,
      );
      waitMs = this.retryAfterMs(res.headers.get('retry-after')) ?? this.retryDelayMs(attempt);
    }

    throw new BadRequestException(lastMessage);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private retryDelayMs(failedAttempt: number): number {
    return Math.min(500 * 2 ** failedAttempt, 8_000);
  }

  private retryAfterMs(header: string | null): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(seconds * 1000, 15_000);
  }

  private async acquireToken(
    cfg?: ResolvedMailConfig,
  ): Promise<{ token: string; expiresIn: number }> {
    const resolved = cfg ?? (await this.resolveConfig());
    if (!resolved.clientId || !resolved.clientSecret || !resolved.authority) {
      throw new BadRequestException('Graph client id, secret and authority are required');
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return {
        token: this.cachedToken.value,
        expiresIn: Math.max(0, Math.round((this.cachedToken.expiresAt - now) / 1000)),
      };
    }

    const tokenUrl = `${resolved.authority.replace(/\/+$/, '')}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: resolved.clientId,
      client_secret: resolved.clientSecret,
      scope: resolved.scope,
      grant_type: 'client_credentials',
    });

    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      this.logger.error(err);
      throw new ServiceUnavailableException('Cannot reach Microsoft login to acquire a Graph token');
    }

    if (!res.ok) {
      const message = await this.readGraphError(res, 'Graph token request failed');
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new BadRequestException('Graph token response did not include access_token');
    }

    const expiresIn = Number(json.expires_in) || 3600;
    this.cachedToken = {
      value: json.access_token,
      expiresAt: now + expiresIn * 1000,
    };
    return { token: json.access_token, expiresIn };
  }

  private async resolveConfig(): Promise<ResolvedMailConfig> {
    const env = this.config.get<MailGraphEnvConfig>('mail')!;
    const stored = await this.readStored();
    return {
      authority: stored?.authority?.trim() || env.authority,
      clientId: stored?.clientId?.trim() || env.clientId,
      clientSecret: stored?.clientSecret?.trim() || env.clientSecret,
      scope: stored?.scope?.trim() || env.scope,
      senderMailbox: stored?.senderMailbox?.trim() || env.senderMailbox,
      fromAddress: stored?.fromAddress?.trim() || env.fromAddress,
      fromName: stored?.fromName?.trim() || env.fromName,
      reportRecipient: stored?.reportRecipient?.trim() ?? '',
      sendReportByDefault: stored?.sendReportByDefault ?? false,
      problemReportRecipient: stored?.problemReportRecipient?.trim() ?? '',
    };
  }

  private async readStored(): Promise<StoredMailConfig | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTING_KEYS.MAIL } });
    if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) {
      return null;
    }
    return row.value as StoredMailConfig;
  }

  private isConfigured(cfg: ResolvedMailConfig): boolean {
    return Boolean(
      cfg.authority &&
        cfg.clientId &&
        cfg.clientSecret &&
        cfg.scope &&
        cfg.senderMailbox &&
        cfg.fromAddress,
    );
  }

  private brandedChrome(): {
    includeBanner: boolean;
    appUrl: string;
    attachments: NonNullable<SendMailOptions['attachments']>;
  } {
    const banner = loadEmailBanner();
    const appUrl = (this.config.get<string>('publicAppUrl') ?? '').replace(/\/+$/, '');
    return {
      includeBanner: Boolean(banner),
      appUrl,
      attachments: banner ? [this.inlineBanner(banner)] : [],
    };
  }

  private inlineBanner(content: Buffer) {
    return {
      name: EMAIL_BANNER_NAME,
      contentType: 'image/jpeg',
      content,
      contentId: EMAIL_BANNER_CID,
      isInline: true,
    };
  }

  private normalizeRecipients(list: string[]): string[] {
    return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  }

  private auditSafe(value: StoredMailConfig | null | undefined) {
    if (!value) return null;
    const { clientSecret: _secret, ...rest } = value;
    return { ...rest, hasClientSecret: Boolean(_secret) };
  }

  private async readGraphError(res: Response, fallback: string): Promise<string> {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: string | { code?: string; message?: string };
        error_description?: string;
      };
      if (typeof json.error === 'string') {
        return json.error_description || json.error || `${fallback} (${res.status})`;
      }
      if (json.error?.message) {
        return json.error.message;
      }
    } catch {
      // ignore parse errors
    }
    return text?.trim() ? `${fallback} (${res.status}): ${text.slice(0, 400)}` : `${fallback} (${res.status})`;
  }
}
