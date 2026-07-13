import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../domain/entities/user.entity';
import { PageMetaDto } from '../../../../../core/infrastructure/http/openapi.dto';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'gestor@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  @ApiProperty({ description: 'Indica se o usuário pode autenticar.' })
  active!: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT de acesso.', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' })
  accessToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
