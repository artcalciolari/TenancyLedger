import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { Alert, Avatar, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useRef, type ChangeEvent } from 'react';
import type { PhotoDraftMetadata, PhotoSelection } from '../types';

const acceptedPhotoTypes = 'image/*,.heic,.heif';

interface PhotoStepProps {
  metadata: PhotoDraftMetadata | null;
  selection: PhotoSelection | null;
  remotePhotoUrl: string | null;
  error?: string;
  onSelect: (file: File) => void;
  onSkip: () => void;
}

export function PhotoStep({
  metadata,
  selection,
  remotePhotoUrl,
  error,
  onSelect,
  onSkip,
}: PhotoStepProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onSelect(file);
    event.target.value = '';
  };

  const previewUrl = selection?.previewUrl ?? remotePhotoUrl;
  const needsReselect = metadata && !metadata.skipped && !previewUrl;

  return (
    <Box>
      <Typography variant="h1" component="h2" sx={{ mb: 0.75 }}>
        Foto do locatário
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Use a câmera do iPad ou escolha uma foto já existente. Esta etapa pode ser concluída depois.
      </Typography>

      {needsReselect && (
        <Alert severity="info" sx={{ mb: 2 }}>
          O rascunho lembra a foto “{metadata.name}”, mas o arquivo precisa ser selecionado
          novamente por segurança do navegador. Se preferir, escolha adicionar a foto depois.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            {previewUrl ? (
              <Avatar
                src={previewUrl}
                alt="Prévia da foto do locatário"
                variant="rounded"
                sx={{ width: 220, height: 220, bgcolor: 'action.hover' }}
              />
            ) : (
              <Box
                sx={{
                  width: 180,
                  height: 180,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  color: 'text.secondary',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <AddAPhotoOutlinedIcon sx={{ fontSize: 64 }} aria-hidden />
              </Box>
            )}
            {selection && (
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{selection.file.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {(selection.file.size / 1024 / 1024).toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  MB
                </Typography>
              </Box>
            )}
            {!selection && remotePhotoUrl && (
              <Typography variant="body2" color="text.secondary">
                Foto salva no rascunho.
              </Typography>
            )}
            {metadata?.skipped && !previewUrl && (
              <Alert severity="success" sx={{ width: '100%' }}>
                Foto marcada para ser adicionada depois.
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: '100%' }}>
              <Button
                startIcon={<PhotoCameraOutlinedIcon />}
                onClick={() => cameraInput.current?.click()}
                sx={{ flex: 1 }}
              >
                Abrir câmera
              </Button>
              <Button
                variant="outlined"
                startIcon={<CollectionsOutlinedIcon />}
                onClick={() => galleryInput.current?.click()}
                sx={{ flex: 1 }}
              >
                Escolher da galeria
              </Button>
            </Stack>
            <Button variant="text" onClick={onSkip}>
              Adicionar foto depois
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <input
        ref={cameraInput}
        type="file"
        accept={acceptedPhotoTypes}
        capture="environment"
        hidden
        aria-label="Tirar foto com a câmera"
        onChange={handleFile}
      />
      <input
        ref={galleryInput}
        type="file"
        accept={acceptedPhotoTypes}
        hidden
        aria-label="Selecionar foto da galeria"
        onChange={handleFile}
      />
    </Box>
  );
}
