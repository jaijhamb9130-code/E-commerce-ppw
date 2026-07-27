# Copy-Paste Commands Reference

## 1️⃣ Create RDS Instance

```bash
# Run this ONCE to create RDS
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
```

## 2️⃣ Get RDS Endpoint

```bash
# Copy the output value
aws rds describe-db-instances \
  --db-instance-identifier admin-customer-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text \
  --region ap-south-1
```

## 3️⃣ Test RDS Connection

```bash
# Replace with your actual endpoint and password
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p

# Type password when prompted: MySecurePassword123!
# In mysql client, run:
SHOW DATABASES;
```

## 4️⃣ Create Databases & Tables

```bash
# Connect to RDS first (see step 3)
# Then paste all of this:

CREATE DATABASE admin_customer;
USE admin_customer;

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

# Verify
SHOW TABLES;
SELECT * FROM websites;
EXIT;
```

## 5️⃣ Update NestJS Code

### Create Website Entity

File: `admin/backend/src/entities/website.entity.ts`

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

  @Column({ type: 'varchar', unique: true, nullable: true })
  apiKey: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.website)
  users: User[];
}
```

### Update User Entity

Edit: `admin/backend/src/entities/user.entity.ts`

Add these lines:

```typescript
import { ManyToOne, JoinColumn } from 'typeorm';
import { Website } from './website.entity';

// In the User class, add:
@Column()
websiteId: number;

@ManyToOne(() => Website, (website) => website.users, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'website_id' })
website: Website;
```

### Create Website Interceptor

File: `admin/backend/src/common/interceptors/website.interceptor.ts`

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
    // Option 1: Check header
    if (request.headers['x-website-id']) {
      return parseInt(request.headers['x-website-id'], 10);
    }

    // Option 2: Check subdomain
    const host = request.headers.host || '';
    if (host.startsWith('admin.')) return 1;
    if (host.startsWith('customer.')) return 2;

    // Option 3: Default
    return 1;
  }
}
```

### Update App Module

File: `admin/backend/src/app.module.ts`

Add to imports and update TypeORM config:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WebsiteInterceptor } from './common/interceptors/website.interceptor';
import { Website } from './entities/website.entity';
import { User } from './entities/user.entity';

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
      entities: [Website, User],
      synchronize: false,
      logging: false,
    }),
    TypeOrmModule.forFeature([Website, User]),
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

### Update Auth Service

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

  if (!user) {
    throw new BadRequestException('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new BadRequestException('Invalid credentials');
  }

  return user;
}
```

## 6️⃣ Create .env File

File: `admin/backend/.env`

```bash
NODE_ENV=production
PORT=3000

RDS_HOSTNAME=admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com
RDS_PORT=3306
RDS_USERNAME=admin
RDS_PASSWORD=MySecurePassword123!
RDS_DB_NAME=admin_customer

JWT_SECRET=your-super-secret-key-12345
JWT_EXPIRATION=86400

CORS_ORIGINS=http://admin.example.com,http://customer.example.com
```

## 7️⃣ Create EB Config Files

### File 1: `.ebextensions/01_env.config`

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

### File 2: `.ebextensions/02_database.config`

```yaml
commands:
  01_create_database:
    command: |
      mysql -h $RDS_HOSTNAME -u $RDS_USERNAME -p$RDS_PASSWORD \
        -e "CREATE DATABASE IF NOT EXISTS admin_customer;"
    leader_only: true
    ignoreErrors: true
```

### File 3: `.ebextensions/04_nginx.config`

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
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_set_header X-Website-Id 1;
              proxy_cache_bypass $http_upgrade;
          }
      }
      
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

### File 4: `.ebextensions/05_platform.config`

```yaml
option_settings:
  aws:elasticbeanstalk:healthreporting:system:
    SystemType: enhanced
    EnhancedHealthAuthEnabled: true
  
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    DeleteOnTerminate: false
    RetentionInDays: 30
  
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

## 8️⃣ Build & Deploy

