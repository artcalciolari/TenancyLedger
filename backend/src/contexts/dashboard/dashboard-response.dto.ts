import { ApiProperty } from '@nestjs/swagger';

export class DashboardPeriodDto {
  @ApiProperty({ type: String, format: 'date', description: 'Início do período de recebimentos.' })
  from!: string;

  @ApiProperty({ type: String, format: 'date', description: 'Fim do período de recebimentos.' })
  to!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Limite inclusivo da projeção de renovações (data-base + 30 dias).',
  })
  forecastThrough!: string;
}

export class DashboardPropertyBreakdownDto {
  @ApiProperty({ format: 'uuid' })
  propertyUnitId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  buildingId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  buildingName!: string | null;

  @ApiProperty()
  neighborhood!: string;

  @ApiProperty()
  unitNumber!: string;

  @ApiProperty({ minimum: 0 })
  receivedCents!: number;

  @ApiProperty({ minimum: 0 })
  confirmedReceivableCents!: number;

  @ApiProperty({ minimum: 0 })
  forecastRenewalsCents!: number;
}

export class DashboardBuildingBreakdownDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Nulo para o grupo de imóveis sem prédio do bairro informado.',
  })
  buildingId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  buildingName!: string | null;

  @ApiProperty()
  neighborhood!: string;

  @ApiProperty({ minimum: 1 })
  propertyUnitCount!: number;

  @ApiProperty({ minimum: 0 })
  receivedCents!: number;

  @ApiProperty({ minimum: 0 })
  confirmedReceivableCents!: number;

  @ApiProperty({ minimum: 0 })
  forecastRenewalsCents!: number;
}

export class DashboardDailyPointDto {
  @ApiProperty({ type: String, format: 'date' })
  date!: string;

  @ApiProperty({ minimum: 0 })
  receivedCents!: number;

  @ApiProperty({ minimum: 0 })
  confirmedReceivableCents!: number;

  @ApiProperty({ minimum: 0 })
  forecastRenewalsCents!: number;
}

export class DashboardFinancialSummaryDto {
  @ApiProperty({ minimum: 0, description: 'Pagamentos aprovados e não estornados no período.' })
  receivedCents!: number;

  @ApiProperty({
    minimum: 0,
    description: 'Saldo de todas as faturas emitidas OPEN, PARTIALLY_PAID ou OVERDUE.',
  })
  confirmedReceivableCents!: number;

  @ApiProperty({
    minimum: 0,
    description: 'Períodos mensais ainda não faturados, projetados nos próximos 30 dias.',
  })
  forecastRenewalsCents!: number;

  @ApiProperty({ type: [DashboardPropertyBreakdownDto] })
  byProperty!: DashboardPropertyBreakdownDto[];

  @ApiProperty({
    type: [DashboardBuildingBreakdownDto],
    description: 'Totais por prédio; imóveis sem prédio são agrupados por bairro.',
  })
  byBuilding!: DashboardBuildingBreakdownDto[];

  @ApiProperty({ type: [DashboardDailyPointDto] })
  daily!: DashboardDailyPointDto[];
}

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

  @ApiProperty({ type: DashboardPeriodDto })
  period!: DashboardPeriodDto;

  @ApiProperty({ type: DashboardFinancialSummaryDto })
  financial!: DashboardFinancialSummaryDto;

  @ApiProperty({ type: DashboardContractSummaryDto })
  contracts!: DashboardContractSummaryDto;
  @ApiProperty({ type: DashboardInvoiceSummaryDto })
  invoices!: DashboardInvoiceSummaryDto;
  @ApiProperty({ type: DashboardPaymentSummaryDto })
  payments!: DashboardPaymentSummaryDto;
}
