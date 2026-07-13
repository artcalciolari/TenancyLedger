import { InboxOutlined } from '@mui/icons-material';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
      <CircularProgress size={32} aria-label={label} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  );
}

export function EmptyState({
  title = 'Nenhum registro encontrado',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
      <InboxOutlined color="disabled" sx={{ fontSize: 48 }} aria-hidden />
      <Typography variant="h2" sx={{ mt: 1, fontSize: '1.1rem' }}>
        {title}
      </Typography>
      {description && <Typography color="text.secondary">{description}</Typography>}
    </Box>
  );
}
