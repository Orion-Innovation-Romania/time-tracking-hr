import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, type INestApplication } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { load as loadYaml } from 'js-yaml';

const log = new Logger('OpenAPI');

function resolveSpecPath(): string | null {
  const candidates = [
    join(__dirname, 'openapi.yaml'),
    join(__dirname, '..', 'openapi.yaml'),
    join(__dirname, '..', '..', '..', 'docs', 'openapi.yaml'),
    join(process.cwd(), 'docs', 'openapi.yaml'),
    join(process.cwd(), '..', '..', 'docs', 'openapi.yaml'),
  ];
  return candidates.find((file) => existsSync(file)) ?? null;
}

/**
 * Serves Swagger UI at `/api/docs` from the checked-in OpenAPI spec.
 * Disable with OPENAPI_ENABLED=false.
 */
export function setupOpenApi(app: INestApplication): void {
  const enabled = (process.env.OPENAPI_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    log.log('OpenAPI disabled (OPENAPI_ENABLED=false)');
    return;
  }

  const specPath = resolveSpecPath();
  if (!specPath) {
    log.warn('OpenAPI spec not found; Swagger UI skipped');
    return;
  }

  const spec = loadYaml(readFileSync(specPath, 'utf8')) as OpenAPIObject;
  SwaggerModule.setup('docs', app, spec, {
    useGlobalPrefix: true,
    customSiteTitle: 'TTAH API',
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      validatorUrl: false,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs.yaml',
  });
  log.log(`Swagger UI at /api/docs (spec ${specPath})`);
}
