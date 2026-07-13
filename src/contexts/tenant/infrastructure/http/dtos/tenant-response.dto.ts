import { Tenant, TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { PaginatedTenantView, TenantView } from '../../../application/queries/tenant.queries';

export class TenantResponseDto {
  id!: string;
  cpf!: string;
  profession!: string;
  civilStatus!: TenantCivilStatus;
  email!: string;
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

export interface PaginatedTenantResponseDto {
  data: TenantResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
