import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : (value as unknown);

export class CreateTenantDto {
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Maria da Silva' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '123.456.789-09', pattern: '^\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}$' })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'cpf deve estar em um formato válido' })
  cpf!: string;

  @ApiProperty({ minLength: 5, maxLength: 20, example: '12.345.678-9', writeOnly: true })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Matches(/^[\p{L}\d.\-/]+$/u, { message: 'rg contém caracteres inválidos' })
  rg!: string;

  @ApiProperty({ minLength: 2, maxLength: 100, example: 'Engenheiro civil' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  profession!: string;

  @ApiProperty({ enum: TenantCivilStatus, enumName: 'TenantCivilStatus' })
  @IsEnum(TenantCivilStatus)
  civilStatus!: TenantCivilStatus;

  @ApiProperty({ format: 'email', maxLength: 254, example: 'locatario@example.com' })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: 20, example: '+55 11 99999-9999' })
  @Transform(trim)
  @IsString()
  @IsPhoneNumber('BR')
  @MaxLength(20)
  mobilePhone!: string;
}
