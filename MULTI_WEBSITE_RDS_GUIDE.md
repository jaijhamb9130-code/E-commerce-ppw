# Multi-Website Integration with Single RDS Database on Elastic Beanstalk

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│           Elastic Beanstalk Environment                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Node.js Application (NestJS)            │   │
│  │  ┌──────────────┐  ┌──────────────────────┐    │   │
│  │  │ Admin API    │  │ Customer API         │    │   │
│  │  │ (Port 3000)  │  │ (Reverse proxy route)│    │   │
│  │  └──────────────┘  └──────────────────────┘    │   │
│  │         ↓              ↓                        │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │    TypeORM Database Layer (Shared)      │   │   │
│  │  │  - All models with website_id column    │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↓                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    AWS RDS (MySQL 8.0)                                 │
│    ┌─────────────────────────────────────────────┐    │
│    │  Single Database Instance                   │    │
│    │  ├─ Table: users (website_id FK)           │    │
│    │  ├─ Table: orders (website_id FK)          │    │
│    │  ├─ Table: products (website_id FK)        │    │
│    │  └─ Table: [other tables] (website_id FK)  │    │
│    └─────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## STEP 1: Create RDS Instance on AWS

### 1.1 Using AWS Console

```bash
# Login to AWS Console
# Navigate to RDS → Databases → Create Database

# OR use AWS CLI:
aws rds create-db-instance \
  --db-instance-identifier admin-customer-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password 'YourSecurePassword123!' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name default \
  --publicly-accessible false \
  --region ap-south-1
```

### 1.2 RDS Security Group Configuration

```bash
# Allow EB instance to access RDS (port 3306)
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxx \
  --protocol tcp \
  --port 3306 \
  --source-security-group sg-eb-xxxxx \
  --region ap-south-1
```

### 1.3 Verify Connection

```bash
# From your local machine (if RDS is public)
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p

# Or from EB EC2 instance via EB CLI
eb ssh
# Then inside EC2:
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p
```

---

## STEP 2: Create Database Schema with Multi-Website Support

### 2.1 Database Initialization Script

Create `.ebextensions/02_database.config`:

```yaml
commands:
  01_create_database:
    command: |
      mysql -h $RDS_HOSTNAME -u $RDS_USERNAME -p$RDS_PASSWORD -e "CREATE DATABASE IF NOT EXISTS admin_customer;"
    leader_only: true
    ignoreErrors: true
```

### 2.2 Core Schema Design

**Key Principle: Every business table has a `website_id` column**

Create `admin/backend/src/database/schema.sql`:

```sql
-- Websites/Tenants table
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

-- Users with website isolation
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

-- Products with website isolation
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  website_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  stock_quantity INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
  INDEX idx_website_id (website_id)
);

-- Orders with website isolation
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  website_id INT NOT NULL,
  user_id INT NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(12, 2),
  status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_website_id (website_id),
  INDEX idx_user_id (user_id)
);

-- Insert initial websites
INSERT IGNORE INTO websites (id, name, slug, domain) VALUES
(1, 'Admin Portal', 'admin', 'admin.example.com'),
(2, 'Customer Portal', 'customer', 'customer.example.com');
```

---

## STEP 3: Update NestJS Code Structure

### 3.1 Create Website Entity

Create `admin/backend/src/entities/website.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Order } from './order.entity';

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

  @Column({ type: 'varchar', unique: true, nullable: true })
  apiKey: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.website)
  users: User[];

  @OneToMany(() => Order, (order) => order.website)
  orders: Order[];
}
```

### 3.2 Update User Entity

Update `admin/backend/src/entities/user.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Website } from './website.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  websiteId: number;

  @ManyToOne(() => Website, (website) => website.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'website_id' })
  website: Website;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ default: true })
  isActive: boolean;
}
```

### 3.3 Create Website Interceptor (Auto-add websiteId)

Create `admin/backend/src/common/interceptors/website.interceptor.ts`:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class WebsiteInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Extract websiteId from request (header, subdomain, or query)
    const websiteId = this.extractWebsiteId(request);
    
    // Attach to request for later use
    request.websiteId = websiteId;
    
    return next.handle();
  }

  private extractWebsiteId(request: any): number {
    // Option 1: From custom header
    const fromHeader = request.headers['x-website-id'];
    if (fromHeader) return parseInt(fromHeader, 10);

    // Option 2: From subdomain
    const host = request.headers.host || '';
    if (host.startsWith('admin.')) return 1;
    if (host.startsWith('customer.')) return 2;

    // Option 3: From query param (for testing)
    if (request.query.websiteId) return parseInt(request.query.websiteId, 10);

    // Default
    return 1;
  }
}
```

### 3.4 Create BaseRepository with Website Filtering

Create `admin/backend/src/common/repositories/base.repository.ts`:

```typescript
import { Repository, SelectQueryBuilder } from 'typeorm';

