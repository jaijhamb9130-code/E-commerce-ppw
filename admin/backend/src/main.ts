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

  // Ensure the customer-facing tables exist. With `synchronize` off (prod),
  // TypeORM no longer auto-creates tables, and the column ALTERs below assume
  // the tables already exist. `customers`/`addresses` were added after the
  // switch, so on any DB that didn't have them from the old synchronize era
  // (fresh DB, new RDS instance, etc.) the customer sign-up / sign-in flow
  // would 500 with "table doesn't exist". CREATE TABLE IF NOT EXISTS is
  // idempotent — a no-op when the table is already there.
  const tables: [string, string][] = [
    [
      'customers',
      `CREATE TABLE IF NOT EXISTS \`customers\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(255) NULL,
        \`phone_number\` VARCHAR(255) NOT NULL,
        \`shop_no\` VARCHAR(255) NULL,
        \`email\` VARCHAR(255) NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_customers_phone_number\` (\`phone_number\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ],
    [
      'addresses',
      `CREATE TABLE IF NOT EXISTS \`addresses\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`customer_id\` INT NOT NULL,
        \`name\` VARCHAR(255) NULL,
        \`shop_no\` VARCHAR(255) NULL,
        \`address\` TEXT NOT NULL,
        \`landmark\` VARCHAR(255) NULL,
        \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_addresses_customer_id\` (\`customer_id\`),
        CONSTRAINT \`FK_addresses_customer\` FOREIGN KEY (\`customer_id\`)
          REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ],
  ];
  for (const [name, ddl] of tables) {
    try {
      await ds.query(ddl);
      console.log(`Migration: ensured table \`${name}\` exists`);
    } catch (e: any) {
      console.error(`Migration error ensuring table ${name}:`, e?.sqlMessage || e?.message);
    }
  }

  const cols: [string, string][] = [
    ['phone_number', 'VARCHAR(255) NULL'],
    // customer_id / address_id come from the Order→Customer and Order→Address
    // relations added for the customer portal. synchronize does NOT reliably
    // ALTER the reserved-word `order` table, so these must be created here —
    // without them every /orders/customer/:phone query fails with
    // "Unknown column 'o.customer_id'", and the customer_id backfill below
    // silently no-ops.
    ['customer_id', 'INT NULL'],
    ['address_id', 'INT NULL'],
    ['processed_at', 'TIMESTAMP NULL'],
    ['synced_at', 'TIMESTAMP NULL'],
    ['customer_city', 'VARCHAR(255) NULL'],
    ['customer_state', 'VARCHAR(255) NULL'],
    ['amount_given', 'DECIMAL(10,2) NULL'],
    ['processed_by', 'INT NULL'],
    ['customer_gstin', 'VARCHAR(255) NULL'],
    ['customer_pincode', 'VARCHAR(255) NULL'],
    ['customer_email', 'VARCHAR(255) NULL'],
    // Full reconciliation of the rest of the Order entity. synchronize does not
    // maintain the reserved-word `order` table, so any column it should have
    // created may be missing. All NULL-safe so ADD never fails on existing rows;
    // present columns are skipped (errno 1060). This guarantees every column the
    // SELECT references exists.
    ['bill_number', 'VARCHAR(255) NULL'],
    ['tally_master_id', 'VARCHAR(255) NULL'],
    ['customer_name', 'VARCHAR(255) NULL'],
    ['customer_address', 'VARCHAR(255) NULL'],
    ['customer_phone', 'VARCHAR(255) NULL'],
    ['order_type', 'VARCHAR(50) NULL'],
    ['date', 'DATE NULL'],
    ['total_amount', 'DECIMAL(10,2) NULL'],
    ['created_by', 'INT NULL'],
    ['remark', 'TEXT NULL'],
    ['source', 'VARCHAR(20) NULL'],
    ['status', 'VARCHAR(20) NULL'],
    ['ledgerId', 'INT NULL'],
    ['created_at', 'DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)'],
  ];
  for (const [col, def] of cols) {
    try {
      await ds.query(`ALTER TABLE \`order\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`Migration: added column order.${col}`);
    } catch (e: any) {
      if (e?.errno !== 1060) console.error(`Migration error for order.${col}:`, e?.sqlMessage);
    }
  }

  // Comprehensive audit for other tables
  const stockCols: [string, string][] = [
    ['ats_barcode',        'VARCHAR(255) NULL'],
    ['group',              'VARCHAR(255) NULL'],
    ['category',           'VARCHAR(255) NULL'],
    ['last_purchase_cost', 'VARCHAR(255) NULL'],
    ['is_active',          'TINYINT(1) NOT NULL DEFAULT 1'],
    ['expiry_date',        'DATETIME NULL'],
    ['rate_one_2',         'VARCHAR(255) NULL'],
    ['rate_one_3',         'VARCHAR(255) NULL'],
    ['rate_one_4',         'VARCHAR(255) NULL'],
    ['rate_one_4a',        'VARCHAR(255) NULL'],
    ['rate_one_5',         'VARCHAR(255) NULL'],
    ['hsn',                'VARCHAR(255) NULL'],
    ['gst',                'VARCHAR(255) NULL'],
    ['default_mrp',        'VARCHAR(255) NULL'],
  ];
  for (const [col, def] of stockCols) {
    try {
      await ds.query(`ALTER TABLE \`stock_item\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`Migration: added column stock_item.${col}`);
    } catch (e: any) {
      if (e?.errno !== 1060) console.error(`Migration error for stock_item.${col}:`, e?.sqlMessage);
    }
  }

  const ledgerCols: [string, string][] = [
    ['address',         'VARCHAR(255) NULL'],
    ['person_name',     'VARCHAR(255) NULL'],
    ['phone_number',    'VARCHAR(255) NULL'],
    ['email',           'VARCHAR(255) NULL'],
    ['gstin',           'VARCHAR(255) NULL'],
    ['pincode',         'VARCHAR(255) NULL'],
    ['state',           'VARCHAR(255) NULL'],
    ['tally_guid',      'VARCHAR(255) NULL'],
  ];
  for (const [col, def] of ledgerCols) {
    try {
      await ds.query(`ALTER TABLE \`ledger\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`Migration: added column ledger.${col}`);
    } catch (e: any) {
      if (e?.errno !== 1060) console.error(`Migration error for ledger.${col}:`, e?.sqlMessage);
    }
  }

  const detailCols: [string, string][] = [
    ['selected_scheme', 'VARCHAR(255) NULL'],
    ['livestock_type',  'VARCHAR(255) NULL'],
    ['parent',          'VARCHAR(255) NULL'],
    ['group',           'VARCHAR(255) NULL'],
    ['category',        'VARCHAR(255) NULL'],
    // Full reconciliation of the OrderDetail entity (the customer-orders query
    // does leftJoinAndSelect('o.orderDetails') and selects every column).
    ['orderId',             'INT NULL'],
    ['stock_item_id',       'VARCHAR(255) NULL'],
    ['item_name',           'VARCHAR(255) NULL'],
    ['rate',                'DECIMAL(10,2) NULL'],
    ['unit',                'VARCHAR(255) NULL'],
    ['quantity',            'DECIMAL(10,2) NULL'],
    ['amount',             'DECIMAL(10,2) NULL'],
    ['gst',                 'DECIMAL(10,2) NULL'],
    ['discount_percentage', 'DECIMAL(10,2) NULL DEFAULT 0'],
    ['status',              'VARCHAR(20) NULL'],
    ['processed_by',        'INT NULL'],
    ['processed_at',        'TIMESTAMP NULL'],
  ];
  for (const [col, def] of detailCols) {
    try {
      await ds.query(`ALTER TABLE \`order_detail\` ADD COLUMN \`${col}\` ${def}`);
      console.log(`Migration: added column order_detail.${col}`);
    } catch (e: any) {
      if (e?.errno !== 1060) console.error(`Migration error for order_detail.${col}:`, e?.sqlMessage);
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

    // Fail-loud (but don't crash) if the JWT secret is left at the built-in
    // dev fallback — that secret is in source control and forgeable.
    if (!process.env.JWT_SECRET) {
      console.warn(
        '\n[SECURITY WARNING] JWT_SECRET is not set — using the hardcoded dev fallback. ' +
          'Set JWT_SECRET in the environment (EB env properties / .env) before serving real traffic.\n',
      );
    }

    // CORS allowlist.
    //   - CORS_ORIGINS="https://a.com,https://b.com" → only those browser
    //     origins are allowed (requests with no Origin header — native /
    //     Capacitor / same-origin / curl — are always allowed).
    //   - CORS_ORIGINS unset → fall back to reflecting any origin (previous
    //     behaviour) so nothing breaks, with a one-line warning.
    const allowlist = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    let corsOrigin: any;
    if (allowlist.length > 0) {
      corsOrigin = (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin || allowlist.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
      };
    } else {
      console.warn(
        '[SECURITY WARNING] CORS_ORIGINS is not set — reflecting all origins. ' +
          'Set CORS_ORIGINS to a comma-separated allowlist to restrict browser access.',
      );
      corsOrigin = true;
    }
    app.enableCors({
      origin: corsOrigin,
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
