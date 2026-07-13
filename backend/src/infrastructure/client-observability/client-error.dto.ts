import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export enum ClientErrorKind {
  RUNTIME = 'RUNTIME',
  RENDER = 'RENDER',
  NETWORK = 'NETWORK',
}

export class ClientErrorDto {
  @ApiProperty({ enum: ClientErrorKind, enumName: 'ClientErrorKind' })
  @IsEnum(ClientErrorKind)
  kind!: ClientErrorKind;

  @ApiProperty({
    description: 'Impressão digital opaca; mensagens e stacks nunca são recebidas.',
    pattern: '^[0-9a-f]{16}$',
    example: '5f9c6bb1a4438e12',
  })
  @Matches(/^[0-9a-f]{16}$/)
  fingerprint!: string;

  @ApiProperty({ description: 'Somente o pathname, sem query string ou fragmento.' })
  @IsString()
  @MaxLength(240)
  @Matches(/^\/(?!\/)[^?#]*$/)
  route!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  release?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 599 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(599)
  status?: number;
}
