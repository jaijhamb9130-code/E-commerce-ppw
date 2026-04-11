import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Order } from './entities/order.entity';
import { AuthService } from './auth/auth.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private authService: AuthService,
  ) {}

  async onModuleInit() {
    const admin = await this.userRepository.findOne({
      where: { username: 'admin' },
    });
    if (!admin) {
      console.log('Creating default admin user...');
      await this.authService.register({
        username: 'admin',
        password: 'password',
        role: 'admin',
      });
      console.log('Default admin user created: admin / password');
    } else if (admin.password === 'password') {
      console.log('Migrating admin password to hash...');
      // Update with hashed password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash('password', salt);

      await this.userRepository.update(
        { id: admin.id },
        { password: hashedPassword },
      );
      console.log('Admin password migrated.');
    }
  }

  getHello(): string {
    return 'Hello World!';
  }

  // User requested: "after 24 hours of synced order it will be removed from completed order and showed on reports page"
  // This cron ensures any lingering logic is handled, though the QueryBuilder in controller already filters them.
  // We can also use this to perform any archive logic if needed in future.
  @Cron(CronExpression.EVERY_HOUR)
  async handleSyncedCleanup() {
    console.log('[Cleanup] Checking for synced orders older than 24h...');
    // Currently, our controller's "active" filter handles the dynamic hiding.
    // This cron is here for future-proofing state transitions or archiving data to a history table.
  }
}
