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
import { AuthService } from '../../application/auth.service';
import type { AuthenticatedUser } from '../../application/auth.service';
import { UserRole } from '../../domain/entities/user.entity';
import { CurrentUser } from '../security/current-user.decorator';
import { Public } from '../security/public.decorator';
import { Roles } from '../security/roles.decorator';
import { LoginDto } from './dtos/login.dto';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserAccessDto,
  UserPaginationDto,
} from './dtos/manage-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  createUser(@Body() dto: CreateUserDto): Promise<AuthenticatedUser> {
    return this.authService.createUser(dto.email, dto.password, dto.role);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  listUsers(@Query() query: UserPaginationDto): ReturnType<AuthService['listUsers']> {
    return this.authService.listUsers(query.page, query.limit);
  }

  @Patch('users/:id/access')
  @Roles(UserRole.ADMIN)
  updateUserAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserAccessDto,
  ): Promise<AuthenticatedUser> {
    return this.authService.updateUserAccess(id, dto.role, dto.active, actor.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
