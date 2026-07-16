import type { components } from './generated/schema';

type Schemas = components['schemas'];

export type UserRole = Schemas['UserRole'];
export type TenantCivilStatus = Schemas['TenantCivilStatus'];
export type UnitType = Schemas['UnitType'];
export type ContractStatus = Schemas['ContractStatus'];
export type InvoiceStatus = Schemas['InvoiceStatus'];
export type PaymentStatus = Schemas['PaymentStatus'];
export type PaymentMethod = Schemas['PaymentMethod'];
export type ProofType = Schemas['ProofType'];

export const USER_ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const satisfies readonly UserRole[];
export const TENANT_CIVIL_STATUSES = [
  'SINGLE',
  'MARRIED',
  'DIVORCED',
  'WIDOWED',
  'STABLE_UNION',
] as const satisfies readonly TenantCivilStatus[];
export const UNIT_TYPES = [
  'KITNET',
  'ROOM',
  'APARTMENT',
  'HOUSE',
  'COMMERCIAL',
] as const satisfies readonly UnitType[];
export const CONTRACT_STATUSES = [
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
] as const satisfies readonly ContractStatus[];
export const INVOICE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
] as const satisfies readonly InvoiceStatus[];
export const PAYMENT_STATUSES = [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const satisfies readonly PaymentStatus[];
export const PAYMENT_METHODS = [
  'PIX',
  'CASH',
  'BANK_TRANSFER',
] as const satisfies readonly PaymentMethod[];
export const PROOF_TYPES = [
  'DIGITAL_SLIP',
  'SIGNED_RECEIPT',
  'BANK_STATEMENT',
] as const satisfies readonly ProofType[];

export type PageMeta = Schemas['PageMetaDto'];
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export type UserView = Schemas['UserResponseDto'];
export type LoginInput = Schemas['LoginDto'];
export type LoginResponse = Schemas['LoginResponseDto'];
export type CreateUserInput = Schemas['CreateUserDto'];
export type UpdateUserAccessInput = Schemas['UpdateUserAccessDto'];
export type ChangePasswordInput = Schemas['ChangePasswordDto'];
export type CreateTenantInput = Schemas['CreateTenantDto'];
export type UpdateTenantInput = Schemas['UpdateTenantDto'];
export type TenantView = Schemas['TenantResponseDto'];
export type CreatePropertyInput = Schemas['CreatePropertyDto'];
export type UpdatePropertyInput = Schemas['UpdatePropertyDto'];
export type PropertyView = Schemas['PropertyResponseDto'];
export type CreateBuildingInput = Schemas['CreateBuildingDto'];
export type UpdateBuildingInput = Schemas['UpdateBuildingDto'];
export type BuildingView = Schemas['BuildingResponseDto'];
export type BuildingDetailView = Schemas['BuildingDetailResponseDto'];
export type BuildingUnitView = Schemas['BuildingUnitResponseDto'];
export type CreateContractInput = Schemas['CreateContractDto'];
export type ContractView = Schemas['ContractResponseDto'];
export type RenewContractInput = Schemas['RenewContractDto'];
export type PaymentView = Schemas['PaymentResponseDto'];
export type InvoiceView = Schemas['InvoiceResponseDto'];
export type RejectPaymentInput = Schemas['RejectPaymentDto'];
export type PaymentProofView = Schemas['PaymentProofUrlResponseDto'];
export type DashboardSummary = Schemas['DashboardSummaryResponseDto'];
export type IdempotentPaymentLookup = Schemas['IdempotentPaymentLookupResponseDto'];
export type NotificationView = Schemas['NotificationResponseDto'];
export type NotificationList = Schemas['PaginatedNotificationsResponseDto'];
export type PaymentReviewItem = Schemas['PaymentReviewItemResponseDto'];

export interface TenantListFilters {
  page: number;
  limit: number;
  q?: string;
  civilStatus?: TenantCivilStatus;
}

export interface PropertyListFilters {
  page: number;
  limit: number;
  q?: string;
  type?: UnitType;
  buildingId?: string;
}

export interface BuildingListFilters {
  page: number;
  limit: number;
  q?: string;
}

export interface ContractListFilters {
  page: number;
  limit: number;
  status?: ContractStatus;
  tenantId?: string;
  propertyUnitId?: string;
  q?: string;
  moveInFrom?: string;
  moveInTo?: string;
  endFrom?: string;
  endTo?: string;
}

export interface InvoiceListFilters {
  page: number;
  limit: number;
  contractId?: string;
  competence?: string;
  status?: InvoiceStatus;
  q?: string;
  dueFrom?: string;
  dueTo?: string;
  tenantId?: string;
  propertyUnitId?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
}

export interface PaymentReviewFilters {
  page: number;
  limit: number;
  q?: string;
  competence?: string;
  method?: PaymentMethod;
  submittedFrom?: string;
  submittedTo?: string;
  tenantId?: string;
  propertyUnitId?: string;
}

export interface SubmitPaymentInput {
  amountCents: number;
  method: PaymentMethod;
  proofType?: ProofType;
  proof?: File;
}
