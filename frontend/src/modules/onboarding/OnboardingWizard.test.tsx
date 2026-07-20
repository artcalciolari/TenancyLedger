import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createAppTheme } from '../../app/theme/theme';
import { OnboardingWizard } from './OnboardingWizard';
import { createEmptyPayload } from './state';
import type { OnboardingPayload } from './types';

const draftId = '90000000-0000-4000-8000-000000000001';
let savedPayload: OnboardingPayload | null = null;

const server = setupServer(
  http.get('*/api/onboarding-drafts', () => HttpResponse.json({ data: [] })),
  http.post('*/api/onboarding-drafts', async ({ request }) => {
    const body = (await request.json()) as { payload: OnboardingPayload };
    savedPayload = body.payload;
    return HttpResponse.json(
      {
        id: draftId,
        payload: body.payload,
        status: 'DRAFT',
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
      },
      { status: 201 },
    );
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  savedPayload = null;
  server.resetHandlers();
});
afterAll(() => server.close());

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/onboarding', element: <OnboardingWizard /> },
      { path: '/dashboard', element: <div>Visão geral</div> },
    ],
    { initialEntries: ['/onboarding'] },
  );
  render(
    <ThemeProvider theme={createAppTheme()}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}

describe('OnboardingWizard', () => {
  it('valida os dados pessoais e navega para a etapa de foto', async () => {
    renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('O nome deve ter no mínimo 3 caracteres.')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Nome completo'), {
      target: { value: 'Maria da Silva' },
    });
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } });
    fireEvent.change(screen.getByLabelText('RG'), { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText('Profissão'), { target: { value: 'Arquiteta' } });
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'maria@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '11999999999' } });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Foto do locatário' })).toBeVisible();
    expect(screen.getByLabelText('Tirar foto com a câmera')).toHaveAttribute(
      'capture',
      'environment',
    );
  });

  it('salva um rascunho pela API e protege a saída com alterações pendentes', async () => {
    renderWizard();
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Ana' } });

    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText('Rascunho salvo no servidor.')).toBeVisible();
    expect(savedPayload?.personalData.name).toBe('Ana');

    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Ana Paula' } });
    await user.click(screen.getByRole('button', { name: 'Fechar cadastro' }));
    expect(await screen.findByRole('dialog', { name: 'Sair do cadastro?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuar preenchendo' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Sair do cadastro?' })).not.toBeInTheDocument(),
    );
  });

  it('retoma o rascunho mais recente sem usar armazenamento local', async () => {
    const payload = {
      ...createEmptyPayload(),
      personalData: { ...createEmptyPayload().personalData, name: 'Rascunho remoto' },
    };
    server.use(
      http.get('*/api/onboarding-drafts', () =>
        HttpResponse.json({
          data: [
            {
              id: draftId,
              payload,
              status: 'DRAFT',
              createdAt: '2026-07-18T10:00:00.000Z',
              updatedAt: '2026-07-18T12:00:00.000Z',
            },
          ],
        }),
      ),
    );
    renderWizard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Retomar' }));

    expect(screen.getByLabelText('Nome completo')).toHaveValue('Rascunho remoto');
    expect(screen.getByText('Rascunho retomado.')).toBeVisible();
  });

  it('exige reselecionar ou adiar a foto lembrada pelo rascunho', async () => {
    const empty = createEmptyPayload();
    const payload: OnboardingPayload = {
      ...empty,
      personalData: {
        name: 'Marina Oliveira',
        cpf: '52998224725',
        rg: '123456789',
        profession: 'Enfermeira',
        civilStatus: 'SINGLE',
        email: 'marina@example.test',
        mobilePhone: '11999999999',
      },
      photo: { name: 'marina.jpg', type: 'image/jpeg', size: 20_000, skipped: false },
    };
    server.use(
      http.get('*/api/onboarding-drafts', () =>
        HttpResponse.json({
          data: [
            {
              id: draftId,
              payload,
              status: 'DRAFT',
              createdAt: '2026-07-18T10:00:00.000Z',
              updatedAt: '2026-07-18T12:00:00.000Z',
            },
          ],
        }),
      ),
    );
    renderWizard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Retomar' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/o arquivo precisa ser selecionado novamente/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      screen.getByText('Selecione a foto novamente ou marque para adicioná-la depois.'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Foto do locatário' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Adicionar foto depois' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Referências' })).toBeVisible();
  });

  it('retoma um rascunho com foto persistida sem exigir nova seleção', async () => {
    const payload: OnboardingPayload = {
      ...createEmptyPayload(),
      personalData: {
        name: 'Marina Oliveira',
        cpf: '52998224725',
        rg: '123456789',
        profession: 'Enfermeira',
        civilStatus: 'SINGLE',
        email: 'marina@example.test',
        mobilePhone: '11999999999',
      },
      photo: { name: 'marina.jpg', type: 'image/jpeg', size: 20_000, skipped: false },
    };
    server.use(
      http.get('*/api/onboarding-drafts', () =>
        HttpResponse.json({
          data: [
            {
              id: draftId,
              payload,
              status: 'DRAFT',
              hasPhoto: true,
              createdAt: '2026-07-18T10:00:00.000Z',
              updatedAt: '2026-07-18T12:00:00.000Z',
            },
          ],
        }),
      ),
      http.get(`*/api/onboarding-drafts/${draftId}/photo/download`, () =>
        HttpResponse.json({
          url: 'https://storage.example.test/draft-photo.jpg',
          expiresInSeconds: 300,
        }),
      ),
    );
    renderWizard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Retomar' }));
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Foto salva no rascunho.')).toBeVisible();
    expect(
      screen.queryByText(/o arquivo precisa ser selecionado novamente/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Referências' })).toBeVisible();
  });

  it('envia a foto selecionada ao salvar o rascunho', async () => {
    let uploadRequestCount = 0;
    server.use(
      http.post(`*/api/onboarding-drafts/${draftId}/photo`, () => {
        uploadRequestCount += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWizard();
    const user = userEvent.setup();

    fireEvent.change(screen.getByLabelText('Nome completo'), {
      target: { value: 'Maria da Silva' },
    });
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } });
    fireEvent.change(screen.getByLabelText('RG'), { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText('Profissão'), { target: { value: 'Arquiteta' } });
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'maria@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '11999999999' } });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Foto do locatário' })).toBeVisible();

    const file = new File(['conteudo-da-foto'], 'locataria.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Selecionar foto da galeria'), file);
    expect(await screen.findByText('locataria.jpg')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText('Rascunho salvo no servidor.')).toBeVisible();
    expect(uploadRequestCount).toBe(1);
  });

  it('mantém a proteção de saída e permite retry quando a sincronização da foto falha', async () => {
    let uploadAttempts = 0;
    server.use(
      http.patch(`*/api/onboarding-drafts/${draftId}`, async ({ request }) => {
        const body = (await request.json()) as { payload: OnboardingPayload };
        savedPayload = body.payload;
        return HttpResponse.json({
          id: draftId,
          payload: body.payload,
          status: 'DRAFT',
          createdAt: '2026-07-18T12:00:00.000Z',
          updatedAt: '2026-07-18T12:05:00.000Z',
        });
      }),
      http.post(`*/api/onboarding-drafts/${draftId}/photo`, () => {
        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          return new HttpResponse(
            JSON.stringify({ type: 'about:blank', title: 'Error', status: 503, detail: 'Falhou' }),
            { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
          );
        }
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWizard();
    const user = userEvent.setup();

    fireEvent.change(screen.getByLabelText('Nome completo'), {
      target: { value: 'Maria da Silva' },
    });
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224725' } });
    fireEvent.change(screen.getByLabelText('RG'), { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText('Profissão'), { target: { value: 'Arquiteta' } });
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'maria@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '11999999999' } });
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('heading', { name: 'Foto do locatário' })).toBeVisible();

    const file = new File(['conteudo-da-foto'], 'locataria.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Selecionar foto da galeria'), file);
    expect(await screen.findByText('locataria.jpg')).toBeVisible();

    const saveButton = screen.getByRole('button', { name: 'Salvar rascunho' });
    await user.click(saveButton);

    expect(await screen.findByText('Falhou')).toBeVisible();
    expect(uploadAttempts).toBe(1);
    expect(screen.getByText('Alterações ainda não salvas')).toBeVisible();
    expect(saveButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Fechar cadastro' }));
    expect(await screen.findByRole('dialog', { name: 'Sair do cadastro?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuar preenchendo' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Sair do cadastro?' })).not.toBeInTheDocument(),
    );

    await user.click(saveButton);
    expect(await screen.findByText('Rascunho salvo no servidor.')).toBeVisible();
    expect(uploadAttempts).toBe(2);
    expect(screen.getByText('Rascunho salvo')).toBeVisible();
    expect(saveButton).toBeDisabled();
  });

  it('volta à escolha do quarto quando a conclusão encontra conflito de ocupação', async () => {
    const propertyId = '30000000-0000-4000-8000-000000000001';
    const payload: OnboardingPayload = {
      version: 1,
      personalData: {
        name: 'Marina Oliveira',
        cpf: '52998224725',
        rg: '123456789',
        profession: 'Enfermeira',
        civilStatus: 'SINGLE',
        email: 'marina@example.test',
        mobilePhone: '11999999999',
      },
      photo: { name: '', type: '', size: 0, skipped: true },
      references: [
        { name: 'Joana Oliveira', relationship: 'Irmã', phone: '11988888888' },
        { name: 'Carlos Souza', relationship: 'Colega', phone: '11977777777' },
      ],
      propertyUnitId: null,
      moveInDate: '2026-07-18',
      monthlyBaseValueCents: 150_000,
    };
    const draft = {
      id: draftId,
      payload,
      status: 'DRAFT',
      createdAt: '2026-07-18T10:00:00.000Z',
      updatedAt: '2026-07-18T12:00:00.000Z',
    };
    let completionAttempts = 0;
    server.use(
      http.get('*/api/onboarding-drafts', () => HttpResponse.json({ data: [draft] })),
      http.patch(`*/api/onboarding-drafts/${draftId}`, async ({ request }) => {
        const body = (await request.json()) as { payload: OnboardingPayload };
        return HttpResponse.json({ ...draft, payload: body.payload });
      }),
      http.get('*/api/properties/available', () =>
        HttpResponse.json([
          {
            id: propertyId,
            neighborhood: 'Centro',
            type: 'ROOM',
            unitNumber: '12-B',
            buildingId: null,
            buildingName: 'Residencial Aurora',
            occupied: false,
            createdAt: '2026-01-01T12:00:00.000Z',
          },
        ]),
      ),
      http.post(`*/api/onboarding-drafts/${draftId}/complete`, () => {
        completionAttempts += 1;
        const detail =
          completionAttempts === 1
            ? 'O rascunho já foi concluído ou descartado.'
            : 'A unidade já está ocupada.';
        return new HttpResponse(
          JSON.stringify({
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            detail,
          }),
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );
    renderWizard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Retomar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Foto do locatário' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Referências' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Escolha o quarto' })).toBeVisible();
    await user.click(await screen.findByRole('radio'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Revisão do cadastro' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Concluir cadastro' }));

    expect(await screen.findByText('O rascunho já foi concluído ou descartado.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Concluir cadastro' }));

    expect(await screen.findByRole('heading', { name: 'Escolha o quarto' })).toBeVisible();
    expect(screen.getByText('A unidade selecionada não está mais disponível.')).toBeVisible();
    expect(
      screen.getByText('Este quarto acabou de ser ocupado. Escolha outra unidade para continuar.'),
    ).toBeVisible();
  });
});
