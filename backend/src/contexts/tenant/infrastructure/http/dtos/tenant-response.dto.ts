import { Tenant, TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { PaginatedTenantView, TenantView } from '../../../application/queries/tenant.queries';
import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../../../../core/infrastructure/http/openapi.dto';
import { UserRole } from '../../../../auth/domain/entities/user.entity';

const UNMASKED_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.MANAGER]);

export class TenantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Maria da Silva' })
  name!: string;
  @ApiProperty({ example: '***.***.***-09', description: 'CPF mascarado para VIEWER.' })
  cpf!: string;
  @ApiProperty({ example: 'Engenheiro civil' })
  profession!: string;
  @ApiProperty({ enum: TenantCivilStatus, enumName: 'TenantCivilStatus' })
  civilStatus!: TenantCivilStatus;
  @ApiProperty({ example: 'l***@example.com', description: 'E-mail mascarado para VIEWER.' })
  email!: string;
  @ApiProperty({ example: '(**) *****-9999', description: 'Telefone mascarado para VIEWER.' })
  mobilePhone!: string;
  @ApiProperty({ description: 'Indica se há uma foto privada cadastrada para o locatário.' })
  hasPhoto!: boolean;

  static from(tenant: Tenant | TenantView, role?: UserRole): TenantResponseDto {
    const unmask = role !== undefined && UNMASKED_ROLES.has(role);
    return {
      id: tenant.id,
      name: tenant.name,
      cpf: unmask ? tenant.cpf : this.maskCpf(tenant.cpf),
      profession: tenant.profession,
      civilStatus: tenant.civilStatus,
      email: unmask ? tenant.email : this.maskEmail(tenant.email),
      mobilePhone: unmask ? tenant.mobilePhone : this.maskPhone(tenant.mobilePhone),
      hasPhoto:
        tenant instanceof Tenant ? tenant.photoStorageKey !== null : tenant.hasPhoto === true,
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

export function toPaginatedTenantResponse(
  result: PaginatedTenantView,
  role?: UserRole,
): PaginatedTenantResponseDto {
  return {
    data: result.data.map((tenant) => TenantResponseDto.from(tenant, role)),
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    },
  };
}
