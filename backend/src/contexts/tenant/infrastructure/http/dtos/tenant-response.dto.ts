import { Tenant, TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { PaginatedTenantView, TenantView } from '../../../application/queries/tenant.queries';
import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../../../../core/infrastructure/http/openapi.dto';

export class TenantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: '***.***.***-09', description: 'CPF mascarado.' })
  cpf!: string;
  @ApiProperty({ example: 'Engenheiro civil' })
  profession!: string;
  @ApiProperty({ enum: TenantCivilStatus, enumName: 'TenantCivilStatus' })
  civilStatus!: TenantCivilStatus;
  @ApiProperty({ example: 'l***@example.com', description: 'E-mail mascarado.' })
  email!: string;
  @ApiProperty({ example: '(**) *****-9999', description: 'Telefone mascarado.' })
  mobilePhone!: string;

  static from(tenant: Tenant | TenantView): TenantResponseDto {
    return {
      id: tenant.id,
      cpf: this.maskCpf(tenant.cpf),
      profession: tenant.profession,
      civilStatus: tenant.civilStatus,
      email: this.maskEmail(tenant.email),
      mobilePhone: this.maskPhone(tenant.mobilePhone),
    };
  }

  private static maskCpf(cpf: string): string {
    return `***.***.***-${cpf.slice(-2)}`;
  }

  private static maskEmail(email: string): string {
    const [localPart = '', domain = ''] = email.split('@');
    return `${localPart.slice(0, 1)}***@${domain}`;
  }

  private static maskPhone(phone: string): string {
    return `(**) *****-${phone.slice(-4)}`;
  }
}

export class PaginatedTenantResponseDto {
  @ApiProperty({ type: [TenantResponseDto] })
  data!: TenantResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export function toPaginatedTenantResponse(result: PaginatedTenantView): PaginatedTenantResponseDto {
  return {
    data: result.data.map((tenant) => TenantResponseDto.from(tenant)),
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    },
  };
}
