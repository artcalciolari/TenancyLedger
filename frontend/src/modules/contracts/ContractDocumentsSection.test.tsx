import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractDocumentsSection } from './ContractDocumentsSection';

const { listDocuments, previewDocument, generateDocument, uploadSignedDocument } = vi.hoisted(
  () => ({
    listDocuments: vi.fn(),
    previewDocument: vi.fn(),
    generateDocument: vi.fn(),
    uploadSignedDocument: vi.fn(),
  }),
);

vi.mock('./api', () => ({
  contractsApi: { listDocuments, previewDocument, generateDocument, uploadSignedDocument },
}));

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ContractDocumentsSection contractId="contract-id" mayManage canPreview />
    </QueryClientProvider>,
  );
}

describe('ContractDocumentsSection', () => {
  beforeEach(() => {
    listDocuments.mockReset();
    previewDocument.mockReset();
    generateDocument.mockReset();
    uploadSignedDocument.mockReset();
    listDocuments.mockResolvedValue([]);
  });

  it('anexa o contrato assinado e atualiza o histórico', async () => {
    uploadSignedDocument.mockResolvedValue({ id: 'document-id' });
    renderSection();
    const file = new File(['signed'], 'contrato-assinado.pdf', { type: 'application/pdf' });
    const input = await screen.findByLabelText('Selecionar contrato assinado');

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadSignedDocument).toHaveBeenCalledWith('contract-id', file));
    expect(await screen.findByText(/Documento assinado anexado/)).toBeVisible();
  });

  it('solicita a prévia PDF pelo cliente autenticado', async () => {
    previewDocument.mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
    const popup = {
      location: { href: '' },
      addEventListener: vi.fn(),
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:contract-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

    await waitFor(() => expect(previewDocument).toHaveBeenCalledWith('contract-id'));
    expect(popup.location.href).toBe('blob:contract-preview');
  });

  it('gera uma versão persistida ao imprimir e atualiza o histórico', async () => {
    listDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'generated-id',
        contractId: 'contract-id',
        kind: 'GENERATED',
        version: 1,
        originalName: 'contrato.pdf',
        contentType: 'application/pdf',
        uploadedByUserId: 'user-id',
        createdAt: '2026-07-18T12:00:00.000Z',
        url: 'https://storage.example.test/generated.pdf',
        expiresInSeconds: 300,
      },
    ]);
    generateDocument.mockResolvedValue({
      id: 'generated-id',
      contractId: 'contract-id',
      kind: 'GENERATED',
      version: 1,
      originalName: 'contrato.pdf',
      contentType: 'application/pdf',
      uploadedByUserId: 'user-id',
      createdAt: '2026-07-18T12:00:00.000Z',
      url: 'https://storage.example.test/generated.pdf',
      expiresInSeconds: 300,
    });
    const popup = {
      location: { href: '' },
      addEventListener: vi.fn(),
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Imprimir' }));

    await waitFor(() => expect(generateDocument).toHaveBeenCalledWith('contract-id'));
    expect(popup.location.href).toBe('https://storage.example.test/generated.pdf');
    expect(await screen.findByText(/Contrato gerado · versão 1/)).toBeVisible();
  });
});
