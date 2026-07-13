import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminBootstrapService } from './application/admin-bootstrap.service';
import { AuthService } from './application/auth.service';
import { RefreshSessionService } from './application/refresh-session.service';
import { RefreshSession } from './domain/entities/refresh-session.entity';
import { User } from './domain/entities/user.entity';
import { AuthController } from './infrastructure/http/auth.controller';
import { JwtAuthGuard } from './infrastructure/security/jwt-auth.guard';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';
import { RolesGuard } from './infrastructure/security/roles.guard';

function jwtExpirationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error('JWT_EXPIRES_IN deve usar o formato 15m, 1h ou 1d.');
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const multiplier = unit ? multipliers[unit] : undefined;
  if (!multiplier) {
    throw new Error('Unidade de expiração JWT inválida.');
  }
  return amount * multiplier;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshSession]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET deve conter pelo menos 32 caracteres.');
        }
        return {
          secret,
          signOptions: {
            expiresIn: jwtExpirationSeconds(config.get<string>('JWT_EXPIRES_IN') ?? '15m'),
            algorithm: 'HS256',
            issuer: config.getOrThrow<string>('JWT_ISSUER'),
            audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshSessionService,
    AdminBootstrapService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule {}
