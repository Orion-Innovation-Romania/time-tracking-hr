import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import {
  mailConfigSchema,
  problemReportFieldsSchema,
  sendTestMailSchema,
  type MailConfigInput,
  type MailConfigView,
  type MailProblemReportPolicy,
  type MailReportPolicy,
  type MailSendResult,
  type MailVerifyResult,
  type ProblemReportResult,
  type SendTestMailInput,
  type SessionUser,
} from '@ttah/shared';
import { AllowWhenMustChange } from '../common/decorators/allow-password-change.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MemoryRateLimit } from '../common/memory-rate-limit';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MailService } from './mail.service';

const SCREENSHOT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;

@Controller('mail')
export class MailController {
  /** 5 reports / hour per signed-in user. */
  private readonly problemReportsByUser = new MemoryRateLimit(5, 60 * 60 * 1000);

  constructor(private readonly mail: MailService) {}

  @Get('report-policy')
  getReportPolicy(): Promise<MailReportPolicy> {
    return this.mail.getReportPolicy();
  }

  @Get('problem-report-policy')
  @AllowWhenMustChange()
  getProblemReportPolicy(): Promise<MailProblemReportPolicy> {
    return this.mail.getProblemReportPolicy();
  }

  @Post('problem-report')
  @AllowWhenMustChange()
  @UseInterceptors(
    FileInterceptor('screenshot', {
      storage: memoryStorage(),
      limits: { fileSize: SCREENSHOT_MAX_BYTES },
    }),
  )
  sendProblemReport(
    @UploadedFile() screenshot: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<ProblemReportResult> {
    if (!this.problemReportsByUser.try(`user:${user.id}`)) {
      throw new HttpException(
        'Too many problem reports. Try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const parsed = problemReportFieldsSchema.safeParse({
      intendedAction: body.intendedAction,
      whatHappened: body.whatHappened,
      expected: body.expected,
      pageUrl: body.pageUrl,
      viewport: body.viewport,
    });
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'ValidationError',
        message: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`,
        ),
      });
    }

    return this.mail.sendProblemReport({
      user,
      intendedAction: parsed.data.intendedAction,
      whatHappened: parsed.data.whatHappened,
      expected: parsed.data.expected,
      pageUrl: parsed.data.pageUrl,
      viewport: parsed.data.viewport,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 400),
      screenshot: this.normalizeScreenshot(screenshot),
    });
  }

  @Get('config')
  @Roles('admin')
  getConfig(): Promise<MailConfigView> {
    return this.mail.getPublicConfig();
  }

  @Put('config')
  @Roles('admin')
  setConfig(
    @Body(new ZodValidationPipe(mailConfigSchema)) body: MailConfigInput,
    @CurrentUser() user: SessionUser,
  ): Promise<MailConfigView> {
    return this.mail.setConfig(body, user.id);
  }

  @Post('verify')
  @Roles('admin')
  verify(): Promise<MailVerifyResult> {
    return this.mail.verifyConnection();
  }

  @Post('test')
  @Roles('admin')
  sendTest(
    @Body(new ZodValidationPipe(sendTestMailSchema)) body: SendTestMailInput,
  ): Promise<MailSendResult> {
    return this.mail.sendTest(body);
  }

  private normalizeScreenshot(
    file: Express.Multer.File | undefined,
  ): { buffer: Buffer; contentType: string; filename: string } | undefined {
    if (!file?.buffer?.length) return undefined;
    const contentType = (file.mimetype || '').toLowerCase();
    const name = (file.originalname || '').toLowerCase();
    const fromName =
      name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg' : '';
    const resolved = SCREENSHOT_TYPES.has(contentType) ? contentType : fromName;
    if (!SCREENSHOT_TYPES.has(resolved)) {
      throw new BadRequestException('Screenshot must be a JPEG, PNG or WebP image.');
    }
    const ext =
      resolved === 'image/png' ? 'png' : resolved === 'image/webp' ? 'webp' : 'jpg';
    return {
      buffer: file.buffer,
      contentType: resolved === 'image/jpg' ? 'image/jpeg' : resolved,
      filename: `screenshot.${ext}`,
    };
  }
}
