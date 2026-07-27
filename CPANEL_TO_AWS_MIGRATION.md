# Complete Guide: cPanel Admin Portal → AWS RDS + Elastic Beanstalk

## Your Current Architecture

```
CURRENTLY:
                                                          
┌──────────────────────────────┐    ┌──────────────────────────────┐
│      AWS (Elastic Beanstalk) │    │       cPanel Server           │
│                              │    │                              │
│  NestJS Backend              │    │  NestJS Admin Portal         │
│  ├── Admin Frontend   (/admin)│    │  ├── Its own frontend       │
│  ├── Customer Frontend (/)   │    │  └── Its own backend         │
│  └── API             (/api)  │    │                              │
│         │                    │    │         │                    │
│         ▼                    │    │         ▼                    │
│  ┌────────────┐              │    │  ┌────────────┐              │
│  │ AWS RDS    │              │    │  │ cPanel     │              │
│  │ MySQL      │              │    │  │ MySQL      │              │
│  │ tally_sync │              │    │  │ (same      │              │
│  └────────────┘              │    │  │  tables)   │              │
└──────────────────────────────┘    └──────────────────────────────┘
         ▲                                    ▲
    Same tables                          Same tables
    (orders, users,                      (orders, users,
     ledgers, etc.)                       ledgers, etc.)
```

## Target Architecture

```
AFTER MIGRATION:

┌─────────────────────────────────────────────────────┐
│              AWS (Single Elastic Beanstalk)          │
│                                                     │
│  NestJS Backend (merged)                            │
│  ├── Admin Frontend        (/admin)                 │
│  ├── Customer Frontend     (/)                      │
│  ├── cPanel Admin Portal   (/portal)                │
│  └── API (merged modules)  (/api)                   │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────┐                               │
│  │ AWS RDS MySQL    │                               │
│  │ tally_sync       │                               │
│  │ (single source   │                               │
│  │  of truth)       │                               │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

---

# ═══════════════════════════════════════════════════
# PHASE 1: Connect cPanel Admin Portal to AWS RDS
# ═══════════════════════════════════════════════════

This phase keeps the cPanel portal running on cPanel, but switches its
database from local MySQL to your AWS RDS instance.

---

## Step 1.1: Get Your cPanel Server's Public IP

```bash
# SSH into your cPanel server OR run this from cPanel Terminal
curl ifconfig.me
# Example output: 103.21.58.47

# Save this IP — you'll need it for the security group
```

**Alternative:** Check your cPanel hosting provider's dashboard for the server IP.

---

## Step 1.2: Get Your RDS Endpoint and Security Group

```bash
# On your local machine (with AWS CLI configured)

# Get RDS endpoint
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port,VpcSecurityGroups[0].VpcSecurityGroupId]' \
  --output table \
  --region ap-south-1

# You'll see something like:
# ┌─────────────────────┬──────────────────────────────────────────────┬──────┬─────────────────┐
# │ admin-customer-db   │ admin-customer-db.xxxxx.ap-south-1.rds...   │ 3306 │ sg-0abc123def   │
# └─────────────────────┴──────────────────────────────────────────────┴──────┴─────────────────┘

# SAVE THESE VALUES:
# RDS_ENDPOINT = admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
# RDS_PORT     = 3306
# RDS_SG_ID    = sg-0abc123def
```

---

## Step 1.3: Open RDS Security Group to Allow cPanel Server

```bash
# Allow your cPanel server's IP to access RDS on port 3306
# Replace sg-0abc123def with YOUR RDS security group ID
# Replace 103.21.58.47 with YOUR cPanel server IP

aws ec2 authorize-security-group-ingress \
  --group-id sg-0abc123def \
  --protocol tcp \
  --port 3306 \
  --cidr 103.21.58.47/32 \
  --region ap-south-1

# Verify it was added:
aws ec2 describe-security-groups \
  --group-ids sg-0abc123def \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json \
  --region ap-south-1

