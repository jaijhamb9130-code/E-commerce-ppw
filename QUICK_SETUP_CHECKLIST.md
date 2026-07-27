# Quick Setup Checklist - Multi-Website RDS on EB

## Phase 1: AWS Infrastructure Setup (20-30 mins)

### ☐ 1.1 Create RDS Database
```bash
# Copy-paste this command (replace values as needed)
aws rds create-db-instance \
  --db-instance-identifier admin-customer-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password 'MySecurePassword123!' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --publicly-accessible false \
  --region ap-south-1

# ⏳ Wait 5-10 minutes for RDS to be created
# ✅ Verify: Go to AWS Console → RDS → Databases → Look for admin-customer-db (Status: Available)
```

### ☐ 1.2 Get RDS Endpoint
```bash
# Run this to get your RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier admin-customer-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text \
  --region ap-south-1

# Copy the output (looks like: admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com)
# Save it for later
```

### ☐ 1.3 Configure Security Group
```bash
# Get your EB security group ID first
# Then allow RDS access from EB:
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxx \
  --protocol tcp \
  --port 3306 \
  --source-security-group sg-eb-xxxxx \
  --region ap-south-1
```

### ☐ 1.4 Test RDS Connection
```bash
# From your local machine (if RDS is publicly accessible)
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p

# Password: MySecurePassword123!
# Command: SHOW DATABASES;
# Expected: Should show databases list
```

---

## Phase 2: Database Schema Setup (10 mins)

### ☐ 2.1 Create Initial Database
```bash
# Connect to RDS (see Phase 1.4)
# Then run:
CREATE DATABASE admin_customer;
USE admin_customer;
```

### ☐ 2.2 Create Websites Table
```sql
-- Paste this entire SQL block into mysql client
CREATE TABLE IF NOT EXISTS websites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  domain VARCHAR(255),
  api_key VARCHAR(255) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO websites (id, name, slug, domain) VALUES
(1, 'Admin Portal', 'admin', 'admin.example.com'),
(2, 'Customer Portal', 'customer', 'customer.example.com');
```

### ☐ 2.3 Create Users Table
```sql
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  website_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
  UNIQUE KEY unique_email_per_website (website_id, email),
  INDEX idx_website_id (website_id)
);
```

### ☐ 2.4 Create Other Tables (Products, Orders, etc.)
```sql
-- Refer to MULTI_WEBSITE_RDS_GUIDE.md section 2.2 for complete schema
-- Copy-paste each CREATE TABLE statement
```

---

## Phase 3: NestJS Code Updates (30-40 mins)

### ☐ 3.1 Create Website Entity
Create file: `admin/backend/src/entities/website.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('websites')
export class Website {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  domain: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.website)
  users: User[];
}
```

### ☐ 3.2 Update User Entity
Edit: `admin/backend/src/entities/user.entity.ts`
```typescript
// Add these imports at top:
import { ManyToOne, JoinColumn } from 'typeorm';
import { Website } from './website.entity';

// Add these fields to the User class:
@Column()
websiteId: number;

@ManyToOne(() => Website, (website) => website.users, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'website_id' })
website: Website;

// Make email unique per website (update unique constraint)
// Change from: @Column({ unique: true })
// To:
@Column()
// Then add composite unique constraint to decorator on class
```

### ☐ 3.3 Create Website Interceptor
Create file: `admin/backend/src/common/interceptors/website.interceptor.ts`
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class WebsiteInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const websiteId = this.extractWebsiteId(request);
    request.websiteId = websiteId;
    return next.handle();
  }

  private extractWebsiteId(request: any): number {
    // Check header first
    if (request.headers['x-website-id']) {
      return parseInt(request.headers['x-website-id'], 10);
    }
    // Check subdomain
    const host = request.headers.host || '';
    if (host.startsWith('admin.')) return 1;
    if (host.startsWith('customer.')) return 2;
    // Default to 1
    return 1;
  }
}
```

### ☐ 3.4 Register Interceptor in App Module
Edit: `admin/backend/src/app.module.ts`
```typescript
// Add to imports:
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WebsiteInterceptor } from './common/interceptors/website.interceptor';

// Add to providers:
providers: [
  {
    provide: APP_INTERCEPTOR,
    useClass: WebsiteInterceptor,
  },
]
```

### ☐ 3.5 Update TypeORM Configuration
Edit: `admin/backend/src/app.module.ts`
```typescript
TypeOrmModule.forRoot({
  type: 'mysql',
  host: process.env.RDS_HOSTNAME,
  port: parseInt(process.env.RDS_PORT || '3306'),
  username: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB_NAME,
  entities: [Website, User], // Add all entities
  synchronize: false, // Important: Use false for production
  logging: process.env.NODE_ENV !== 'production',
})
```

### ☐ 3.6 Update Auth Service to Use websiteId
Edit: `admin/backend/src/auth/auth.service.ts`
```typescript
// Update validateUser method:
async validateUser(
  websiteId: number,
  email: string,
  password: string,
): Promise<User> {
  const user = await this.usersRepository.findOne({
    where: { email, websiteId },
  });
  // ... rest of validation
}

