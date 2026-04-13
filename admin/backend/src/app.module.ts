import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
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
import { ItemImage } from './entities/item-image.entity';
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
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/public',
    }),
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
        entities: [Ledger, StockItem, Order, OrderDetail, User, Meta, ItemDetail, ItemImage, Customer, Address],
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
      ItemImage,
      Customer,
      Address
    ]),
  ],
  controllers: [AppController, UserController, CustomersController],
  providers: [AppService, TallyService],
})
export class AppModule {}
