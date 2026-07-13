import { ApiProperty } from '@nestjs/swagger';

export class DashboardContractSummaryDto {
  @ApiProperty({ minimum: 0 })
  total!: number;
  @ApiProperty({ minimum: 0 })
  active!: number;
  @ApiProperty({ minimum: 0 })
  expired!: number;
  @ApiProperty({ minimum: 0 })
  terminated!: number;
  @ApiProperty({ minimum: 0, description: 'Contratos ativos que vencem nos próximos 30 dias.' })
  expiringNext30Days!: number;
}

export class DashboardInvoiceSummaryDto {
  @ApiProperty({ minimum: 0 })
  total!: number;
  @ApiProperty({ minimum: 0 })
  totalValueCents!: number;
  @ApiProperty({ minimum: 0 })
  approvedAmountCents!: number;
  @ApiProperty({ minimum: 0 })
  outstandingAmountCents!: number;
  @ApiProperty({ minimum: 0 })
  overdueAmountCents!: number;
  @ApiProperty({ minimum: 0 })
  underReview!: number;
}

export class DashboardPaymentSummaryDto {
  @ApiProperty({ minimum: 0 })
  submitted!: number;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ type: String, format: 'date' })
  asOf!: string;
  @ApiProperty({ type: DashboardContractSummaryDto })
  contracts!: DashboardContractSummaryDto;
  @ApiProperty({ type: DashboardInvoiceSummaryDto })
  invoices!: DashboardInvoiceSummaryDto;
  @ApiProperty({ type: DashboardPaymentSummaryDto })
  payments!: DashboardPaymentSummaryDto;
}
