# AWS Elastic Beanstalk Deployment Playbook

One NestJS backend on EB serves both React frontends as static assets.
Single origin → no CORS, single URL, lowest cost.

- `/`              → customer app (React/Vite)
- `/admin/`        → admin app (React/Vite, PWA)
- `/api/*`         → NestJS routes
- `/auth/*`        → NestJS auth
- `/public/*`      → uploaded/static files

RDS MySQL is already running. EB will connect to it via env vars.

---

## 0. One-time prerequisites (install on your Windows machine)

```bash
# AWS CLI v2 (installer): https://awscli.amazonaws.com/AWSCLIV2.msi
# Python 3 (for EB CLI): https://www.python.org/downloads/
pip install --upgrade awsebcli
aws --version
eb --version

# Configure AWS credentials (IAM user with AdministratorAccess-AWSElasticBeanstalk is easiest)
aws configure
# Enter: Access Key ID, Secret, region (e.g. ap-south-1), output json
```

---

## 1. RDS: make sure EB can reach it

In AWS Console → RDS → your DB → Connectivity & security → VPC security group.
Edit inbound rules and add:

- Type: **MySQL/Aurora (3306)**
- Source: the EB environment's security group (you'll create it in step 4; come back and add after EB env is created)

Also note your RDS endpoint, port, user, password, db name — you'll paste them as EB env vars in step 4.

---

## 2. Build everything locally (one script)

From the repo root `c:\Users\jaijh\OneDrive\Desktop\admin-customer\`:

```bash
# 2a. Build backend (nest -> dist/)
cd admin/backend
npm ci
npm run build

# 2b. Build admin frontend (vite -> dist/)
cd ../frontend
npm ci
npm run build

# 2c. Build customer frontend (vite -> dist/)
cd ../../customer
npm ci
npm run build

# 2d. Copy both front-end dists into the backend so ServeStaticModule finds them
cd ../admin/backend
rm -rf client
mkdir -p client/admin client/customer
cp -r ../frontend/dist/* client/admin/
cp -r ../../customer/dist/* client/customer/
```

After this, `admin/backend/` contains:
- `dist/`           → compiled NestJS
- `client/admin/`   → built admin SPA (served at `/admin`)
- `client/customer/`→ built customer SPA (served at `/`)
- `package.json`, `package-lock.json`, `Procfile`, `.ebextensions/`, `.ebignore`

---

## 3. Initialise Elastic Beanstalk (once)

```bash
cd admin/backend

eb init
# Select region (same as RDS, e.g. ap-south-1)
# Application name: admin-customer
# Platform: Node.js
# Platform branch: Node.js 20 running on 64bit Amazon Linux 2023
# SSH: y  (create a new keypair or pick existing — needed for debugging)
```

This creates `.elasticbeanstalk/config.yml` (do NOT commit secrets).

---

## 4. Create the EB environment

```bash
eb create admin-customer-prod \
  --instance-type t3.small \
  --single \
  --envvars NODE_ENV=production,PORT=8080,DB_HOST=<RDS_ENDPOINT>,DB_PORT=3306,DB_USERNAME=<USER>,DB_PASSWORD=<PASS>,DB_NAME=<DBNAME>,TALLY_URL=<TALLY_URL>,TALLY_COMPANY=<COMPANY>
```

Flags:
- `--single` = one EC2, no load balancer (cheapest; remove for HA + HTTPS via ALB).
- `t3.small` = 2 GB RAM, enough for NestJS + TypeORM.

While this runs (5–10 min), go back to **RDS security group** (step 1) and add inbound 3306 from the EB instance's security group (name usually `awseb-e-xxx-AWSEBSecurityGroup`).

---

## 5. Deploy

```bash
cd admin/backend
eb deploy
```

EB zips the folder (respecting `.ebignore`), uploads to S3, runs `npm ci --production`, then starts via `Procfile` (`node dist/main.js`).

---

## 6. Verify

```bash
eb status
eb health
eb logs            # tail recent logs
eb open            # opens the app URL in browser
```

Test endpoints:
- `https://<env>.elasticbeanstalk.com/`        → customer app
- `https://<env>.elasticbeanstalk.com/admin/`  → admin app
- `https://<env>.elasticbeanstalk.com/api`     → NestJS (should respond)

---

## 7. Updating env vars later

```bash
eb setenv DB_PASSWORD=newpass TALLY_URL=http://new
```

---

## 8. Redeploying after code changes

```bash
# from repo root
cd admin/backend && npm run build
cd ../frontend    && npm run build
cd ../../customer && npm run build
cd ../admin/backend
rm -rf client && mkdir -p client/admin client/customer
cp -r ../frontend/dist/* client/admin/
cp -r ../../customer/dist/* client/customer/
eb deploy
```

Consider adding a `deploy.sh` script later.

---

## 9. HTTPS (recommended before going live)

`--single` mode has no ALB, so HTTPS needs either:
1. Switch to load-balanced env: `eb config` → enable ALB + ACM cert, OR
2. Put CloudFront in front of the EB URL with ACM cert (keeps single instance cheap).

---

## 10. IMPORTANT production hardening

In [admin/backend/src/app.module.ts](admin/backend/src/app.module.ts#L48):
```ts
synchronize: true   // ← SET TO false BEFORE PRODUCTION
```
`synchronize: true` will alter your RDS schema on every boot. Turn it off and use migrations once your tables are stable.

Also:
- `.env` is in `.ebignore` — good. Never commit secrets; EB env vars are the source of truth.
- Rotate the DB password that currently sits in `admin/backend/.env` since it's on disk.

---

## Files changed/created for this deployment

| File | Purpose |
|---|---|
| `admin/backend/src/app.module.ts` | 2 new `ServeStaticModule` entries for admin & customer SPAs |
| `admin/backend/package.json` | `start` = `node dist/main.js`, added `engines.node >=18` |
| `admin/backend/Procfile` | EB process definition |
| `admin/backend/.ebignore` | Exclude source/node_modules/secrets from bundle |
| `admin/backend/.ebextensions/nodecommand.config` | NodeCommand, NODE_ENV, PORT |
| `admin/backend/.ebextensions/healthcheck.config` | Health check path `/api` |
| `admin/frontend/vite.config.ts` | `base: '/admin/'` so admin asset URLs work under `/admin` |
