import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ContractDocumentKind } from './domain/entities/contract-document.entity';

export enum UploadContractDocumentKind {
  SIGNED = 'SIGNED',
  OTHER = 'OTHER',
}

export class UploadContractDocumentDto {
  @ApiProperty({ enum: UploadContractDocumentKind, enumName: 'UploadContractDocumentKind' })
  @IsEnum(UploadContractDocumentKind)
  kind!: UploadContractDocumentKind;
}

export class UploadContractDocumentMultipartDto extends UploadContractDocumentDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  document!: string;
}

export class ContractDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  contractId!: string;
  @ApiProperty({ enum: ContractDocumentKind, enumName: 'ContractDocumentKind' })
  kind!: ContractDocumentKind;
  @ApiProperty({ minimum: 1 })
  version!: number;
  @ApiProperty({ maxLength: 255 })
  originalName!: string;
  @ApiProperty({ maxLength: 100 })
  contentType!: string;
  @ApiProperty({ format: 'uuid' })
  uploadedByUserId!: string;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'uri' })
  url!: string;
  @ApiProperty({ minimum: 1, maximum: 900 })
  expiresInSeconds!: number;
}

export class ContractDocumentDownloadUrlDto {
  @ApiProperty({ format: 'uri' })
  url!: string;
  @ApiProperty({ minimum: 1, maximum: 900 })
  expiresInSeconds!: number;
}
