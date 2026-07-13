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

export class CreateUserDto {
  @IsEmail({ require_tld: true })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'password deve conter letra minúscula, maiúscula, número e símbolo',
  })
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

export class UserPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class UpdateUserAccessDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsBoolean()
  active!: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'newPassword deve conter letra minúscula, maiúscula, número e símbolo',
  })
  newPassword!: string;
}
