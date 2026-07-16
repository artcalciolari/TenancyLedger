import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TenantCivilStatus } from '../../../domain/entities/tenant.entity';

export class PaginationDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Busca parcial por nome, CPF, profissão, e-mail ou telefone.',
    example: 'engenheiro',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: TenantCivilStatus, enumName: 'TenantCivilStatus' })
  @IsOptional()
  @IsEnum(TenantCivilStatus)
  civilStatus?: TenantCivilStatus;
}
