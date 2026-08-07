import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

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
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}
