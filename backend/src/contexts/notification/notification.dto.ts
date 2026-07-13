import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../core/infrastructure/http/openapi.dto';
import { NotificationType } from './domain/notification.entity';

export class NotificationPaginationDto {
  @ApiProperty({ minimum: 1, default: 1, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ minimum: 1, maximum: 100, default: 20, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  @ApiProperty({ maxLength: 120 })
  title!: string;

  @ApiProperty({ maxLength: 500 })
  message!: string;

  @ApiProperty({ example: 'INVOICE' })
  resourceType!: string;

  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  data!: NotificationResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;

  @ApiProperty({ minimum: 0 })
  unreadCount!: number;
}
