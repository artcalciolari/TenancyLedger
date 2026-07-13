import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from '../../application/auth.service';
import type { AuthenticatedUser } from '../../application/auth.service';
import { UserRole } from '../../domain/entities/user.entity';
import { CurrentUser } from '../security/current-user.decorator';
import { Public } from '../security/public.decorator';
import { Roles } from '../security/roles.decorator';
import { LoginDto } from './dtos/login.dto';
import {
  LoginResponseDto,
  PaginatedUsersResponseDto,
  UserResponseDto,
} from './dtos/auth-response.dto';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserAccessDto,
  UserPaginationDto,
} from './dtos/manage-user.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProblemResponse,
  ApiProtected,
} from '../../../../core/infrastructure/http/openapi.decorators';

@ApiTags('Autenticação e usuários')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Autenticar e obter um JWT de acesso' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiProblemResponse(401, 'E-mail ou senha inválidos.')
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  @ApiProtected()
  @ApiOperation({ summary: 'Criar usuário' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictProblem('Já existe um usuário com este e-mail.')
  createUser(@Body() dto: CreateUserDto): Promise<AuthenticatedUser> {
    return this.authService.createUser(dto.email, dto.password, dto.role);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiProtected()
  @ApiOperation({ summary: 'Listar usuários' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  listUsers(@Query() query: UserPaginationDto): ReturnType<AuthService['listUsers']> {
    return this.authService.listUsers(query.page, query.limit);
  }

  @Patch('users/:id/access')
  @Roles(UserRole.ADMIN)
  @ApiProtected()
  @ApiOperation({ summary: 'Alterar papel e estado de acesso de um usuário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundProblem('Usuário não encontrado.')
  @ApiConflictProblem('A alteração removeria o próprio acesso ou o último administrador ativo.')
  updateUserAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserAccessDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.updateUserAccess(id, dto.role, dto.active, actor.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiProtected()
  @ApiOperation({ summary: 'Alterar a própria senha' })
  @ApiNoContentResponse({ description: 'Senha alterada e tokens anteriores invalidados.' })
  @ApiProblemResponse(401, 'Senha atual inválida.')
  @ApiConflictProblem('A nova senha deve ser diferente da senha atual.')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
