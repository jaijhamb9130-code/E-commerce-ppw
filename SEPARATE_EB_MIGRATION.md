# Separate EB for cPanel Admin Portal — Shared RDS

Two independent Elastic Beanstalk environments, one shared database.

---

# STEP 1: Get Your RDS Details (You Already Have This)

```bash
# Get your RDS endpoint
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port,VpcSecurityGroups[0].VpcSecurityGroupId]' \
  --output table \
  --region ap-south-1

# SAVE THESE — you'll need them throughout:
# RDS_ENDPOINT = __________________________________ (e.g., admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com)
# RDS_PORT     = 3306
# RDS_SG_ID    = __________________________________ (e.g., sg-0abc123def)
# DB_USERNAME  = __________________________________
# DB_PASSWORD  = __________________________________
# DB_NAME      = tally_sync
```

---

# STEP 2: Get the cPanel Project Code on Your Local Machine

```bash
# Create a NEW folder for this project (separate from admin-customer)
cd ~/Desktop
mkdir admin-ppw
cd admin-ppw

# Option A: If cPanel project is already in Git
git clone https://github.com/YOUR-USERNAME/your-cpanel-project.git .

# Option B: Download from cPanel via SCP
scp -r username@your-cpanel-server.com:/path/to/nestjs-project/* .

# Option C: Download via cPanel File Manager
# cPanel → File Manager → select project → Compress → Download → extract here

# Verify you have the NestJS project
ls
# Should see: src/  package.json  tsconfig.json  nest-cli.json  etc.
```

---

# STEP 3: Make Sure It Builds Cleanly

```bash
cd ~/Desktop/admin-ppw

# Install dependencies
npm install

# Build
npm run build

# Verify dist/ folder was created
ls dist/
# Should see: main.js and other compiled files
```

If build fails, fix the errors before proceeding.

---

# STEP 4: Update Database Config to Use Environment Variables

Check how the cPanel project connects to the database:

```bash
# Find the database configuration
grep -r "DB_HOST\|DB_PORT\|DB_NAME\|TypeOrmModule\|host.*localhost\|host.*127" src/ --include="*.ts"
```

**Your app.module.ts (or wherever TypeORM is configured) MUST use environment variables, not hardcoded values.**

It should look like this:

```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'mysql',
    host: configService.get('DB_HOST', '127.0.0.1'),
    port: configService.get('DB_PORT', 3306),
    username: configService.get('DB_USERNAME', 'root'),
    password: configService.get('DB_PASSWORD', ''),
    database: configService.get('DB_NAME', 'tally_sync'),
    entities: [/* your entities */],
    synchronize: false,
  }),
}),
```

If it's using hardcoded values like `host: 'localhost'`, change them to use `configService.get()` or `process.env.DB_HOST`.

---

# STEP 5: Create a Procfile

```bash
cd ~/Desktop/admin-ppw

# Create Procfile (tells EB how to start your app)
echo 'web: node dist/main.js' > Procfile
```

---

# STEP 6: Initialize a NEW Elastic Beanstalk Application

```bash
cd ~/Desktop/admin-ppw

# Initialize EB — this creates a NEW application (not the existing admin-customer)
eb init

# It will ask you questions. Answer like this:
#
# Select a default region: ap-south-1 (same region as your RDS!)
# Enter Application Name: admin-ppw
# It appears you are using Node.js. Is this correct? Y
# Select a platform branch: Node.js 20 running on 64bit Amazon Linux 2023
# Do you wish to continue with CodeCommit? N
# Do you want to set up SSH for your instances? Y
# Select a keypair: admin-customer-key (reuse existing key)
```

Verify the config was created:

```bash
cat .elasticbeanstalk/config.yml
# Should show:
# global:
#   application_name: admin-ppw
#   default_region: ap-south-1
```

---

# STEP 7: Create the EB Environment with RDS Variables

```bash
cd ~/Desktop/admin-ppw

# Create a NEW environment under the admin-ppw application
# Replace the values with YOUR actual RDS details

eb create admin-ppw-prod \
  --instance-type t3.micro \
  --single \
  --envvars DB_HOST=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com,DB_PORT=3306,DB_USERNAME=admin,DB_PASSWORD=YourRDSPassword123,DB_NAME=tally_sync,PORT=8080,NODE_ENV=production

# --single       = single instance (no load balancer, cheaper for start)
# --instance-type = t3.micro is cheapest, upgrade later if needed
# --envvars      = these are your RDS connection details

# ⏳ This takes 5-10 minutes. Wait for it to complete.
# You'll see: "Successfully launched environment: admin-ppw-prod"
```

