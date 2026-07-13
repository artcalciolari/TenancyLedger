import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from '../domain/entities/user.entity';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const configuredEmail = this.config.get<string>('AUTH_BOOTSTRAP_EMAIL')?.trim().toLowerCase();
    const configuredPassword = this.config.get<string>('AUTH_BOOTSTRAP_PASSWORD');

    if (!configuredEmail && !configuredPassword) {
      this.logger.warn(
        'AUTH_BOOTSTRAP_EMAIL/AUTH_BOOTSTRAP_PASSWORD ausentes; bootstrap do administrador ignorado.',
      );
      return;
    }

    if (!configuredEmail || !configuredPassword) {
      throw new Error(
        'AUTH_BOOTSTRAP_EMAIL e AUTH_BOOTSTRAP_PASSWORD devem ser configurados em conjunto.',
      );
    }

    if (configuredPassword.length < 12) {
      throw new Error('AUTH_BOOTSTRAP_PASSWORD deve conter pelo menos 12 caracteres.');
    }

    const existing = await this.users.findOne({ where: { email: configuredEmail } });
    if (existing) {
      if (existing.role !== UserRole.ADMIN || !existing.active) {
        throw new Error('O usuário de bootstrap existe, mas não é um administrador ativo.');
      }
      return;
    }

    const passwordHash = await hash(configuredPassword, 12);
    await this.users.save(User.create(configuredEmail, passwordHash, UserRole.ADMIN));
    this.logger.log('Administrador inicial criado.');
  }
}