# You should see your cPanel IP in the output
```

**If using AWS Console instead:**
1. Go to AWS Console → EC2 → Security Groups
2. Find the security group attached to your RDS instance
3. Click "Edit inbound rules"
4. Add rule:
   - Type: MySQL/Aurora
   - Protocol: TCP
   - Port: 3306
   - Source: Custom → `103.21.58.47/32` (your cPanel IP)
   - Description: "cPanel admin portal"
5. Save rules

---

## Step 1.4: Test Connection from cPanel to RDS

```bash
# SSH into your cPanel server
ssh username@your-cpanel-server.com

# Test MySQL connection to RDS
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin \
  -p \
  -P 3306

# Enter your RDS password when prompted

# If successful, you'll see:
# Welcome to the MySQL monitor.
# mysql>

# Verify the database exists:
SHOW DATABASES;
USE tally_sync;
SHOW TABLES;
EXIT;
```

**If connection fails:**
```bash
# Test if port 3306 is reachable
telnet admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com 3306

# Or use nc (netcat)
nc -zv admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com 3306

# If timeout → security group is blocking. Double-check Step 1.3
# If connection refused → RDS might not be publicly accessible
```

**If RDS is NOT publicly accessible** (recommended for security), you have two options:

**Option A: Make RDS temporarily publicly accessible:**
```bash
aws rds modify-db-instance \
  --db-instance-identifier admin-customer-db \
  --publicly-accessible \
  --apply-immediately \
  --region ap-south-1

# Wait 2-3 minutes for changes to take effect
```

**Option B: Keep RDS private and use SSH tunnel (more secure):**
```bash
# From cPanel server, SSH tunnel through your EB EC2 instance
# First, get your EB EC2's public IP
aws ec2 describe-instances \
  --filters "Name=tag:elasticbeanstalk:environment-name,Values=admin-customer-prod" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text \
  --region ap-south-1

# Create SSH tunnel from cPanel to RDS via EB EC2
ssh -i admin-customer-key.pem -L 3307:admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com:3306 ec2-user@EB_PUBLIC_IP -N -f

# Now connect through tunnel on port 3307
mysql -h 127.0.0.1 -P 3307 -u admin -p
```

---

## Step 1.5: Migrate Data from cPanel MySQL to AWS RDS

**CRITICAL: Since both databases have the SAME tables, you need to decide
which database has the authoritative data.**

### Option A: cPanel has the primary data (most common)

```bash
# Step 1: Export from cPanel MySQL
# SSH into cPanel server
ssh username@your-cpanel-server.com

# Dump the cPanel database
mysqldump -u cpanel_db_user -p cpanel_database_name \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  > /tmp/cpanel_backup.sql

# Check file size
ls -lh /tmp/cpanel_backup.sql

# Step 2: Import into AWS RDS
# From cPanel server (since you opened the security group)
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p tally_sync < /tmp/cpanel_backup.sql

# Verify
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p -e "USE tally_sync; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM ledgers;"
```

### Option B: AWS RDS already has the primary data

```bash
# No migration needed! Just point cPanel to RDS.
# Skip to Step 1.6
```

### Option C: Both have data that needs to be merged

```bash
# Step 1: Export cPanel data
mysqldump -u cpanel_db_user -p cpanel_database_name \
  --no-create-info \
  --single-transaction \
  --insert-ignore \
  > /tmp/cpanel_data_only.sql

# Step 2: Import with INSERT IGNORE (won't overwrite existing rows)
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p tally_sync < /tmp/cpanel_data_only.sql

# Step 3: Verify counts match expectations
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p -e "
    USE tally_sync;
    SELECT 'users' as tbl, COUNT(*) as cnt FROM users
    UNION ALL
    SELECT 'orders', COUNT(*) FROM orders
    UNION ALL
    SELECT 'ledgers', COUNT(*) FROM ledgers
    UNION ALL
    SELECT 'stock_items', COUNT(*) FROM stock_items;
  "
```

---

## Step 1.6: Update cPanel Admin Portal to Use AWS RDS

### Find the database config on your cPanel project

```bash
# SSH into cPanel
ssh username@your-cpanel-server.com

# Navigate to your NestJS project
cd /path/to/your/nestjs-project