**If you want a load balancer (recommended for production):**

```bash
eb create admin-ppw-prod \
  --instance-type t3.micro \
  --elb-type application \
  --envvars DB_HOST=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com,DB_PORT=3306,DB_USERNAME=admin,DB_PASSWORD=YourRDSPassword123,DB_NAME=tally_sync,PORT=8080,NODE_ENV=production
```

---

# STEP 8: Allow NEW EB to Access the SAME RDS

The new EB environment gets its own security group. You need to allow
that security group to access RDS on port 3306.

```bash
# Step 8a: Find the security group of your NEW EB environment
aws ec2 describe-instances \
  --filters "Name=tag:elasticbeanstalk:environment-name,Values=admin-ppw-prod" \
  --query 'Reservations[0].Instances[0].SecurityGroups[*].[GroupId,GroupName]' \
  --output table \
  --region ap-south-1

# You'll see something like:
# sg-0new1234abcd   |   awseb-e-xxxxx-stack-AWSEBSecurityGroup-YYYY
#
# SAVE THIS: NEW_EB_SG = sg-0new1234abcd

# Step 8b: Allow the new EB security group to access RDS
# Replace sg-0abc123def with YOUR RDS security group (from Step 1)
# Replace sg-0new1234abcd with the NEW EB security group (from Step 8a)

aws ec2 authorize-security-group-ingress \
  --group-id sg-0abc123def \
  --protocol tcp \
  --port 3306 \
  --source-group sg-0new1234abcd \
  --region ap-south-1

# Verify it was added:
aws ec2 describe-security-groups \
  --group-ids sg-0abc123def \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`3306`]' \
  --output json \
  --region ap-south-1
```

**Using AWS Console instead:**
1. AWS Console → EC2 → Security Groups
2. Find your **RDS security group**
3. Edit inbound rules
4. Add rule:
   - Type: MySQL/Aurora
   - Port: 3306
   - Source: Custom → paste the NEW EB security group ID (sg-0new1234abcd)
   - Description: "admin-ppw EB environment"
5. Save

---

# STEP 9: Deploy the cPanel Project to the New EB

```bash
cd ~/Desktop/admin-ppw

# Make sure the build is fresh
npm run build

# Deploy
eb deploy admin-ppw-prod

# Watch the logs
eb logs -f

# Wait for health check
eb health

# Get your new EB URL
eb status
# Look for: CNAME: admin-ppw-prod.eba-xxxxx.ap-south-1.elasticbeanstalk.com
```

---

# STEP 10: Verify It Works

```bash
# Get the new EB URL
NEW_EB_URL=$(eb status | grep "CNAME" | awk '{print $2}')
echo "New EB URL: http://$NEW_EB_URL"

# Test health endpoint (if your app has one)
curl http://$NEW_EB_URL/api/health
# or
curl http://$NEW_EB_URL/

# Test auth (if applicable)
curl -X POST http://$NEW_EB_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-admin","password":"your-password"}'

# Open in browser
eb open
```

---

# STEP 11: Verify Both EBs Share the Same Database

```bash
# Test from EXISTING EB (admin-customer)
EXISTING_URL="http://admin-customer-prod.eba-ppzifyfu.ap-south-1.elasticbeanstalk.com"

# Test from NEW EB (admin-ppw)
NEW_URL="http://$NEW_EB_URL"

# Create something via one EB, verify it shows on the other
# Example: create a user via new EB
curl -X POST "$NEW_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test-shared-db","password":"test123","email":"shared@test.com"}'

# Verify that user exists via existing EB
curl -X POST "$EXISTING_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test-shared-db","password":"test123"}'

# If login works on BOTH → database is shared correctly ✅
```

---

# STEP 12: Migrate Data from cPanel MySQL to RDS

**Skip this step if the RDS already has all the data you need.**

If the cPanel MySQL has data that doesn't exist in RDS yet:

