import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import * as crypto from 'crypto';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import * as express from 'express';
import { SpaFilter } from './spa.filter';

// Polyfill for Node.js 18/20 where 'crypto' is not globally available for TypeORM
if (!global.crypto) {
  (global as any).crypto = crypto;
}

import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Serve uploaded media (images/videos) from configured uploads path
    const uploadsPath = require('path').resolve(process.env.UPLOADS_PATH || join(process.cwd(), 'public'));
    console.log('Serving /public from:', uploadsPath);
    app.use('/public', express.static(uploadsPath));

    // Serve frontend static files with correct MIME types
    const customerDir = join(process.cwd(), 'client', 'customer');
    const adminDir = join(process.cwd(), 'client', 'admin');
    if (existsSync(customerDir)) app.use(express.static(customerDir));
    if (existsSync(adminDir)) app.use('/admin', express.static(adminDir));

    // SPA fallback for client-side routing
    app.useGlobalFilters(new SpaFilter());

    const port = process.env.PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Global Prefix: api`);
  } catch (err) {
    console.error('SERVER FAILED TO START:', err);
    process.exit(1);
  }
}
bootstrap();
