import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemDetail } from '../entities/item-detail.entity';
import { ItemImage } from '../entities/item-image.entity';
import { StockItem } from '../entities/stock-item.entity';
import { ItemDetailsController } from './item-details.controller';
import { ItemDetailsService } from './item-details.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemDetail, ItemImage, StockItem])],
  controllers: [ItemDetailsController],
  providers: [ItemDetailsService],
  exports: [ItemDetailsService],
})
export class ItemDetailsModule {}
