import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  exportRequestSchema,
  exportTemplateSchema,
  type ExportRequest,
  type ExportTemplateInput,
  type SessionUser,
} from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { mailErrorMessage, MailService } from '../mail/mail.service';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  private readonly logger = new Logger(ExportsController.name);

  constructor(
    private readonly exports: ExportsService,
    private readonly mail: MailService,
  ) {}

  @Get('templates')
  listTemplates() {
    return this.exports.listTemplates();
  }

  @Post('templates')
  createTemplate(
    @Body(new ZodValidationPipe(exportTemplateSchema)) body: ExportTemplateInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.exports.createTemplate(body, user.id);
  }

  @Put('templates/:id')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(exportTemplateSchema)) body: ExportTemplateInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.exports.updateTemplate(id, body, user.id);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.exports.deleteTemplate(id, user.id);
  }

  @Post('generate')
  async generate(
    @Body(new ZodValidationPipe(exportRequestSchema)) body: ExportRequest,
    @CurrentUser() user: SessionUser,
    @Res() res: Response,
  ) {
    const file = await this.exports.generate(body, user.id);
    const policy = await this.mail.getReportPolicy();
    const wantEmail = policy.sendByDefault && policy.canSend;

    let emailed: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailTo = '';
    let emailError = '';

    if (wantEmail) {
      try {
        const result = await this.mail.sendGeneratedExport({
          filename: file.filename,
          buffer: file.buffer,
          contentType: file.contentType,
          kind: body.kind,
          rangeFrom: body.filter.from,
          rangeTo: body.filter.to,
          scopeLabel: file.scopeLabel,
        });
        emailed = 'sent';
        emailTo = result.recipients.join(', ');
      } catch (err) {
        emailed = 'failed';
        emailError = mailErrorMessage(err);
        this.logger.error(`Export email failed: ${emailError}`);
      }
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('X-TTAH-Emailed', emailed);
    if (emailTo) res.setHeader('X-TTAH-Email-To', emailTo);
    if (emailError) res.setHeader('X-TTAH-Email-Error', encodeURIComponent(emailError.slice(0, 300)));
    res.send(file.buffer);
  }
}
