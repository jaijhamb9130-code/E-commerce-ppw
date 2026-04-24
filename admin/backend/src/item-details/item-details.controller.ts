import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  Delete,
  Query,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ItemDetailsService } from './item-details.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { UseGuards } from '@nestjs/common';

@Controller('item-details')
export class ItemDetailsController {
  constructor(private readonly service: ItemDetailsService) {}

  @Get('thumbnails')
  async getThumbnails(@Query('masterids') masterids: string) {
    const ids = (masterids || '').split(',').filter(Boolean);
    return this.service.getThumbnails(ids);
  }

  @Get(':masterid')
  async getDetails(@Param('masterid') masterid: string) {
    return this.service.getDetails(masterid);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':masterid')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 100 * 1024 * 1024 } }))
  async saveDetails(
    @Param('masterid') masterid: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const description = body.description || '';
    const name = body.name || undefined;
    const userId = parseInt(body.user_id) || 0;

    const removedSlots: string[] = [
      ...(body.removed_slots ? JSON.parse(body.removed_slots).map((n: number) => `img${n}`) : []),
      ...(body.removed_video_slots ? JSON.parse(body.removed_video_slots).map((n: number) => `vid${n}`) : []),
    ];

    const slottedFiles = (files || []).map((file) => {
      const imgMatch = file.fieldname.match(/image_(\d+)/);
      const vidMatch = file.fieldname.match(/video_(\d+)/);
      const slot = imgMatch ? `img${imgMatch[1]}` : vidMatch ? `vid${vidMatch[1]}` : 'img1';
      return { slot, file };
    });

    return this.service.saveDetails(masterid, description, userId, slottedFiles, removedSlots, name);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':masterid/media/:slot')
  async deleteMedia(
    @Param('masterid') masterid: string,
    @Param('slot') slot: string,
  ) {
    return this.service.deleteMedia(masterid, slot);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':masterid/image/:slot')
  async deleteImage(
    @Param('masterid') masterid: string,
    @Param('slot') slot: string,
  ) {
    return this.service.deleteImage(masterid, parseInt(slot));
  }
}
