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

  @Get(':masterid')
  async getDetails(@Param('masterid') masterid: string) {
    return this.service.getDetails(masterid);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('inventory')
  @Post(':masterid')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 10 * 1024 * 1024 } }))
  async saveDetails(
    @Param('masterid') masterid: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const description = body.description || '';
    const name = body.name || undefined;
    const userId = parseInt(body.user_id) || 0;
    const removedSlots: number[] = body.removed_slots
      ? JSON.parse(body.removed_slots)
      : [];

    // Map files to their slots
    const slottedFiles = (files || []).map((file) => {
      // File fieldname format: "image_1", "image_2", etc.
      const slotMatch = file.fieldname.match(/image_(\d+)/);
      const slot = slotMatch ? parseInt(slotMatch[1]) : 1;
      return { slot, file };
    });

    return this.service.saveDetails(
      masterid,
      description,
      userId,
      slottedFiles,
      removedSlots,
      name,
    );
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('inventory')
  @Delete(':masterid/image/:slot')
  async deleteImage(
    @Param('masterid') masterid: string,
    @Param('slot') slot: string,
  ) {
    return this.service.deleteImage(masterid, parseInt(slot));
  }
}
