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

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : (value as unknown);

export class CreateTenantDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'cpf deve estar em um formato válido' })
  cpf!: string;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  @Matches(/^[\p{L}\d.\-/]+$/u, { message: 'rg contém caracteres inválidos' })
  rg!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  profession!: string;

  @IsEnum(TenantCivilStatus)
  civilStatus!: TenantCivilStatus;

  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @IsPhoneNumber('BR')
  @MaxLength(20)
  mobilePhone!: string;
}