export abstract class BaseRepository<Entity> {
  constructor(private repository: Repository<Entity>) {}

  protected applyWebsiteFilter(
    qb: SelectQueryBuilder<Entity>,
    websiteId: number,
    alias: string = 'entity',
  ): SelectQueryBuilder<Entity> {
    return qb.where(`${alias}.website_id = :websiteId`, { websiteId });
  }

  async findByWebsite(websiteId: number) {
    const qb = this.repository.createQueryBuilder('entity');
    return this.applyWebsiteFilter(qb, websiteId).getMany();
  }

  async findOneByWebsite(id: number, websiteId: number) {
    const qb = this.repository.createQueryBuilder('entity');
    return this.applyWebsiteFilter(qb, websiteId)
      .andWhere('entity.id = :id', { id })
      .getOne();
  }
}
```

### 3.5 Update User Service

Update `admin/backend/src/auth/auth.service.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async validateUser(
    websiteId: number,
    email: string,
    password: string,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { email, websiteId },
    });

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }

    return user;
  }

  async createUser(
    websiteId: number,
    email: string,
    username: string,
    password: string,
  ) {
    const existingUser = await this.usersRepository.findOne({
      where: { email, websiteId },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists for this website');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      websiteId,
      email,
      username,
      passwordHash: hashedPassword,
    });

    return this.usersRepository.save(user);
  }
}
```

### 3.6 Update App Module

Update `admin/backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WebsiteInterceptor } from './common/interceptors/website.interceptor';
import { User } from './entities/user.entity';
import { Website } from './entities/website.entity';
import { Order } from './entities/order.entity';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.RDS_HOSTNAME,
      port: parseInt(process.env.RDS_PORT || '3306'),
      username: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      database: process.env.RDS_DB_NAME,
      entities: [Website, User, Order], // Add all entities
      synchronize: false, // Use migrations instead
      logging: false,
    }),
    TypeOrmModule.forFeature([Website, User, Order]),
    AuthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: WebsiteInterceptor,
    },
  ],
})
export class AppModule {}
```

---

## STEP 4: Environment Configuration

### 4.1 Create `.env` file

Create `admin/backend/.env`:

```bash
NODE_ENV=production
PORT=3000

# RDS Configuration
RDS_HOSTNAME=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
RDS_PORT=3306
RDS_USERNAME=admin
RDS_PASSWORD=YourSecurePassword123!
RDS_DB_NAME=admin_customer

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRATION=86400

# CORS
CORS_ORIGINS=http://admin.example.com,http://customer.example.com
```

### 4.2 Create `.ebextensions/01_env.config`

Create `.ebextensions/01_env.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 3000
    RDS_HOSTNAME: admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
    RDS_PORT: 3306
    RDS_DB_NAME: admin_customer
  
  aws:autoscaling:launchconfiguration:
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role

  aws:elasticbeanstalk:container:nodejs:
    GracefulShutdownTimeout: 30
    NodeCommand: "node dist/main.js"
```

**Important:** Store sensitive data (RDS_USERNAME, RDS_PASSWORD, JWT_SECRET) in **AWS Secrets Manager** or **AWS Systems Manager Parameter Store**, NOT in .ebextensions.

### 4.3 Use AWS Secrets Manager

Create `.ebextensions/03_secrets.config`:

```yaml
commands:
  01_retrieve_secrets:
    command: |
      #!/bin/bash
      SECRETS=$(aws secretsmanager get-secret-value \
        --secret-id admin-customer/rds \
        --region ap-south-1 \
        --query 'SecretString' \
        --output text)
      
      echo "RDS_USERNAME=$(echo $SECRETS | jq -r '.username')" >> /opt/elasticbeanstalk/tasks/bundlelogs.d/01_app.conf
      echo "RDS_PASSWORD=$(echo $SECRETS | jq -r '.password')" >> /opt/elasticbeanstalk/tasks/bundlelogs.d/01_app.conf
    leader_only: true
```

---

## STEP 5: Elastic Beanstalk Configuration

### 5.1 Update `.elasticbeanstalk/config.yml`

```yaml
branch-defaults:
  main:
    environment: admin-customer-prod
    group_suffix: null

global:
  application_name: admin-customer
  branch: null
  default_ec2_keyname: admin-customer-key
  default_platform: Node.js 20 running on 64bit Amazon Linux 2023
  default_region: ap-south-1
  include_git_submodules: true
  instance_profile: null
  platform_name: null
  platform_version: null
  profile: admin-customer
  sc: null
  workspace_type: Application
