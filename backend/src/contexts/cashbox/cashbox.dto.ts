import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashClosing, CashClosingStatus } from './domain/cash-closing.entity';

export class CloseCashboxDto {
  @ApiProperty({ minimum: 0, maximum: CashClosing.MAX_MONEY_CENTS, example: 125000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(CashClosing.MAX_MONEY_CENTS)
  countedCashCents!: number;
}

export class ReopenCashboxDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CashClosingListQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

export class CashClosingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date' })
  closingDate!: string;

  @ApiProperty({ minimum: 0 })
  expectedCashCents!: number;

  @ApiProperty({ minimum: 0 })
  countedCashCents!: number;

  @ApiProperty({ description: 'countedCashCents - expectedCashCents; pode ser negativo.' })
  differenceCents!: number;

  @ApiProperty({ enum: CashClosingStatus, enumName: 'CashClosingStatus' })
  status!: CashClosingStatus;

  @ApiProperty({ format: 'uuid' })
  closedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  closedAt!: Date;

  @ApiProperty({ type: String, nullable: true, maxLength: 500 })
  reopenReason!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reopenedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reopenedAt!: Date | null;
}
