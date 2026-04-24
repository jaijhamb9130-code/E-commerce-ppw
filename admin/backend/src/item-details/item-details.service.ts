import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemDetail } from '../entities/item-detail.entity';
import { ItemMedia } from '../entities/item-media.entity';
import { StockItem } from '../entities/stock-item.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ItemDetailsService {
  private uploadDir: string;

  constructor(
    @InjectRepository(ItemDetail)
    private detailRepo: Repository<ItemDetail>,
    @InjectRepository(ItemMedia)
    private mediaRepo: Repository<ItemMedia>,
    @InjectRepository(StockItem)
    private stockItemRepo: Repository<StockItem>,
  ) {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads', 'items');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private fileUrl(urlName: string, slot: string): string {
    return slot.startsWith('vid')
      ? `public/uploads/items/videos/${urlName}.webm`
      : `public/uploads/items/${urlName}.webp`;
  }

  async getDetails(masterid: string) {
    const detail = await this.detailRepo.findOne({ where: { masterid } });
    const rawMedia = await this.mediaRepo.find({
      where: { masterid },
      order: { slot: 'ASC' },
    });
    const images = rawMedia
      .filter(m => m.type === 'image')
      .map(m => ({
        id: m.id,
        masterid: m.masterid,
        image_slot: parseInt(m.slot.replace('img', '')) || 1,
        image_url: this.fileUrl(m.url_name, m.slot),
      }));
    const videos = rawMedia
      .filter(m => m.type === 'video')
      .map(m => ({
        id: m.id,
        masterid: m.masterid,
        slot: m.slot,
        video_url: this.fileUrl(m.url_name, m.slot),
      }));
    return { details: detail, images, videos };
  }

  async getThumbnails(masterids: string[]): Promise<Record<string, string>> {
    if (!masterids.length) return {};
    const rows = await this.mediaRepo
      .createQueryBuilder('m')
      .where('m.masterid IN (:...ids) AND m.type = :type', { ids: masterids, type: 'image' })
      .orderBy('m.slot', 'ASC')
      .getMany();
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (!result[row.masterid]) {
        result[row.masterid] = `/${this.fileUrl(row.url_name, row.slot)}`;
      }
    }
    return result;
  }

  async saveDetails(
    masterid: string,
    description: string,
    userId: number,
    files: { slot: number; file: Express.Multer.File }[],
    removedSlots: number[],
    name?: string,
  ) {
    // 0. Update the StockItem name if provided
    if (name) {
      await this.stockItemRepo.update({ masterid }, { name });
    }

    // 1. Upsert description
    let detail = await this.detailRepo.findOne({ where: { masterid } });
    if (detail) {
      detail.description = description;
      detail.updated_by = userId;
    } else {
      detail = this.detailRepo.create({
        masterid,
        description,
        updated_by: userId,
      });
    }
    await this.detailRepo.save(detail);

    return this.getDetails(masterid);
  }

  async deleteImage(masterid: string, slot: number) {
    const slotStr = `img${slot}`;
    const existing = await this.mediaRepo.findOne({ where: { masterid, slot: slotStr } });
    if (existing) {
      const filePath = path.join(process.cwd(), this.fileUrl(existing.url_name, existing.slot));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await this.mediaRepo.remove(existing);
    }
    return { success: true };
  }
}
