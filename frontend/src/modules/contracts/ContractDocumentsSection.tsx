import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';
import { queryKeys } from '../../api/query-keys';
import { ApiError } from '../../api/problem';
import { formatDateTime } from '../../lib/dates/dates';
import { contractsApi, type ContractDocumentView } from './api';

interface ContractDocumentsSectionProps {
  contractId: string;
  mayManage: boolean;
  canPreview: boolean;
}

function documentDate(document: ContractDocumentView): string {
  return document.createdAt;
}

function documentLabel(document: ContractDocumentView): string {
  if (document.kind === 'SIGNED') return `Contrato assinado · versão ${document.version}`;
  if (document.kind === 'GENERATED') return `Contrato gerado · versão ${document.version}`;
  return `Outro documento · versão ${document.version}`;
}

export function ContractDocumentsSection({
  contractId,
  mayManage,
  canPreview,
}: ContractDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const documents = useQuery({
    queryKey: ['contract-documents', contractId],
    queryFn: () => contractsApi.listDocuments(contractId),
  });
  const preview = useMutation({ mutationFn: () => contractsApi.previewDocument(contractId) });
  const generate = useMutation({
    mutationFn: () => contractsApi.generateDocument(contractId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contract-documents', contractId] });
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => contractsApi.uploadSignedDocument(contractId, file),
    onSuccess: async () => {
      setMessage('Documento assinado anexado. O contrato foi atualizado.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contract-documents', contractId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
        queryClient.invalidateQueries({ queryKey: ['contracts'] }),
      ]);
    },
  });

  const openPreview = async () => {
    const popup = window.open('', '_blank');
    try {
      const blob = await preview.mutateAsync();
      const url = URL.createObjectURL(blob);
      if (popup) {
        popup.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      popup?.close();
    }
  };

  const printDocument = async () => {
    const popup = window.open('', '_blank');
    try {
      const generated = await generate.mutateAsync();
      if (popup) {
        popup.location.href = generated.url;
        popup.addEventListener('load', () => popup.print(), { once: true });
      } else {
        window.open(generated.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      popup?.close();
    }
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage('O documento deve ter no máximo 10 MB.');
      return;
    }
    setMessage(null);
    upload.mutate(file);
  };

  const problem = preview.error ?? generate.error ?? upload.error;
  const problemMessage =
    problem instanceof ApiError
      ? problem.problem.detail
      : problem
        ? 'Não foi possível concluir a operação com o documento.'
        : null;

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.25, sm: 2.75 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Box>
            <Typography component="h2" variant="h2">
              Documentos do contrato
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gere a via para assinatura e preserve todas as versões assinadas.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {canPreview && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<VisibilityOutlinedIcon />}
                  disabled={preview.isPending}
                  onClick={() => void openPreview()}
                >
                  Pré-visualizar
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintOutlinedIcon />}
                  disabled={generate.isPending}
                  onClick={() => void printDocument()}
                >
                  Imprimir
                </Button>
              </>
            )}
            {mayManage && (
              <Button
                startIcon={<CloudUploadOutlinedIcon />}
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? 'Enviando…' : 'Anexar assinado'}
              </Button>
            )}
          </Stack>
        </Stack>
        {problemMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {problemMessage}
          </Alert>
        )}
        {message && (
          <Alert severity={message.includes('máximo') ? 'error' : 'success'} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
        <Divider sx={{ my: 2.5 }} />
        {documents.isPending ? (
          <Typography color="text.secondary">Carregando documentos…</Typography>
        ) : documents.isError ? (
          <Alert severity="error">Não foi possível carregar o histórico de documentos.</Alert>
        ) : documents.data.length === 0 ? (
          <Typography color="text.secondary">Nenhum documento armazenado.</Typography>
        ) : (
          <Stack spacing={1.25}>
            {documents.data.map((document) => {
              return (
                <Stack
                  key={document.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ alignItems: { sm: 'center' }, py: 0.5 }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 650 }}>{documentLabel(document)}</Typography>
                    {documentDate(document) && (
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(documentDate(document))}
                      </Typography>
                    )}
                  </Box>
                  <Link href={document.url} target="_blank" rel="noreferrer" underline="hover">
                    <OpenInNewOutlinedIcon sx={{ mr: 0.75, fontSize: 18 }} /> Abrir
                  </Link>
                </Stack>
              );
            })}
          </Stack>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          hidden
          aria-label="Selecionar contrato assinado"
          onChange={selectFile}
        />
      </CardContent>
    </Card>
  );
}