// Update any user queries to include websiteId filter
```

---

## Phase 4: Environment Configuration (10 mins)

### ☐ 4.1 Create .env File
Create file: `admin/backend/.env`
```bash
NODE_ENV=production
PORT=3000

# Replace xxx with your actual RDS endpoint
RDS_HOSTNAME=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
RDS_PORT=3306
RDS_USERNAME=admin
RDS_PASSWORD=MySecurePassword123!
RDS_DB_NAME=admin_customer

JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRATION=86400

CORS_ORIGINS=http://admin.example.com,http://customer.example.com
```

### ☐ 4.2 Add .env to .gitignore
```bash
echo ".env" >> admin/backend/.gitignore
```

### ☐ 4.3 Verify Configuration
```bash
cd admin/backend
npm run build
echo "✅ Build successful!"
```

---

## Phase 5: Elastic Beanstalk Configuration (20 mins)

### ☐ 5.1 Create .ebextensions Directory
```bash
mkdir -p admin/backend/.ebextensions
```

### ☐ 5.2 Create 01_env.config
Create file: `admin/backend/.ebextensions/01_env.config`
```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 3000
    RDS_HOSTNAME: admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
    RDS_PORT: 3306
    RDS_DB_NAME: admin_customer

  aws:elasticbeanstalk:container:nodejs:
    GracefulShutdownTimeout: 30
    NodeCommand: "node dist/main.js"
```

### ☐ 5.3 Create 02_database.config
Create file: `admin/backend/.ebextensions/02_database.config`
```yaml
commands:
  01_create_database:
    command: |
      mysql -h $RDS_HOSTNAME -u $RDS_USERNAME -p$RDS_PASSWORD \
        -e "CREATE DATABASE IF NOT EXISTS admin_customer;"
    leader_only: true
    ignoreErrors: true
```

### ☐ 5.4 Create 04_nginx.config
Create file: `admin/backend/.ebextensions/04_nginx.config`
```yaml
files:
  "/etc/nginx/conf.d/01_proxy.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      client_max_body_size 20M;
      
      server {
          listen 80;
          server_name admin.example.com;
          location / {
              proxy_pass http://127.0.0.1:3000;
              proxy_set_header Host $host;
              proxy_set_header X-Website-Id 1;
          }
      }
      
      server {
          listen 80;
          server_name customer.example.com;
          location / {
              proxy_pass http://127.0.0.1:3000;
              proxy_set_header Host $host;
              proxy_set_header X-Website-Id 2;
          }
      }

commands:
  01_reload_nginx:
    command: sudo service nginx reload
    ignoreErrors: true
```

### ☐ 5.5 Create 05_platform.config
Create file: `admin/backend/.ebextensions/05_platform.config`
```yaml
option_settings:
  aws:elasticbeanstalk:healthreporting:system:
    SystemType: enhanced
  
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    DeleteOnTerminate: false
    RetentionInDays: 30
  
  aws:autoscaling:asg:
    MinSize: 1
    MaxSize: 3
```

### ☐ 5.6 Verify .elasticbeanstalk/config.yml
```yaml
# Should look like:
global:
  application_name: admin-customer
  default_platform: Node.js 20 running on 64bit Amazon Linux 2023
  default_region: ap-south-1

branch-defaults:
  main:
    environment: admin-customer-prod
```

---

## Phase 6: Build & Deploy (15-20 mins)

### ☐ 6.1 Build Locally
```bash
cd admin/backend

# Install dependencies
npm install

# Build
npm run build

# Verify
ls dist/ | head -5
# Should show: main.js, entities, services, etc.
```

### ☐ 6.2 Test Locally (Optional)
```bash
# Start locally to test
npm run start:dev

# In another terminal:
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### ☐ 6.3 Deploy to EB
```bash
cd admin/backend

# Initialize EB (first time only)
eb init -p "Node.js 20 running on 64bit Amazon Linux 2023" \
  --region ap-south-1 \
  admin-customer

# Create environment (first time only)
eb create admin-customer-prod \
  --instance-type t3.medium \
  --envvars RDS_USERNAME=admin

# OR Update environment (if already exists)
eb setenv RDS_USERNAME=admin RDS_PASSWORD=MySecurePassword123! RDS_DB_NAME=admin_customer

# Deploy
eb deploy admin-customer-prod
```

### ☐ 6.4 Monitor Deployment
```bash
# Watch logs in real-time
eb logs -f

# Check environment health
eb health

# Wait for "Green" status (2-5 minutes)
eb health -w

# Get the CNAME/endpoint
eb status | grep CNAME
```