# Find the database configuration
# Check .env file
cat .env

# Or check app.module.ts
cat src/app.module.ts | grep -A 10 "TypeOrm"

# Or search for DB config
grep -r "DB_HOST\|DB_PORT\|DB_NAME\|DB_PASSWORD\|DB_USERNAME\|database\|host.*3306" src/ .env* --include="*.ts" --include="*.env"
```

### Update the .env file

```bash
# Edit the .env file on cPanel
nano .env  # or vi .env

# CHANGE these values:
# FROM (cPanel local):
# DB_HOST=localhost
# DB_PORT=3306
# DB_USERNAME=cpanel_user
# DB_PASSWORD=cpanel_password
# DB_NAME=cpanel_database_name

# TO (AWS RDS):
DB_HOST=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_USERNAME=admin
DB_PASSWORD=YourRDSPassword123!
DB_NAME=tally_sync

# Save and exit (Ctrl+X, Y, Enter for nano)
```

### Rebuild and restart the app on cPanel

```bash
# Rebuild
npm run build

# Restart (depends on your cPanel setup)
# If using PM2:
pm2 restart all
pm2 logs

# If using Node.js application on cPanel:
# Go to cPanel → Setup Node.js App → Restart
# Or:
touch tmp/restart.txt

# If running directly:
pkill -f "node dist/main"
nohup node dist/main.js &
```

---

## Step 1.7: Verify cPanel is Using AWS RDS

```bash
# Test the API
curl http://your-cpanel-domain.com/api/health
# Should return: {"status":"ok"} or similar

# Test authentication
curl -X POST http://your-cpanel-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-admin","password":"your-password"}'
# Should return a JWT token if credentials exist in RDS

# Check RDS for connection activity
aws rds describe-db-instances \
  --db-instance-identifier admin-customer-db \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region ap-south-1
# Should show: "available"

# Verify connections from cPanel
# SSH into cPanel and check:
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p -e "SHOW PROCESSLIST;"
# Should show connections from both EB and cPanel IPs
```

---

## Step 1.8: Stop Using cPanel Local MySQL

```bash
# Once everything is confirmed working with RDS:

# 1. Keep cPanel MySQL backup (safety net)
ssh username@your-cpanel-server.com
mysqldump -u cpanel_user -p cpanel_database_name > /tmp/cpanel_final_backup_$(date +%Y%m%d).sql

# 2. The cPanel MySQL is now just a backup — all reads/writes go to RDS
# 3. Do NOT delete the cPanel database yet (keep as fallback for 1 week)
```

---

# ✅ PHASE 1 COMPLETE
# cPanel admin portal now reads/writes to AWS RDS (tally_sync)
# Both your EB app and cPanel app share the same database

```
AFTER PHASE 1:
                                                          
┌──────────────────────────────┐    ┌──────────────────────────────┐
│      AWS (Elastic Beanstalk) │    │       cPanel Server           │
│                              │    │                              │
│  NestJS Backend              │    │  NestJS Admin Portal         │
│  ├── Admin Frontend          │    │  ├── Its own frontend        │
│  ├── Customer Frontend       │    │  └── Its own backend         │
│  └── API                     │    │         │                    │
│         │                    │    │         │                    │
│         ▼                    │    │         │                    │
│  ┌─────────────────────────────────────────────┐                │
│  │         AWS RDS MySQL (tally_sync)          │ ◄──────────────┘
│  │         SINGLE SOURCE OF TRUTH              │
│  │         Both apps connected here            │
│  └─────────────────────────────────────────────┘
└──────────────────────────────┘
```

---

# ═══════════════════════════════════════════════════
# PHASE 2: Migrate cPanel Admin Portal to Same EB
# ═══════════════════════════════════════════════════

Now we'll move the cPanel NestJS admin portal INTO the same Elastic
Beanstalk environment, merging it with your existing admin+customer app.

Since both apps are NestJS and share the same database tables, we'll
merge the cPanel app's modules into the existing backend.

---

## Step 2.1: Get the cPanel Project Code to Your Local Machine

```bash
# Option A: If cPanel project is in Git
git clone https://github.com/your-username/cpanel-admin-portal.git
# Or pull from wherever your repo is

