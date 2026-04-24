import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemDetail } from '../entities/item-detail.entity';
import { ItemMedia } from '../entities/item-media.entity';
import { StockItem } from '../entities/stock-item.entity';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class ItemDetailsService {
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(
    @InjectRepository(ItemDetail)
    private detailRepo: Repository<ItemDetail>,
    @InjectRepository(ItemMedia)
    private mediaRepo: Repository<ItemMedia>,
    @InjectRepository(StockItem)
    private stockItemRepo: Repository<StockItem>,
  ) {
    this.region = process.env.AWS_REGION || 'ap-south-1';
    this.bucket = process.env.S3_BUCKET_NAME!;
    this.s3 = new S3Client({ region: this.region });
  }

  private s3Key(urlName: string, slot: string): string {
    return slot.startsWith('vid')
      ? `uploads/items/videos/${urlName}.webm`
      : `uploads/items/${urlName}.webp`;
  }

  private s3Url(urlName: string, slot: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${this.s3Key(urlName, slot)}`;
  }

  async getDetails(masterid: string) {
    const detail = await this.detailRepo.findOne({ where: { masterid } });
    const rawMedia = await this.mediaRepo.find({
      where: { masterid },
      order: { slot: 'ASC' },
    });
    const images = rawMedia
      .filter((m) => m.type === 'image')
      .map((m) => ({
        id: m.id,
        masterid: m.masterid,
        image_slot: parseInt(m.slot.replace('img', '')) || 1,
        image_url: this.s3Url(m.url_name, m.slot),
      }));
    const videos = rawMedia
      .filter((m) => m.type === 'video')
      .map((m) => ({
        id: m.id,
        masterid: m.masterid,
        slot: m.slot,
        video_url: this.s3Url(m.url_name, m.slot),
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
        result[row.masterid] = this.s3Url(row.url_name, row.slot);
      }
    }
    return result;
  }

  private async deleteFromS3(urlName: string, slot: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.s3Key(urlName, slot),
      }));
    } catch { /* ignore missing */ }
  }

  async saveDetails(
    masterid: string,
    description: string,
    userId: number,
    files: { slot: string; file: Express.Multer.File }[],
    removedSlots: string[],
    name?: string,
  ) {
    if (name) {
      await this.stockItemRepo.update({ masterid }, { name });
    }

    let detail = await this.detailRepo.findOne({ where: { masterid } });
    if (detail) {
      detail.description = description;
      detail.updated_by = userId;
    } else {
      detail = this.detailRepo.create({ masterid, description, updated_by: userId });
    }
    await this.detailRepo.save(detail);

    for (const slot of removedSlots) {
      await this.deleteMedia(masterid, slot);
    }

    const stockItem = await this.stockItemRepo.findOne({ where: { masterid } });
    const nameCode = stockItem?.name?.match(/^(\S+)/)?.[1];
    const code = nameCode || masterid;

    for (const { slot, file } of files) {
      const existing = await this.mediaRepo.findOne({ where: { masterid, slot } });
      if (existing) {
        await this.deleteFromS3(existing.url_name, slot);
        await this.mediaRepo.remove(existing);
      }

      const urlName = `${code}${slot}`;
      const key = this.s3Key(urlName, slot);
      const contentType = slot.startsWith('vid') ? 'video/webm' : 'image/webp';

      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: contentType,
      }));

      const type = slot.startsWith('vid') ? 'video' : 'image';
      await this.mediaRepo.save(
        this.mediaRepo.create({ masterid, slot, type, url_name: urlName, uploaded_by: userId }),
      );
    }

    return this.getDetails(masterid);
  }

  async deleteMedia(masterid: string, slot: string) {
    const existing = await this.mediaRepo.findOne({ where: { masterid, slot } });
    if (existing) {
      await this.deleteFromS3(existing.url_name, slot);
      await this.mediaRepo.remove(existing);
    }
    return { success: true };
  }

  async deleteImage(masterid: string, slot: number) {
    return this.deleteMedia(masterid, `img${slot}`);
  }
}
