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
import { DataSource } from 'typeorm';

async function runMigrations(app: any) {
  const ds = app.get(DataSource);
  const cols: [string, string][] = [
    ['phone_number', 'VARCHAR(255) NULL'],
    ['processed_at', 'TIMESTAMP NULL'],
    ['synced_at', 'TIMESTAMP NULL'],
    ['customer_city', 'VARCHAR(255) NULL'],
    ['customer_state', 'VARCHAR(255) NULL'],
    ['amount_given', 'DECIMAL(10,2) NULL'],
    ['processed_by', 'INT NULL'],
    ['customer_gstin', 'VARCHAR(255) NULL'],
    ['customer_pincode', 'VARCHAR(255) NULL'],
    ['customer_email', 'VARCHAR(255) NULL'],
  ];
  for (const [col, def] of cols) {
    try {
      await ds.query(`ALTER TABLE \`order\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`Migration: added column order.${col}`);
    } catch (e: any) {
      if (e?.errno !== 1060) console.error(`Migration error for ${col}:`, e?.sqlMessage);
    }
  }

  // Backfill order.customer_id for legacy rows where the FK was never populated.
  // Idempotent: only touches rows where customer_id IS NULL, so re-running on
  // every boot is a no-op once everything is linked.
  // Pass 1: exact phone match (cheap path, no regex).
  try {
    const r: any = await ds.query(
      `UPDATE \`order\` o
       JOIN customers c ON c.phone_number = o.customer_phone
       SET o.customer_id = c.id
       WHERE o.customer_id IS NULL
         AND o.customer_phone IS NOT NULL`,
    );
    const affected = r?.affectedRows ?? r?.[1]?.affectedRows ?? 0;
    if (affected > 0) {
      console.log(`Migration: backfilled order.customer_id (exact match) — ${affected} rows`);
    }
  } catch (e: any) {
    console.error('Migration: customer_id exact-match backfill failed:', e?.sqlMessage);
  }

  // Pass 2: last-10-digits match for legacy rows where phone formats diverge
  // ('+91 999...', '0999...', '999-999-9999', etc.). REGEXP_REPLACE requires
  // MySQL 8+. If the engine doesn't support it, skip silently — pass 1 still
  // covered most cases.
  try {
    const r: any = await ds.query(
      `UPDATE \`order\` o
       JOIN customers c
         ON RIGHT(REGEXP_REPLACE(c.phone_number, '[^0-9]', ''), 10) =
            RIGHT(REGEXP_REPLACE(o.customer_phone, '[^0-9]', ''), 10)
       SET o.customer_id = c.id
       WHERE o.customer_id IS NULL
         AND o.customer_phone IS NOT NULL
         AND CHAR_LENGTH(REGEXP_REPLACE(o.customer_phone, '[^0-9]', '')) >= 10`,
    );
    const affected = r?.affectedRows ?? r?.[1]?.affectedRows ?? 0;
    if (affected > 0) {
      console.log(`Migration: backfilled order.customer_id (last-10-digits match) — ${affected} rows`);
    }
  } catch (e: any) {
    // Tolerate older MySQL without REGEXP_REPLACE — pass 1 already ran.
    console.warn('Migration: customer_id digit-match backfill skipped:', e?.sqlMessage);
  }

  // One-time role-defaults backfill for staff users whose `permissions` is
  // NULL (never been set). Idempotent: only NULL rows are touched. Admin
  // users are NEVER touched (they bypass PermissionsGuard anyway). Rows
  // admin explicitly set to '[]' are also left alone — that's a deliberate
  // "no permissions" choice we must respect.
  const roleDefaults: Record<string, string[]> = {
    manager: ['inventory'],
    employee: ['orders', 'reports'],
  };
  for (const [role, perms] of Object.entries(roleDefaults)) {
    try {
      const json = JSON.stringify(perms);
      const r: any = await ds.query(
        `UPDATE \`user\` SET permissions = ?
         WHERE role = ? AND permissions IS NULL`,
        [json, role],
      );
      const affected = r?.affectedRows ?? r?.[1]?.affectedRows ?? 0;
      if (affected > 0) {
        console.log(`Migration: backfilled ${affected} ${role}(s) with default permissions ${json}`);
      }
    } catch (e: any) {
      console.error(`Migration: ${role} permissions backfill failed:`, e?.sqlMessage || e?.message);
    }
  }
}

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    await runMigrations(app);
    const expressInstance = app.getHttpAdapter().getInstance();
    expressInstance.set('trust proxy', 1);
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
