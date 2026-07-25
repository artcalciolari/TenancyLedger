import { InboxOutlined } from '@mui/icons-material';
import { Box, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
      <CircularProgress size={32} aria-label={label} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  );
}

export function PageContentSkeleton({ label = 'Carregando página…' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={34} sx={{ maxWidth: 300 }} />
        <Skeleton variant="rounded" height={22} sx={{ maxWidth: 480 }} />
      </Stack>
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={116} />
        <Skeleton variant="rounded" height={116} />
        <Skeleton variant="rounded" height={116} />
      </Stack>
    </Box>
  );
}

export function AuthFormSkeleton({ label = 'Carregando autenticação…' }: { label?: string }) {
  return (
    <Stack spacing={2.5} role="status" aria-live="polite" aria-label={label}>
      <Skeleton variant="rounded" height={56} />
      <Skeleton variant="rounded" height={56} />
      <Skeleton variant="rounded" height={52} />
    </Stack>
  );
}

export function DashboardSkeleton({ label = 'Carregando visão geral…' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Stack spacing={1} sx={{ mb: 2.5 }}>
        <Skeleton variant="rounded" height={34} sx={{ maxWidth: 260 }} />
        <Skeleton variant="rounded" height={22} sx={{ maxWidth: 420 }} />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 2.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        <Skeleton variant="rounded" height={128} />
        <Skeleton variant="rounded" height={128} />
        <Skeleton variant="rounded" height={128} />
        <Skeleton variant="rounded" height={128} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '5fr 7fr' } }}>
        <Skeleton variant="rounded" height={286} />
        <Skeleton variant="rounded" height={286} />
      </Box>
    </Box>
  );
}

export function ListPageSkeleton({ label = 'Carregando lista…' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={34} sx={{ maxWidth: 220 }} />
        <Skeleton variant="rounded" height={22} sx={{ maxWidth: 380 }} />
      </Stack>
      <Skeleton variant="rounded" height={104} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={44} sx={{ mb: 1 }} />
      <Stack spacing={1}>
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
      </Stack>
    </Box>
  );
}

export function DetailPageSkeleton({ label = 'Carregando detalhes…' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Skeleton variant="rounded" height={22} sx={{ maxWidth: 180, mb: 2 }} />
      <Skeleton variant="rounded" height={34} sx={{ maxWidth: 320, mb: 2.5 }} />
      <Skeleton variant="rounded" height={220} sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Skeleton variant="rounded" height={112} />
        <Skeleton variant="rounded" height={112} />
      </Box>
    </Box>
  );
}

export function FormPageSkeleton({ label = 'Carregando formulário…' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-label={label}>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Skeleton variant="rounded" height={34} sx={{ maxWidth: 280 }} />
        <Skeleton variant="rounded" height={22} sx={{ maxWidth: 420 }} />
      </Stack>
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
      </Stack>
    </Box>
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
