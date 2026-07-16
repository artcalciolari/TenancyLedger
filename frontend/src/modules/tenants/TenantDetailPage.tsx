import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { Alert, Box, Card, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { TechnicalDetails } from '../../components/data-display/TechnicalDetails';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { tenantsApi } from './api';
import { civilStatusLabel } from './labels';

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: brand.textTertiary,
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={uppercaseLabelSx}>{label}</Typography>
      <Typography sx={{ overflowWrap: 'anywhere', mt: 0.5, color: brand.textPrimary }}>
        {value}
      </Typography>
    </Box>
  );
}

export function TenantDetailPage() {
  const { tenantId = '' } = useParams();
  const tenant = useQuery({
    queryKey: queryKeys.tenant(tenantId),
    queryFn: () => tenantsApi.get(tenantId),
    enabled: Boolean(tenantId),
  });

  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/tenants"
        spacing={0.75}
        sx={{
          alignItems: 'center',
          width: 'fit-content',
          mb: 1.75,
          color: brand.textSecondary,
          textDecoration: 'none',
          fontSize: '0.88rem',
          fontWeight: 600,
          '&:hover': { color: brand.textPrimary },
        }}
      >
        <ArrowBackOutlined sx={{ fontSize: 19 }} />
        Voltar para locatários
      </Stack>
      {tenant.isPending ? (
        <LoadingState label="Carregando locatário…" />
      ) : tenant.isError ? (
        <ProblemAlert error={tenant.error} onRetry={() => void tenant.refetch()} />
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2.5 }}>
            O RG não é retornado pela API — ele fica disponível apenas no momento do cadastro.
          </Alert>
          <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: brand.sidebarBg,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              {tenant.data.name.charAt(0).toUpperCase()}
            </Box>
            <Box>
              <Typography component="h1" variant="h1">
                {tenant.data.name}
              </Typography>
              <Typography sx={{ color: brand.textSecondary }}>
                {tenant.data.profession} · CPF {tenant.data.cpf} ·{' '}
                {civilStatusLabel(tenant.data.civilStatus)}
              </Typography>
            </Box>
          </Stack>
          <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 3,
              }}
            >
              <DetailField label="Nome" value={tenant.data.name} />
              <DetailField label="CPF" value={tenant.data.cpf} />
              <DetailField label="Profissão" value={tenant.data.profession} />
              <DetailField label="Estado civil" value={civilStatusLabel(tenant.data.civilStatus)} />
              <DetailField label="E-mail" value={tenant.data.email} />
              <DetailField label="Telefone" value={tenant.data.mobilePhone} />
            </Box>
            <TechnicalDetails id={tenant.data.id} />
          </Card>
        </>
      )}
    </>
  );
}
