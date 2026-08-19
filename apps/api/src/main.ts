import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi/setup-openapi';

async function listen(app: Awaited<ReturnType<typeof NestFactory.create>>, port: number) {
  const log = new Logger('Bootstrap');
  const attempts = 8;
  for (let i = 1; i <= attempts; i++) {
    try {
      await app.listen(port, '0.0.0.0');
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE' || i === attempts) throw err;
      const waitMs = 250 * i;
      log.warn(`Port ${port} still in use (watch restart). Retry ${i}/${attempts - 1} in ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const securityHeaders = helmet();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/docs')) return next();
    return securityHeaders(req, res, next);
  });
  app.use(cookieParser());
  setupOpenApi(app);
  // Watch restarts on Windows send SIGTERM; skip graceful hooks in dev so the
  // old process releases :4000 before the new one binds.
  if (process.env.NODE_ENV === 'production') {
    app.enableShutdownHooks();
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await listen(app, port);
  new Logger('Bootstrap').log(`TTAH API listening on port ${port} (prefix /api)`);
}

void bootstrap();