# Option B: If no Git — download from cPanel
# Using SCP (secure copy)
scp -r username@your-cpanel-server.com:/path/to/nestjs-project ./cpanel-admin-portal

# Option C: Using cPanel File Manager
# Go to cPanel → File Manager → Select project folder → Compress → Download
# Then extract locally:
unzip cpanel-admin-portal.zip -d ./cpanel-admin-portal
```

---

## Step 2.2: Analyze the cPanel Project Structure

```bash
# Look at what modules and features the cPanel project has
cd cpanel-admin-portal

# Check the project structure
find src -type f -name "*.ts" | head -50

# Check entities (should match your existing ones)
ls src/entities/

# Check modules
ls src/

# Check app.module.ts to see all imported modules
cat src/app.module.ts

# Check what routes/controllers exist
grep -r "@Controller\|@Get\|@Post\|@Put\|@Delete" src/ --include="*.ts" | head -30

# Check for unique features NOT in your admin-customer project
# Save this list — these are what you need to merge
```

**Document everything unique in the cPanel project:**
- [ ] Unique controllers (routes that don't exist in admin-customer)
- [ ] Unique services (business logic specific to cPanel portal)
- [ ] Unique entities (any tables not in admin-customer)
- [ ] Unique middleware or guards
- [ ] Frontend assets (the admin portal UI)
- [ ] Environment variables specific to cPanel project
- [ ] npm packages that admin-customer doesn't have

---

## Step 2.3: Copy Unique Modules into Admin-Customer

```bash
# Navigate to your admin-customer project
cd /c/Users/jaijh/OneDrive/Desktop/admin-customer

# Create a directory for the new portal's frontend
mkdir -p portal

# ──────────────────────────────
# A) COPY FRONTEND (cPanel admin portal UI)
# ──────────────────────────────