```

### 5.2 Create `.ebextensions/04_nginx.config` (Reverse Proxy for Multiple Sites)

Create `.ebextensions/04_nginx.config`:

```yaml
files:
  "/etc/nginx/conf.d/01_proxy.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      client_max_body_size 20M;
      
      # Admin Portal
      server {
          listen 80;
          server_name admin.example.com;
          
          location / {
              proxy_pass http://127.0.0.1:3000;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_set_header X-Website-Id 1;
              proxy_cache_bypass $http_upgrade;
          }
      }
      
      # Customer Portal
      server {
          listen 80;
          server_name customer.example.com;
          
          location / {
              proxy_pass http://127.0.0.1:3000;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_set_header X-Website-Id 2;
              proxy_cache_bypass $http_upgrade;
          }
      }

commands:
  01_reload_nginx:
    command: sudo service nginx reload
    ignoreErrors: true
```

### 5.3 Create `.ebextensions/05_platform.config`

Create `.ebextensions/05_platform.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:healthreporting:system:
    SystemType: enhanced
    EnhancedHealthAuthEnabled: true
  
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    DeleteOnTerminate: false
    RetentionInDays: 30
  
  aws:elasticbeanstalk:xray:
    XRayEnabled: false

  aws:autoscaling:asg:
    MinSize: 1
    MaxSize: 3
  
  aws:autoscaling:trigger:
    MeasureName: CPUUtilization
    Statistic: Average
    Unit: Percent
    UpperThreshold: 70
    LowerThreshold: 20
    UpperBreachScaleIncrement: 1
    LowerBreachScaleIncrement: -1
    BreachDuration: 5
```

---

## STEP 6: Build and Deploy

### 6.1 Initialize EB Environment

```bash
# Navigate to backend folder
cd admin/backend

# Initialize EB (if not already done)
eb init -p "Node.js 20 running on 64bit Amazon Linux 2023" \
  --region ap-south-1 \
  admin-customer

# Create environment
eb create admin-customer-prod \
  --instance-type t3.medium \
  --envvars RDS_HOSTNAME=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com,RDS_DB_NAME=admin_customer,NODE_ENV=production
```

### 6.2 Build Application

```bash
# Install dependencies
npm install

# Build
npm run build

# Verify build
ls -la dist/
```

### 6.3 Deploy to EB

```bash
# Deploy
eb deploy admin-customer-prod

# Monitor deployment
eb logs -f

# Check health
eb health
eb status
```

### 6.4 View Application

```bash
# Open in browser
eb open

# Or check the endpoint
eb status | grep "CNAME"
```

---

## STEP 7: Database Migrations

### 7.1 Create TypeORM Migrations

```bash
cd admin/backend

# Generate migration
npx typeorm migration:generate -n InitialSchema

# Run migrations on EB
eb ssh -c "cd /var/www/html && npm run typeorm migration:run"
```

### 7.2 Auto-run Migrations on Deploy

Create `.ebextensions/06_migration.config`:

```yaml
commands:
  01_run_migrations:
    command: npm run typeorm migration:run
    cwd: /var/www/html
    leader_only: true
    ignoreErrors: false

container_commands:
  01_seed_data:
    command: npm run seed
    cwd: /var/www/html
    leader_only: true
    ignoreErrors: true
```

---

## STEP 8: Testing Multi-Website Isolation

### 8.1 Test User Login

```bash
# Admin Portal (websiteId=1)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 1" \
  -d '{"email":"admin@example.com","password":"password"}'

# Customer Portal (websiteId=2)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 2" \
  -d '{"email":"customer@example.com","password":"password"}'
```

### 8.2 Test Data Isolation

```bash
# Get orders for Admin (websiteId=1)
curl http://localhost:3000/orders \
  -H "Authorization: Bearer TOKEN1" \
  -H "X-Website-Id: 1"

# Get orders for Customer (websiteId=2)
curl http://localhost:3000/orders \
  -H "Authorization: Bearer TOKEN2" \
  -H "X-Website-Id: 2"
```

---

## STEP 9: Monitoring & Troubleshooting

### 9.1 Check Logs

```bash
# EB logs
eb logs -f

# SSH into EB instance
eb ssh

# Once inside, check NestJS logs
tail -f /var/log/eb-node.log
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### 9.2 Check RDS Connection

```bash
# SSH into EB
eb ssh

# Test RDS connection
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p -e "SELECT COUNT(*) FROM admin_customer.users;"
```

### 9.3 Monitor Costs

```bash
# Check RDS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=admin-customer-db \
  --statistics Average \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --region ap-south-1
```

---

## STEP 10: Scaling Strategy

