import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TenantReference } from '../../../domain/entities/tenant-reference.entity';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : (value as unknown);

export class CreateTenantReferenceDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'João da Silva' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Irmão' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  relationship!: string;

  @ApiProperty({ maxLength: 20, example: '+55 11 99999-9999' })
  @Transform(trim)
  @IsPhoneNumber('BR')
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ type: String, format: 'email', maxLength: 254, nullable: true })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : (value as unknown),
  )
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 1000, nullable: true })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() || null : (value as unknown),
  )
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateTenantReferenceDto extends PartialType(CreateTenantReferenceDto) {}

export class TenantReferenceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;
  @ApiProperty({ maxLength: 120 })
  name!: string;
  @ApiProperty({ maxLength: 80 })
  relationship!: string;
  @ApiProperty({ example: '11999999999' })
  phone!: string;
  @ApiProperty({ type: String, format: 'email', nullable: true })
  email!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  verifiedAt!: Date | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  verifiedByUserId!: string | null;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true })
  notes!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static from(reference: TenantReference): TenantReferenceResponseDto {
    return {
      id: reference.id,
      tenantId: reference.tenantId,
      name: reference.name,
      relationship: reference.relationship,
      phone: reference.phone,
      email: reference.email,
      verifiedAt: reference.verifiedAt,
      verifiedByUserId: reference.verifiedByUserId,
      notes: reference.notes,
      createdAt: reference.createdAt,
      updatedAt: reference.updatedAt,
    };
  }
}

export class TenantPhotoUrlResponseDto {
  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({ minimum: 1, maximum: 900, example: 300 })
  expiresInSeconds!: number;
}