# If the cPanel project has a separate frontend folder:
cp -r /path/to/cpanel-admin-portal/frontend/* portal/
# OR if it's a monorepo like yours:
cp -r /path/to/cpanel-admin-portal/admin/frontend/* portal/

# Install frontend dependencies
cd portal
npm install
cd ..

# ──────────────────────────────
# B) MERGE BACKEND MODULES
# ──────────────────────────────

# Copy unique modules from cPanel into admin/backend/src/
# ONLY copy modules that DON'T already exist in admin-customer

# Example: If cPanel has a "reports" module that admin-customer doesn't:
cp -r /path/to/cpanel-admin-portal/src/reports admin/backend/src/

# Example: If cPanel has a "dashboard" module:
cp -r /path/to/cpanel-admin-portal/src/dashboard admin/backend/src/

# Example: If cPanel has unique services:
cp /path/to/cpanel-admin-portal/src/services/unique-service.ts admin/backend/src/services/

# ──────────────────────────────
# C) CHECK FOR CONFLICTING ENTITIES
# ──────────────────────────────

# Since both use the same tables, entities SHOULD be identical.
# Compare them:
diff /path/to/cpanel-admin-portal/src/entities/ admin/backend/src/entities/

# If there are differences:
# - If cPanel entity has MORE fields → update the admin-customer entity
# - If admin-customer entity has MORE fields → keep the admin-customer version
# - If fields differ → merge carefully (keep all fields from both)
```

---

## Step 2.4: Update the Backend to Serve the New Portal

Edit `admin/backend/src/app.module.ts` to add the new portal as a third static site:

```typescript
// In app.module.ts, add to the ServeStaticModule configuration:

ServeStaticModule.forRoot(
  // Existing: Admin frontend at /admin
  {
    rootPath: join(__dirname, '..', 'client', 'admin'),
    serveRoot: '/admin',
    exclude: ['/api/(.*)', '/auth/(.*)'],
  },
  // NEW: Portal frontend at /portal
  {
    rootPath: join(__dirname, '..', 'client', 'portal'),
    serveRoot: '/portal',
    exclude: ['/api/(.*)', '/auth/(.*)'],
  },
  // Existing: Customer frontend at /
  {
    rootPath: join(__dirname, '..', 'client', 'customer'),
    serveRoot: '/',
    exclude: ['/api/(.*)', '/auth/(.*)', '/public/(.*)', '/admin/(.*)', '/portal/(.*)'],
  },
),
```

---

## Step 2.5: Register New Modules in AppModule

Edit `admin/backend/src/app.module.ts` to import the merged modules:

```typescript
// Add imports for any NEW modules from the cPanel project
// Example:
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    // ... existing imports ...
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({ ... }),
    AuthModule,
    ItemDetailsModule,
    ScheduleModule.forRoot(),
    
    // NEW modules from cPanel project:
    ReportsModule,      // if it exists
    DashboardModule,    // if it exists
    // ... add all unique modules here
  ],
})
export class AppModule {}
```

---

## Step 2.6: Install Any Missing npm Packages

```bash
cd admin/backend

# Compare package.json files
diff <(cat package.json | jq '.dependencies' | sort) \
     <(cat /path/to/cpanel-admin-portal/package.json | jq '.dependencies' | sort)

# Install any packages that exist in cPanel but not in admin-customer
# Example:
npm install package-name-1 package-name-2

# Common ones that might be missing:
# npm install @nestjs/swagger swagger-ui-express  (if cPanel has Swagger)
# npm install nodemailer @nestjs-modules/mailer    (if cPanel sends emails)
# npm install class-validator class-transformer     (if cPanel uses validation)
```

---

## Step 2.7: Update the Portal Frontend's API Base URL

```bash
# Edit the portal frontend's API configuration
# Find where it sets the API base URL

cd portal

# Search for API URL config
grep -r "baseURL\|API_URL\|VITE_API\|localhost\|api" src/ --include="*.ts" --include="*.tsx" --include="*.env*" | head -20

# Common locations:
# - src/api.ts or src/services/api.ts
# - .env or .env.production
# - src/config.ts
```

Update the API URL to use relative paths (since it'll be served from the same domain):

```typescript
// In portal's API config file (e.g., src/api.ts or src/lib/axios.ts)

// CHANGE FROM:
// const API_URL = 'http://cpanel-domain.com/api';
// OR:
// const API_URL = 'http://localhost:3000/api';

// CHANGE TO:
const API_URL = '/api';

// This works because the portal frontend will be served by the same
// NestJS backend that handles /api routes
```

Or if using Vite `.env`:

```bash
# portal/.env.production
VITE_API_URL=/api
```

---

## Step 2.8: Update the GitHub Actions Workflow

Edit `.github/workflows/deploy.yml` to include the portal frontend build:

```yaml
name: Deploy to Elastic Beanstalk

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      # ── Build Customer Frontend ──
      - name: Build customer frontend
        working-directory: customer
        run: |
          npm ci
          npm run build

      # ── Build Admin Frontend ──
      - name: Build admin frontend
        working-directory: admin/frontend
        run: |
          npm ci
          npm run build

      # ── Build Portal Frontend (NEW) ──
      - name: Build portal frontend
        working-directory: portal
        run: |
          npm ci
          npm run build

      # ── Build Backend ──
      - name: Build backend
        working-directory: admin/backend
        run: |
          npm ci
          npm run build

      # ── Assemble Deployment Package ──
      - name: Prepare deployment
        working-directory: admin/backend
        run: |
          # Copy admin frontend
          mkdir -p client/admin
          cp -r ../frontend/dist/* client/admin/

          # Copy customer frontend
          mkdir -p client/customer
          cp -r ../../customer/dist/* client/customer/

          # Copy portal frontend (NEW)
          mkdir -p client/portal
          cp -r ../../portal/dist/* client/portal/

      # ── Create ZIP ──
      - name: Create deployment zip
        working-directory: admin/backend
        run: |
          zip -r ../../deploy.zip \
            package.json \
            package-lock.json \
            Procfile \
            dist/ \
            client/ \
            .ebextensions/ \
            -x "node_modules/*" ".env" "*.log"

      # ── Deploy to EB ──
      - name: Deploy to EB
        uses: einaregilsson/beanstalk-deploy@v22
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: admin-customer
          environment_name: admin-customer-prod
          region: ap-south-1
          version_label: gh-${{ github.run_number }}-${{ github.sha }}
          deployment_package: deploy.zip
          wait_for_environment_recovery: false

      # ── Verify ──
      - name: Verify deployment
        run: |
          sleep 30
          EB_URL="http://admin-customer-prod.eba-ppzifyfu.ap-south-1.elasticbeanstalk.com"
          
          # Test API
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$EB_URL/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"username":"test","password":"test"}')
          echo "API status: $STATUS"
          
          # Test portal loads
          PORTAL=$(curl -s -o /dev/null -w "%{http_code}" "$EB_URL/portal/")
          echo "Portal status: $PORTAL"
          
          if [ "$STATUS" -ge 500 ] || [ "$PORTAL" -ge 500 ]; then
            echo "Deployment verification failed!"
            exit 1
          fi
```

---

## Step 2.9: Build and Test Locally

```bash
cd /c/Users/jaijh/OneDrive/Desktop/admin-customer

# 1. Build portal frontend
cd portal
npm install
npm run build
cd ..

# 2. Copy portal build to backend's client directory
mkdir -p admin/backend/client/portal
cp -r portal/dist/* admin/backend/client/portal/

# 3. Build backend
cd admin/backend
npm install
npm run build

# 4. Start locally
# Set environment variables for local testing
export DB_HOST=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
export DB_PORT=3306
export DB_USERNAME=admin
export DB_PASSWORD=YourPassword123!
export DB_NAME=tally_sync
export PORT=3000

npm run start:dev

# 5. Test in browser:
# Admin:    http://localhost:3000/admin/
# Customer: http://localhost:3000/
# Portal:   http://localhost:3000/portal/    ← NEW
# API:      http://localhost:3000/api/
```

---

## Step 2.10: Deploy to Elastic Beanstalk

```bash
# Option A: Push to GitHub (triggers CI/CD automatically)
cd /c/Users/jaijh/OneDrive/Desktop/admin-customer

git add -A
git commit -m "Add cPanel admin portal as /portal route in EB deployment"
git push origin main

# Watch the GitHub Actions workflow:
# Go to: https://github.com/YOUR-USERNAME/admin-customer/actions

# Option B: Manual EB deploy
cd admin/backend
eb deploy admin-customer-prod

# Monitor
eb logs -f
eb health -w
```

---

## Step 2.11: Verify Everything Works on EB

```bash
EB_URL="http://admin-customer-prod.eba-ppzifyfu.ap-south-1.elasticbeanstalk.com"

# Test Admin Frontend
curl -s -o /dev/null -w "Admin: %{http_code}\n" "$EB_URL/admin/"

# Test Customer Frontend
curl -s -o /dev/null -w "Customer: %{http_code}\n" "$EB_URL/"

# Test NEW Portal Frontend
curl -s -o /dev/null -w "Portal: %{http_code}\n" "$EB_URL/portal/"

# Test API
curl -s -o /dev/null -w "API: %{http_code}\n" -X POST "$EB_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Expected output:
# Admin: 200
# Customer: 200
# Portal: 200
# API: 400 or 401 (expected — invalid credentials)
```

---

## Step 2.12: Update DNS / Redirect cPanel Domain

```bash
# If you want the old cPanel domain to point to the EB portal:

# Option A: DNS CNAME redirect
# In your domain registrar, update the DNS:
# portal.yourdomain.com → CNAME → admin-customer-prod.eba-ppzifyfu.ap-south-1.elasticbeanstalk.com

# Option B: HTTP redirect from cPanel
# Add to .htaccess on cPanel:
# RewriteEngine On
# RewriteRule ^(.*)$ http://admin-customer-prod.eba-ppzifyfu.ap-south-1.elasticbeanstalk.com/portal/$1 [R=301,L]
```

---

## Step 2.13: Decommission cPanel

Only do this AFTER confirming everything works on EB for at least 1-2 weeks.

```bash
# 1. Final backup of cPanel project (safety)
ssh username@your-cpanel-server.com
tar -czf /tmp/cpanel-admin-final-backup.tar.gz /path/to/project
scp username@your-cpanel-server.com:/tmp/cpanel-admin-final-backup.tar.gz ./backups/

# 2. Remove cPanel server IP from RDS security group
aws ec2 revoke-security-group-ingress \
  --group-id sg-0abc123def \
  --protocol tcp \
  --port 3306 \
  --cidr 103.21.58.47/32 \
  --region ap-south-1

# 3. Stop the Node.js app on cPanel
ssh username@your-cpanel-server.com
pm2 stop all  # or however you stop it

# 4. Cancel cPanel hosting (when you're ready)
# Contact your hosting provider
```

---

# ═══════════════════════════════════════════════
# COMPLETE CHECKLIST
# ═══════════════════════════════════════════════

## Phase 1: Connect cPanel to RDS
- [ ] 1.1 Get cPanel server's public IP
- [ ] 1.2 Get RDS endpoint and security group ID
- [ ] 1.3 Open RDS security group for cPanel IP
- [ ] 1.4 Test MySQL connection from cPanel to RDS
- [ ] 1.5 Migrate data (cPanel MySQL → RDS)
- [ ] 1.6 Update cPanel .env to point to RDS
- [ ] 1.7 Verify cPanel app works with RDS
- [ ] 1.8 Keep cPanel MySQL as backup for 1 week

## Phase 2: Merge into EB
- [ ] 2.1 Get cPanel project code locally
- [ ] 2.2 Analyze cPanel project structure
- [ ] 2.3 Copy unique modules into admin-customer
- [ ] 2.4 Update ServeStaticModule for /portal route
- [ ] 2.5 Register new modules in AppModule
- [ ] 2.6 Install missing npm packages
- [ ] 2.7 Update portal frontend API base URL to /api
- [ ] 2.8 Update GitHub Actions workflow
- [ ] 2.9 Build and test locally
- [ ] 2.10 Deploy to EB
- [ ] 2.11 Verify all 3 frontends + API work
- [ ] 2.12 Update DNS / redirect old cPanel domain
- [ ] 2.13 Decommission cPanel (after 1-2 weeks)

---

# ═══════════════════════════════════════════════
# TROUBLESHOOTING
# ═══════════════════════════════════════════════

## "Can't connect to RDS from cPanel"
```bash
# Check 1: Is the security group open?
aws ec2 describe-security-groups --group-ids sg-0abc123def --region ap-south-1

# Check 2: Is RDS publicly accessible?
aws rds describe-db-instances \
  --db-instance-identifier admin-customer-db \
  --query 'DBInstances[0].PubliclyAccessible' \
  --region ap-south-1

# Check 3: Can cPanel reach port 3306?
telnet admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com 3306
```

## "Data mismatch after migration"
```bash
# Compare row counts between cPanel and RDS
# On cPanel:
mysql -u cpanel_user -p cpanel_db -e "SELECT COUNT(*) FROM users;"
# On RDS:
mysql -h rds-endpoint -u admin -p tally_sync -e "SELECT COUNT(*) FROM users;"
```

## "Portal gives 404 after EB deploy"
```bash
# SSH into EB and check if portal files exist
eb ssh
ls -la /var/www/html/client/portal/
# Should contain: index.html, assets/, etc.
```

## "API routes conflict between old and new modules"
```bash
# Check for duplicate route paths
grep -r "@Controller\|@Get\|@Post" admin/backend/src/ --include="*.ts" | sort
# Look for duplicate paths and rename one
```

## "cPanel app crashes after switching to RDS"
```bash
# Check if table structure matches
# On cPanel:
mysqldump -u cpanel_user -p cpanel_db --no-data > cpanel_schema.sql
# On RDS:
mysqldump -h rds-endpoint -u admin -p tally_sync --no-data > rds_schema.sql
# Compare:
diff cpanel_schema.sql rds_schema.sql
```
