import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';

export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, ['cpf', 'rg'] as const),
) {
  @ApiPropertyOptional({
    description: 'Campo imutável; presente apenas para explicitar a rejeição de alterações.',
  })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional({
    description: 'Campo imutável; presente apenas para explicitar a rejeição de alterações.',
  })
  @IsOptional()
  @IsString()
  rg?: string;
}
