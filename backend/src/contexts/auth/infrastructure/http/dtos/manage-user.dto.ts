import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  Matches,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../domain/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ format: 'email', maxLength: 254, example: 'gestor@example.com' })
  @IsEmail({ require_tld: true })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
    description: 'Deve conter minúscula, maiúscula, número e símbolo.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'password deve conter letra minúscula, maiúscula, número e símbolo',
  })
  password!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.MANAGER })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class UserPaginationDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class UpdateUserAccessDto {
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ description: 'Define se o usuário pode autenticar e usar tokens existentes.' })
  @IsBoolean()
  active!: boolean;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
    description: 'Deve conter minúscula, maiúscula, número e símbolo.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'newPassword deve conter letra minúscula, maiúscula, número e símbolo',
  })
  newPassword!: string;
}
