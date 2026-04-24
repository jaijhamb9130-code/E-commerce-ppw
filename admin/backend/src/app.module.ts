import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { UserController } from './user.controller';
import { AppService } from './app.service';
import { Ledger } from './entities/ledger.entity';
import { StockItem } from './entities/stock-item.entity';
import { Order } from './entities/order.entity';
import { OrderDetail } from './entities/order-detail.entity';
import { User } from './entities/user.entity';
import { Meta } from './entities/meta.entity';
import { ItemDetail } from './entities/item-detail.entity';
import { ItemMedia } from './entities/item-media.entity';
import { Customer } from './entities/customer.entity';
import { Address } from './entities/address.entity';
import { TallyService } from './tally.service';
import { AuthModule } from './auth/auth.module';
import { ItemDetailsModule } from './item-details/item-details.module';

import { CustomersController } from './customers.controller';

@Module({
  imports: [
    AuthModule,
    ItemDetailsModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', '127.0.0.1'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'tally_sync'),
        entities: [Ledger, StockItem, Order, OrderDetail, User, Meta, ItemDetail, ItemMedia, Customer, Address],
        synchronize: process.env.DB_SYNC === 'true', // OFF in prod. Set DB_SYNC=true only for a one-off boot if you need schema sync.
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Ledger,
      StockItem,
      Order,
      OrderDetail,
      User,
      Meta,
      ItemDetail,
      Customer,
      Address
    ]),
  ],
  controllers: [AppController, UserController, CustomersController],
  providers: [AppService, TallyService],
})
export class AppModule {}
