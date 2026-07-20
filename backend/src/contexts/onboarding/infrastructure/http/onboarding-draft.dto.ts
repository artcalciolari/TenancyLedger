import { Type } from 'class-transformer';
import { Allow, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetaDto } from '../../../../core/infrastructure/http/openapi.dto';
import { OnboardingDraft, OnboardingDraftStatus } from '../../domain/onboarding-draft.entity';

export class SaveOnboardingDraftDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'JSON opaco do wizard, limitado a 64 KiB quando serializado.',
  })
  @Allow()
  payload!: unknown;
}

export class OnboardingDraftPaginationDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: OnboardingDraftStatus, enumName: 'OnboardingDraftStatus' })
  @IsOptional()
  @IsEnum(OnboardingDraftStatus)
  status?: OnboardingDraftStatus;
}

export class OnboardingDraftResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: unknown;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ enum: OnboardingDraftStatus, enumName: 'OnboardingDraftStatus' })
  status!: OnboardingDraftStatus;

  @ApiProperty({ description: 'Indica se o rascunho possui uma foto temporária associada.' })
  hasPhoto!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static from(draft: OnboardingDraft): OnboardingDraftResponseDto {
    return {
      id: draft.id,
      payload: draft.payload,
      createdByUserId: draft.createdByUserId,
      status: draft.status,
      hasPhoto: draft.photoStorageKey !== null,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }
}

export class OnboardingDraftPhotoUrlResponseDto {
  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({ minimum: 1, maximum: 900, example: 300 })
  expiresInSeconds!: number;
}

export class PaginatedOnboardingDraftsResponseDto {
  @ApiProperty({ type: [OnboardingDraftResponseDto] })
  data!: OnboardingDraftResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class CompleteOnboardingResponseDto {
  @ApiProperty({ format: 'uuid' })
  draftId!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  contractId!: string;

  @ApiProperty({ format: 'uuid' })
  invoiceId!: string;

  @ApiProperty({ enum: [OnboardingDraftStatus.COMPLETED] })
  status!: OnboardingDraftStatus.COMPLETED;
}
