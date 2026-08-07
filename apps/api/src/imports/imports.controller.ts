import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { importCommitSchema, type ImportCommitInput, type SessionUser } from '@ttah/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  preview(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const isPdf = /pdf$/i.test(file.mimetype) || /\.pdf$/i.test(file.originalname);
    if (!isPdf) throw new BadRequestException('Only PDF files are supported');
    return this.imports.preview({ originalname: file.originalname, buffer: file.buffer });
  }

  @Post('commit')
  commit(
    @Body(new ZodValidationPipe(importCommitSchema)) body: ImportCommitInput,
    @CurrentUser() user: SessionUser,
  ) {
    return this.imports.commit(body, user.id);
  }

  @Get()
  list() {
    return this.imports.listBatches();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.imports.deleteBatch(id, user.id);
  }
}
