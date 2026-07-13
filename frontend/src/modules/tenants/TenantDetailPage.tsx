import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { tenantsApi } from './api';
import { civilStatusLabel } from './labels';

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
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
      <PageHeader title="Detalhe do locatário">
        <Button component={RouterLink} to="/tenants" variant="outlined">
          Voltar à lista
        </Button>
      </PageHeader>
      {tenant.isPending ? (
        <LoadingState label="Carregando locatário…" />
      ) : tenant.isError ? (
        <ProblemAlert error={tenant.error} onRetry={() => void tenant.refetch()} />
      ) : (
        <Stack spacing={2}>
          <Alert severity="info">
            CPF, e-mail e telefone são exibidos mascarados. O RG não é retornado pela API.
          </Alert>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 3,
              }}
            >
              <DetailField label="CPF" value={tenant.data.cpf} />
              <DetailField label="Profissão" value={tenant.data.profession} />
              <DetailField label="Estado civil" value={civilStatusLabel(tenant.data.civilStatus)} />
              <DetailField label="E-mail" value={tenant.data.email} />
              <DetailField label="Telefone" value={tenant.data.mobilePhone} />
              <DetailField label="Identificador" value={tenant.data.id} />
            </Box>
          </Paper>
        </Stack>
      )}
    </>
  );
}
