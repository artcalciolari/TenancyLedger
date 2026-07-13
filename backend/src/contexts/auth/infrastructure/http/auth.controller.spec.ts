import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthService } from '../../application/auth.service';
import { REFRESH_TOKEN_COOKIE } from '../../application/refresh-session.service';
import { UserRole } from '../../domain/entities/user.entity';
import { AuthController } from './auth.controller';

const user = {
  id: '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  active: true,
};

describe('AuthController refresh cookie', () => {
  let auth: jest.Mocked<AuthService>;
  let response: { cookie: jest.Mock; clearCookie: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    auth = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthService>;
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue('production'),
      getOrThrow: jest.fn().mockReturnValue(30),
    } as unknown as ConfigService;
    controller = new AuthController(auth, config);
  });

  it('remove o refresh token do corpo e o envia em cookie seguro HttpOnly Strict', async () => {
    auth.login.mockResolvedValue({
      accessToken: 'access.jwt',
      refreshToken: 'opaque-refresh-token',
      user,
    });

    await expect(
      controller.login(
        { email: user.email, password: 'Strong-password-123!' },
        response as unknown as Response,
      ),
    ).resolves.toEqual({ accessToken: 'access.jwt', user });
    expect(response.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, 'opaque-refresh-token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  });

  it('lê o cookie, rotaciona e substitui seu valor', async () => {
    auth.refresh.mockResolvedValue({
      accessToken: 'next.jwt',
      refreshToken: 'next-refresh-token',
      user,
    });
    const request = {
      headers: { cookie: `theme=dark; ${REFRESH_TOKEN_COOKIE}=current-refresh-token` },
    } as Request;

    await expect(controller.refresh(request, response as unknown as Response)).resolves.toEqual({
      accessToken: 'next.jwt',
      user,
    });
    expect(auth.refresh.mock.calls).toContainEqual(['current-refresh-token']);
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'next-refresh-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });

  it('revoga a sessão e limpa o cookie no logout', async () => {
    const request = {
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=current-refresh-token` },
    } as Request;

    await controller.logout(request, response as unknown as Response);
    expect(auth.logout.mock.calls).toContainEqual(['current-refresh-token']);
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
    });
  });

  it('limpa o cookie mesmo quando a revogação remota falha', async () => {
    auth.logout.mockRejectedValue(new Error('database unavailable'));
    const request = {
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=current-refresh-token` },
    } as Request;

    await expect(controller.logout(request, response as unknown as Response)).rejects.toThrow(
      'database unavailable',
    );
    expect(response.clearCookie.mock.calls).toContainEqual([
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    ]);
  });

  it('limpa o cookie quando a rotação é recusada', async () => {
    auth.refresh.mockRejectedValue(new Error('replay'));
    const request = {
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=replayed-refresh-token` },
    } as Request;

    await expect(controller.refresh(request, response as unknown as Response)).rejects.toThrow(
      'replay',
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });
});
