import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  mailConfigSchema,
  sendTestMailSchema,
  type MailConfigInput,
  type MailConfigView,
  type MailReportPolicy,
  type MailSendResult,
  type MailVerifyResult,
  type SendTestMailInput,
  type SessionUser,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('report-policy')
  getReportPolicy(): Promise<MailReportPolicy> {
    return this.mail.getReportPolicy();
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
}