```bash
# SSH into cPanel
ssh username@your-cpanel-server.com

# Export cPanel database
mysqldump -u cpanel_user -p cpanel_database_name \
  --single-transaction \
  --set-gtid-purged=OFF \
  > /tmp/cpanel_export.sql

# Check size
ls -lh /tmp/cpanel_export.sql

# Now you need to import this into RDS.
# First, open RDS security group for cPanel IP temporarily:
# (run on your local machine)
CPANEL_IP=$(ssh username@your-cpanel-server.com "curl -s ifconfig.me")
aws ec2 authorize-security-group-ingress \
  --group-id sg-0abc123def \
  --protocol tcp \
  --port 3306 \
  --cidr $CPANEL_IP/32 \
  --region ap-south-1

# Back on cPanel server:
ssh username@your-cpanel-server.com

# Import into RDS (this sends data directly from cPanel to RDS)
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p tally_sync < /tmp/cpanel_export.sql

# Verify row counts
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p -e "
  USE tally_sync;
  SELECT 'users' as tbl, COUNT(*) as rows FROM users
  UNION ALL SELECT 'orders', COUNT(*) FROM orders
  UNION ALL SELECT 'ledgers', COUNT(*) FROM ledgers
  UNION ALL SELECT 'stock_items', COUNT(*) FROM stock_items;"

# IMPORTANT: Remove cPanel IP from RDS security group after migration
# (run on your local machine)
aws ec2 revoke-security-group-ingress \
  --group-id sg-0abc123def \
  --protocol tcp \
  --port 3306 \
  --cidr $CPANEL_IP/32 \
  --region ap-south-1
```

---

# STEP 13: Set Up CI/CD for the New EB (GitHub Actions)

Create `.github/workflows/deploy.yml` in the admin-ppw project:

```yaml
name: Deploy admin-ppw to Elastic Beanstalk

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

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Create deployment zip
        run: |
          zip -r deploy.zip \
            package.json \
            package-lock.json \
            Procfile \
            dist/ \
            -x "node_modules/*" ".env" "*.log" "src/*" "test/*"

      - name: Deploy to EB
        uses: einaregilsson/beanstalk-deploy@v22
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: admin-ppw
          environment_name: admin-ppw-prod
          region: ap-south-1
          version_label: gh-${{ github.run_number }}-${{ github.sha }}
          deployment_package: deploy.zip
          wait_for_environment_recovery: false

      - name: Verify deployment
        run: |
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            "http://admin-ppw-prod.eba-xxxxx.ap-south-1.elasticbeanstalk.com/")
          echo "Status: $STATUS"
          if [ "$STATUS" -ge 500 ]; then
            echo "Deploy verification FAILED"
            exit 1
          fi
          echo "Deploy verified ✅"
```

Push to GitHub:

```bash
cd ~/Desktop/admin-ppw

# Initialize Git repo (if not already)
git init
git add -A
git commit -m "Initial commit: admin-ppw for EB deployment"

# Create GitHub repo
gh repo create admin-ppw --private --source=. --push

# Add secrets (same AWS keys you use for admin-customer)
gh secret set AWS_ACCESS_KEY_ID --body "YOUR_ACCESS_KEY"
gh secret set AWS_SECRET_ACCESS_KEY --body "YOUR_SECRET_KEY"
```

---

# STEP 14: Point Your Domain to the New EB

```bash
# Get the new EB CNAME
eb status | grep CNAME
# Example: admin-ppw-prod.eba-xxxxx.ap-south-1.elasticbeanstalk.com

# In your domain registrar (GoDaddy, Route53, Namecheap, etc.):
#
# Record Type: CNAME
# Name:        admin    (for admin.ppw-website.com)
#              OR whatever subdomain you want
# Value:       admin-ppw-prod.eba-xxxxx.ap-south-1.elasticbeanstalk.com
# TTL:         300 (5 minutes)
```

**Using AWS Route53:**
```bash
# If your domain is in Route53:
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "admin.ppw-website.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "admin-ppw-prod.eba-xxxxx.ap-south-1.elasticbeanstalk.com"}]
      }
    }]
  }'
```

---

# STEP 15: SSL Certificate (HTTPS)

```bash
# Request a certificate for your domain
aws acm request-certificate \
  --domain-name admin.ppw-website.com \
  --validation-method DNS \
  --region ap-south-1

# Get the certificate ARN from output
# Then add HTTPS listener to your EB load balancer:

# If you created EB with --single (no load balancer):
# You'll need to switch to a load-balanced environment first:
# eb scale 1  (this adds a load balancer)
# OR recreate with: eb create admin-ppw-prod --elb-type application

# Add HTTPS:
aws elbv2 create-listener \
  --load-balancer-arn YOUR_ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=YOUR_CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=YOUR_TG_ARN
```