### 10.1 Auto-Scaling Configuration

```yaml
# In .ebextensions/05_platform.config
aws:autoscaling:asg:
  MinSize: 2
  MaxSize: 5

aws:autoscaling:trigger:
  MeasureName: CPUUtilization
  Statistic: Average
  Unit: Percent
  UpperThreshold: 70
  LowerThreshold: 30
  BreachDuration: 5
```

### 10.2 RDS Scaling

```bash
# Modify RDS instance type
aws rds modify-db-instance \
  --db-instance-identifier admin-customer-db \
  --db-instance-class db.t3.small \
  --apply-immediately \
  --region ap-south-1
```

---

## STEP 11: Security Best Practices

### 11.1 Enable SSL/TLS

```bash
# Request SSL certificate (AWS ACM)
aws acm request-certificate \
  --domain-name example.com \
  --subject-alternative-names admin.example.com customer.example.com \
  --region ap-south-1
```

### 11.2 Update nginx for HTTPS

Update `.ebextensions/04_nginx.config`:

```yaml
files:
  "/etc/nginx/conf.d/01_proxy.conf":
    content: |
      # Redirect HTTP to HTTPS
      server {
          listen 80;
          server_name admin.example.com customer.example.com;
          return 301 https://$host$request_uri;
      }
      
      # HTTPS
      server {
          listen 443 ssl http2;
          server_name admin.example.com;
          
          ssl_certificate /etc/pki/tls/certs/your-cert.crt;
          ssl_certificate_key /etc/pki/tls/private/your-key.key;
          
          location / {
              proxy_pass http://127.0.0.1:3000;
              proxy_set_header X-Website-Id 1;
          }
      }
```

### 11.3 Restrict RDS Access

```bash
# Only allow from EB security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxx \
  --protocol tcp \
  --port 3306 \
  --source-security-group sg-eb-xxxxx \
  --region ap-south-1
```

---

## STEP 12: Complete Deployment Workflow

### 12.1 One-Command Deploy Script

Create `deploy.sh`:

```bash
#!/bin/bash

set -e

echo "🔨 Building application..."
npm install
npm run build

echo "📝 Running migrations..."
npx typeorm migration:run

echo "🚀 Deploying to Elastic Beanstalk..."
eb deploy admin-customer-prod

echo "⏳ Waiting for deployment..."
eb health -w

echo "✅ Deployment complete!"
echo "Admin Portal: http://admin.example.com"
echo "Customer Portal: http://customer.example.com"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

### 12.2 Package.json Scripts

Update `package.json`:

```json
{
  "scripts": {
    "build": "nest build",
    "start:prod": "node dist/main.js",
    "migrate": "typeorm migration:run",
    "seed": "ts-node src/scripts/seed.ts",
    "deploy": "npm run build && npm run migrate && eb deploy"
  }
}
```

---

## STEP 13: Adding New Websites

To add a third website later:

### 13.1 Insert into Database

```sql
INSERT INTO websites (name, slug, domain) VALUES
('Partner Portal', 'partner', 'partner.example.com');
```

### 13.2 Update Nginx

```yaml
# In .ebextensions/04_nginx.config
server {
    listen 80;
    server_name partner.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Website-Id 3;
    }
}
```

### 13.3 Deploy

```bash
./deploy.sh
```

---

## STEP 14: Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| EB deployment fails | Check logs: `eb logs -f` |
| Can't connect to RDS | Verify security group rules, test from EB instance |
| Data isolation not working | Ensure websiteId filtering in all queries |
| High database load | Enable RDS Read Replicas, optimize slow queries |
| Website identity not detected | Check header/subdomain extraction in interceptor |
| CORS errors | Update CORS_ORIGINS env var |
| Out of memory | Increase EB instance type (t3.medium → t3.large) |

---

## Summary of Key Commands

```bash
# 1. Create RDS
aws rds create-db-instance --db-instance-identifier admin-customer-db \
  --engine mysql --engine-version 8.0.35 \
  --master-username admin --master-user-password 'PASSWORD' \
  --allocated-storage 20 --region ap-south-1

# 2. Build application
cd admin/backend
npm install && npm run build

# 3. Deploy to EB
eb init && eb create admin-customer-prod && eb deploy

# 4. Monitor
eb health -w && eb logs -f

# 5. SSH for debugging
eb ssh
```

---

## Next Steps

1. ✅ Create RDS instance
2. ✅ Update NestJS code with websiteId filtering
3. ✅ Configure .ebextensions
4. ✅ Deploy to Elastic Beanstalk
5. ✅ Test multi-website isolation
6. ✅ Set up monitoring & auto-scaling
7. ✅ Enable SSL/TLS
8. ✅ Add more websites as needed