```bash
# Navigate to backend
cd admin/backend

# Install dependencies
npm install

# Build
npm run build

# Initialize EB (FIRST TIME ONLY)
eb init -p "Node.js 20 running on 64bit Amazon Linux 2023" \
  --region ap-south-1 \
  admin-customer

# Create environment (FIRST TIME ONLY)
eb create admin-customer-prod \
  --instance-type t3.medium \
  --envvars RDS_USERNAME=admin,RDS_PASSWORD=MySecurePassword123!,RDS_DB_NAME=admin_customer

# Deploy (every time after code changes)
eb deploy admin-customer-prod

# Watch deployment logs
eb logs -f

# Check health (wait for Green)
eb health -w

# See your EB endpoint
eb status
```

## 9️⃣ Test Multi-Website

```bash
# Get your EB endpoint
EB_URL=$(eb status | grep "CNAME" | awk '{print $2}')

# Test health
curl http://$EB_URL/health

# Register admin user (website_id = 1)
curl -X POST http://$EB_URL/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 1" \
  -d '{
    "email":"admin@test.com",
    "username":"admin",
    "password":"pass123"
  }'

# Register customer user (website_id = 2)
curl -X POST http://$EB_URL/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 2" \
  -d '{
    "email":"customer@test.com",
    "username":"customer",
    "password":"pass123"
  }'

# Login admin
curl -X POST http://$EB_URL/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 1" \
  -d '{"email":"admin@test.com","password":"pass123"}'

# Login customer
curl -X POST http://$EB_URL/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Website-Id: 2" \
  -d '{"email":"customer@test.com","password":"pass123"}'
```

## 🔟 Verify Data Isolation

```bash
# SSH into EB instance
eb ssh

# Connect to RDS
mysql -h admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com \
  -u admin -p admin_customer

# Check admin users (should only show website_id=1)
SELECT id, email, website_id FROM users WHERE website_id = 1;

# Check customer users (should only show website_id=2)
SELECT id, email, website_id FROM users WHERE website_id = 2;

# Verify data isolation is working
SELECT COUNT(*) FROM users WHERE website_id = 1;
SELECT COUNT(*) FROM users WHERE website_id = 2;

EXIT;
```

## 1️⃣1️⃣ Regular Maintenance Commands

```bash
# Check environment health daily
eb health

# View recent logs
eb logs | tail -50

# SSH for debugging
eb ssh

# Update environment variable
eb setenv VAR_NAME=new_value

# Scale up (increase instances)
eb scale 3

# Change instance type
eb scale --instance-type t3.large

# Abort current deployment (if stuck)
eb abort

# Terminate environment (if needed)
eb terminate admin-customer-prod

# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier admin-customer-db \
  --region ap-south-1
```

## 1️⃣2️⃣ Upgrade EB Platform

```bash
# Check for platform updates
eb platform select

# List available platforms
eb platform list

# Update to latest Node.js 20
eb platform select --filter nodejs
```

## 1️⃣3️⃣ Monitoring & Logs

```bash
# Stream logs in real-time
eb logs -f

# Save logs to file
eb logs > deployment.log

# SSH and check application logs
eb ssh
tail -f /var/log/eb-node.log
tail -f /var/log/nginx/error.log

# Check application health
curl http://localhost:3000/health
```

---

## ⚠️ Important Notes

1. **Replace these values everywhere:**
   - `admin-customer-db.xxxxx.ap-south-1.rds.amazonaws.com` → Your actual RDS endpoint
   - `sg-xxxxxxxx` → Your security group ID
   - `MySecurePassword123!` → Your secure password
   - `admin.example.com`, `customer.example.com` → Your actual domains

2. **Before running commands, you need:**
   - AWS CLI installed and configured
   - Access to your AWS account
   - Security groups created
   - RDS instance created

3. **Save your RDS details:**
   - Endpoint: `____________________________`
   - Username: `____________________________`
   - Password: `____________________________`
   - Database: `admin_customer`

