import { IsEmail, IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';

export class CreateTenantDto
{
  @IsString()
  @IsNotEmpty()
  readonly cpf!: string;

  @IsString()
  @IsNotEmpty()
  readonly rg!: string;

  @IsString()
  @IsNotEmpty()
  readonly profession!: string;

  @IsString()
  @IsNotEmpty()
  readonly civilStatus!: string;

  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @IsString()
  @IsPhoneNumber('BR')
  readonly mobile!: string;
}
