import { Box, Button, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatDateTime } from '../../lib/dates/dates';
import { propertiesApi } from './api';
import { unitTypeLabel } from './labels';

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

export function PropertyDetailPage() {
  const { propertyId = '' } = useParams();
  const property = useQuery({
    queryKey: queryKeys.property(propertyId),
    queryFn: () => propertiesApi.get(propertyId),
    enabled: Boolean(propertyId),
  });
  return (
    <>
      <PageHeader title="Detalhe do imóvel">
        <Button component={RouterLink} to="/properties" variant="outlined">
          Voltar à lista
        </Button>
      </PageHeader>
      {property.isPending ? (
        <LoadingState label="Carregando imóvel…" />
      ) : property.isError ? (
        <ProblemAlert error={property.error} onRetry={() => void property.refetch()} />
      ) : (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <DetailField label="Bairro" value={property.data.neighborhood} />
            <DetailField label="Número da unidade" value={property.data.unitNumber} />
            <DetailField label="Tipo" value={unitTypeLabel(property.data.type)} />
            <DetailField label="Cadastrado em" value={formatDateTime(property.data.createdAt)} />
            <DetailField label="Identificador" value={property.data.id} />
          </Box>
        </Paper>
      )}
    </>
  );
}
