import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageMetaDto {
  @ApiProperty({ minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100, example: 20 })
  limit!: number;

  @ApiProperty({ minimum: 0, example: 42 })
  total!: number;

  @ApiProperty({ minimum: 0, example: 3 })
  totalPages!: number;
}

export class ProblemDetailsDto {
  @ApiProperty({
    format: 'uri',
    example: 'https://tenancy-ledger.local/problems/http-400',
  })
  type!: string;

  @ApiProperty({ example: 'BadRequestException' })
  title!: string;

  @ApiProperty({ minimum: 400, maximum: 599, example: 400 })
  status!: number;

  @ApiProperty({ example: 'A requisição contém dados inválidos.' })
  detail!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Demais mensagens de validação, quando houver mais de uma.',
  })
  errors?: string[];

  @ApiProperty({ example: '/contracts?page=0' })
  instance!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0f2a9a56-b0d5-4ac5-8f1e-791e9fc92347',
  })
  requestId!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-07-12T18:30:00.000Z' })
  timestamp!: string;
}

export class AppInfoResponseDto {
  @ApiProperty({ example: 'Tenancy Ledger API' })
  name!: 'Tenancy Ledger API';

  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: '/docs' })
  documentation!: '/docs';
}

export class HealthLiveResponseDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ format: 'date-time', example: '2026-07-12T18:30:00.000Z' })
  timestamp!: string;
}

export class HealthIndicatorStatusDto {
  @ApiProperty({ enum: ['up'], example: 'up' })
  status!: 'up';
}

export class HealthReadyInfoDto {
  @ApiProperty({ type: HealthIndicatorStatusDto })
  database!: HealthIndicatorStatusDto;

  @ApiProperty({ type: HealthIndicatorStatusDto })
  objectStorage!: HealthIndicatorStatusDto;
}

export class HealthReadyResponseDto {
  @ApiProperty({ enum: ['ok', 'error', 'shutting_down'], example: 'ok' })
  status!: 'ok' | 'error' | 'shutting_down';

  @ApiPropertyOptional({ type: HealthReadyInfoDto })
  info?: HealthReadyInfoDto;

  @ApiPropertyOptional({ type: HealthReadyInfoDto })
  error?: HealthReadyInfoDto;

  @ApiProperty({ type: HealthReadyInfoDto })
  details!: HealthReadyInfoDto;
}
