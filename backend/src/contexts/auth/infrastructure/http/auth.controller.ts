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
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiCreatedResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from '../../application/auth.service';
import type { AuthenticatedUser } from '../../application/auth.service';
import { REFRESH_TOKEN_COOKIE } from '../../application/refresh-session.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Autenticar e obter um JWT de acesso' })
  @ApiOkResponse({
    type: LoginResponseDto,
    headers: {
      'Set-Cookie': {
        description: 'Define o refresh token opaco em cookie HttpOnly e SameSite=Strict.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiProblemResponse(401, 'E-mail ou senha inválidos.')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const { refreshToken, ...result } = await this.authService.login(dto.email, dto.password);
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiCookieAuth('refreshCookie')
  @ApiOperation({ summary: 'Rotacionar a sessão e obter um novo JWT de acesso' })
  @ApiOkResponse({
    type: LoginResponseDto,
    headers: {
      'Set-Cookie': {
        description: 'Rotaciona o refresh token opaco no cookie HttpOnly.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiProblemResponse(401, 'Refresh token ausente, inválido, expirado ou reutilizado.')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    try {
      const { refreshToken, ...result } = await this.authService.refresh(
        this.readRefreshCookie(request),
      );
      this.setRefreshCookie(response, refreshToken);
      return result;
    } catch (error: unknown) {
      response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions(false));
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiCookieAuth('refreshCookie')
  @ApiOperation({ summary: 'Encerrar e revogar a família da sessão atual' })
  @ApiNoContentResponse({
    description: 'Sessão revogada e cookie removido.',
    headers: {
      'Set-Cookie': {
        description: 'Expira o cookie de refresh.',
        schema: { type: 'string' },
      },
    },
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      await this.authService.logout(this.readRefreshCookie(request));
    } finally {
      response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions(false));
    }
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

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_TOKEN_COOKIE, token, this.cookieOptions(true));
  }

  private readRefreshCookie(request: Request): string | undefined {
    const header = request.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== REFRESH_TOKEN_COOKIE) continue;
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private cookieOptions(includeLifetime: boolean): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
    if (includeLifetime) {
      options.maxAge =
        this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
    }
    return options;
  }
}