---

# STEP 16: Shut Down cPanel

**Only after 1-2 weeks of everything working on EB.**

```bash
# 1. Final backup
ssh username@your-cpanel-server.com
mysqldump -u cpanel_user -p cpanel_db > /tmp/final_backup.sql
tar -czf /tmp/cpanel_project_backup.tar.gz /path/to/project
# Download backups to your local machine
scp username@your-cpanel-server.com:/tmp/final_backup.sql ./backups/
scp username@your-cpanel-server.com:/tmp/cpanel_project_backup.tar.gz ./backups/

# 2. Stop the app on cPanel
ssh username@your-cpanel-server.com
pm2 stop all
# Or go to cPanel → Node.js → Stop

# 3. Set up a redirect (optional, keeps old URLs working)
# In cPanel → Redirects:
# Type: 301 (permanent)
# From: your-cpanel-domain.com
# To: https://admin.ppw-website.com

# 4. Cancel cPanel hosting when ready
```

---

# QUICK REFERENCE: What's Running Where

```
AFTER MIGRATION:

┌──────────────────────────────┐    ┌──────────────────────────────┐
│  EB 1: admin-customer-prod   │    │  EB 2: admin-ppw-prod        │
│  URL: admin-customer-prod.   │    │  URL: admin-ppw-prod.        │
│    eba-ppzifyfu.ap-south-1.  │    │    eba-xxxxx.ap-south-1.     │
│    elasticbeanstalk.com      │    │    elasticbeanstalk.com       │
│                              │    │                              │
│  Serves:                     │    │  Serves:                     │
│  - Admin frontend  (/admin)  │    │  - Portal frontend (/)       │
│  - Customer frontend (/)     │    │  - Portal API      (/api)    │
│  - Shared API      (/api)    │    │                              │
│                              │    │  Domain:                     │
│  Domain:                     │    │  admin.ppw-website.com       │
│  your-existing-domain.com    │    │                              │
└──────────────┬───────────────┘    └──────────────┬───────────────┘
               │                                   │
               │          SAME DATABASE            │
               ▼                                   ▼
        ┌──────────────────────────────────────────────┐
        │              AWS RDS MySQL                   │
        │              Database: tally_sync            │
        │              Region: ap-south-1              │
        │                                              │
        │  Tables:                                     │
        │  users, orders, order_details, ledgers,     │
        │  stock_items, customers, addresses,          │
        │  meta, item_details, item_images            │
        └──────────────────────────────────────────────┘
```

---

# COST ESTIMATE

| Resource | Monthly Cost (approx) |
|----------|----------------------|
| EB 1 (admin-customer) t3.micro | ~$8-10 |
| EB 2 (admin-ppw) t3.micro | ~$8-10 |
| RDS db.t3.micro (shared) | ~$15-18 |
| **Total** | **~$31-38/month** |

Compared to cPanel hosting ($10-30/month) + existing AWS (~$25), this is roughly the same cost but with better reliability and scaling.

---

# COMPLETE CHECKLIST

- [ ] Step 1: Note down RDS endpoint, security group, credentials
- [ ] Step 2: Get cPanel project code onto your local machine
- [ ] Step 3: Verify it builds (`npm run build`)
- [ ] Step 4: Ensure DB config uses environment variables (not hardcoded)
- [ ] Step 5: Create Procfile
- [ ] Step 6: Run `eb init` → creates admin-ppw application
- [ ] Step 7: Run `eb create admin-ppw-prod` with `--envvars` for RDS details
- [ ] Step 8: **Open RDS security group for new EB's security group** ← CRITICAL
- [ ] Step 9: Run `eb deploy`
- [ ] Step 10: Test the new EB URL in browser
- [ ] Step 11: Verify both EBs read/write same database
- [ ] Step 12: Migrate data from cPanel MySQL to RDS (if needed)
- [ ] Step 13: Set up GitHub Actions CI/CD
- [ ] Step 14: Point domain to new EB
- [ ] Step 15: Add SSL certificate
- [ ] Step 16: Shut down cPanel (after 1-2 weeks)
