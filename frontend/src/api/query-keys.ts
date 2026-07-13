export const queryKeys = {
  users: (page: number, limit: number) => ['users', { page, limit }] as const,
  tenants: (page: number, limit: number) => ['tenants', { page, limit }] as const,
  tenant: (id: string) => ['tenant', id] as const,
  properties: (page: number, limit: number) => ['properties', { page, limit }] as const,
  property: (id: string) => ['property', id] as const,
  contracts: (filters: object) => ['contracts', filters] as const,
  contract: (id: string) => ['contract', id] as const,
  invoices: (filters: object) => ['invoices', filters] as const,
  invoice: (id: string) => ['invoice', id] as const,
  paymentReview: (page: number, limit: number) => ['payments', 'review', { page, limit }] as const,
};