### ☐ 6.5 Verify Deployment
```bash
# Get your EB endpoint
EB_ENDPOINT=$(eb status | grep CNAME | awk '{print $2}')

# Test the API
curl http://$EB_ENDPOINT/health

# Expected response: {"status":"ok"}
```

---

## Phase 7: Test Multi-Website Isolation (10 mins)

### ☐ 7.1 Create Test Users
```bash
EB_ENDPOINT=$(eb status | grep CNAME | awk '{print $2}')

# Create user in website 1 (Admin)
curl -X POST http://$EB_ENDPOINT/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 1" \
  -d '{
    "email":"admin@test.com",
    "username":"admin",
    "password":"pass123"
  }'

# Create user in website 2 (Customer)
curl -X POST http://$EB_ENDPOINT/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 2" \
  -d '{
    "email":"customer@test.com",
    "username":"customer",
    "password":"pass123"
  }'
```

### ☐ 7.2 Test Login Isolation
```bash
# Login to Admin (website 1)
ADMIN_TOKEN=$(curl -X POST http://$EB_ENDPOINT/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 1" \
  -d '{"email":"admin@test.com","password":"pass123"}' \
  | jq -r '.access_token')

# Login to Customer (website 2)
CUSTOMER_TOKEN=$(curl -X POST http://$EB_ENDPOINT/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 2" \
  -d '{"email":"customer@test.com","password":"pass123"}' \
  | jq -r '.access_token')

echo "Admin Token: $ADMIN_TOKEN"
echo "Customer Token: $CUSTOMER_TOKEN"
```

### ☐ 7.3 Verify Data Isolation
```bash
# Admin should NOT see Customer's data
curl http://$EB_ENDPOINT/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "X-Website-Id: 1"

# Customer should NOT see Admin's data
curl http://$EB_ENDPOINT/users \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "X-Website-Id: 2"

# ✅ Verify: Each returns only their own website's users
```

---

## Phase 8: Domain Configuration (15 mins, Optional but Recommended)

### ☐ 8.1 Get EB CNAME
```bash
EB_CNAME=$(eb status | grep CNAME | awk '{print $2}')
echo "Your EB CNAME: $EB_CNAME"
# Example: admin-customer-prod.ap-south-1.elasticbeanstalk.com
```

### ☐ 8.2 Point Domains to EB
In your domain registrar (GoDaddy, Route53, etc.):

**For admin.example.com:**
- Type: CNAME
- Name: admin
- Value: `admin-customer-prod.ap-south-1.elasticbeanstalk.com`

**For customer.example.com:**
- Type: CNAME
- Name: customer
- Value: `admin-customer-prod.ap-south-1.elasticbeanstalk.com`

### ☐ 8.3 Verify DNS (wait 5-10 mins after setting)
```bash
nslookup admin.example.com
nslookup customer.example.com

# Should resolve to your EB CNAME
```

---

## Phase 9: Ongoing Monitoring (Daily)

### ☐ 9.1 Monitor Environment Health
```bash
eb health
# Should show "Green"
```

### ☐ 9.2 Check Logs for Errors
```bash
eb logs -f | grep -i error
```

### ☐ 9.3 Monitor RDS
```bash
aws rds describe-db-instances \
  --db-instance-identifier admin-customer-db \
  --query 'DBInstances[0].[DBInstanceStatus,AllocatedStorage,EngineVersion]' \
  --region ap-south-1
```

---

## Common Commands Reference

```bash
# Deploy changes
cd admin/backend && npm run build && eb deploy

# View logs
eb logs -f

# SSH into EC2
eb ssh

# Check status
eb status
eb health

# View environment variables
eb printenv

# Set environment variable
eb setenv VAR_NAME=value

# Redeploy without code changes
eb deploy --no-timeout

# Connect to RDS from EB
eb ssh
mysql -h $RDS_HOSTNAME -u $RDS_USERNAME -p

# See all EB commands
eb --help
```

---

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| `502 Bad Gateway` | Check logs: `eb logs -f` |
| `Can't connect to RDS` | Test: `eb ssh` then `mysql -h ... -u admin -p` |
| `Data not isolated` | Check websiteId in interceptor |
| `Deployment stuck` | `eb abort` then `eb deploy` |
| `Out of memory` | Increase instance: `eb scale 2 --instance-type t3.large` |
| `SSL certificate error` | Use AWS ACM, update nginx config |

---

## Success Checklist

- ✅ RDS database created and accessible
- ✅ NestJS code updated with website entity and interceptor
- ✅ .ebextensions configured
- ✅ Application builds successfully
- ✅ Deployment to EB successful (Green health)
- ✅ Admin and Customer users created and isolated
- ✅ Domains point to EB CNAME
- ✅ Logs monitored and no errors
- ✅ Ready for production!

