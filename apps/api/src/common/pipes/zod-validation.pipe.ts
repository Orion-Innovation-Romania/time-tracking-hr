import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates and coerces request payloads against a zod schema shared with the
 * frontend. Throws a 400 with a flattened issue list on failure.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'ValidationError',
        message: result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`,
        ),
      });
    }
    return result.data;
  }
}
