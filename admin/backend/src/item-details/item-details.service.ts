import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemDetail } from '../entities/item-detail.entity';
import { ItemImage } from '../entities/item-image.entity';
import { StockItem } from '../entities/stock-item.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ItemDetailsService {
  private uploadDir: string;

  constructor(
    @InjectRepository(ItemDetail)
    private detailRepo: Repository<ItemDetail>,
    @InjectRepository(ItemImage)
    private imageRepo: Repository<ItemImage>,
    @InjectRepository(StockItem)
    private stockItemRepo: Repository<StockItem>,
  ) {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads', 'items');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async getDetails(masterid: string) {
    const detail = await this.detailRepo.findOne({ where: { masterid } });
    const images = await this.imageRepo.find({
      where: { masterid },
      order: { image_slot: 'ASC' },
    });
    return { detail, images };
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

    // 2. Remove images for removed slots
    for (const slot of removedSlots) {
      const existing = await this.imageRepo.findOne({
        where: { masterid, image_slot: slot },
      });
      if (existing) {
        // Delete actual file
        const filePath = path.join(process.cwd(), existing.image_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await this.imageRepo.remove(existing);
      }
    }

    // 3. Save new images
    for (const { slot, file } of files) {
      // Remove old image in this slot if any
      const existing = await this.imageRepo.findOne({
        where: { masterid, image_slot: slot },
      });
      if (existing) {
        const oldPath = path.join(process.cwd(), existing.image_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
        await this.imageRepo.remove(existing);
      }

      // Save new file
      const ext = path.extname(file.originalname);
      const fileName = `${masterid}_slot${slot}_${Date.now()}${ext}`;
      const filePath = path.join(this.uploadDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const imageRecord = this.imageRepo.create({
        masterid,
        image_slot: slot,
        image_url: `public/uploads/items/${fileName}`,
        original_name: file.originalname,
        uploaded_by: userId,
      });
      await this.imageRepo.save(imageRecord);
    }

    return this.getDetails(masterid);
  }

  async deleteImage(masterid: string, slot: number) {
    const existing = await this.imageRepo.findOne({
      where: { masterid, image_slot: slot },
    });
    if (existing) {
      const filePath = path.join(process.cwd(), existing.image_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await this.imageRepo.remove(existing);
    }
    return { success: true };
  }
}
