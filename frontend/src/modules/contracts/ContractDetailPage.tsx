import { Alert, Box, Button, Link, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { StatusChip } from '../../components/data-display/StatusChip';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate, formatDateTime } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { propertiesApi } from '../properties/api';
import { tenantsApi } from '../tenants/api';
import { useContract } from './hooks';
import { RenewContractDialog } from './RenewContractDialog';

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography component="div" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams();
  const contract = useContract(contractId);
  const { session } = useAuth();
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewedEndDate, setRenewedEndDate] = useState<string | null>(null);
  const tenantId = contract.data?.tenantId ?? '';
  const propertyUnitId = contract.data?.propertyUnitId ?? '';
  const tenant = useQuery({
    queryKey: queryKeys.tenant(tenantId),
    queryFn: () => tenantsApi.get(tenantId),
    enabled: Boolean(tenantId),
  });
  const property = useQuery({
    queryKey: queryKeys.property(propertyUnitId),
    queryFn: () => propertiesApi.get(propertyUnitId),
    enabled: Boolean(propertyUnitId),
  });

  if (contract.isPending) return <LoadingState label="Carregando contrato…" />;
  if (contract.isError) {
    return <ProblemAlert error={contract.error} onRetry={() => void contract.refetch()} />;
  }

  const mayRenew = Boolean(
    session &&
    hasRole(session.user.role, MANAGEMENT_ROLES) &&
    contract.data.isRenewable &&
    contract.data.status !== 'TERMINATED' &&
    contract.data.durationInMonths < 600,
  );

  return (
    <>
      <PageHeader title="Detalhe do contrato" description={`Contrato ${contract.data.id}`}>
        <Button component={RouterLink} to="/contracts" variant="outlined">
          Voltar à lista
        </Button>
        {mayRenew && <Button onClick={() => setRenewOpen(true)}>Renovar contrato</Button>}
      </PageHeader>
      <Stack spacing={2}>
        {renewedEndDate && (
          <Alert severity="success" onClose={() => setRenewedEndDate(null)}>
            Contrato renovado. A nova data final confirmada é {formatCivilDate(renewedEndDate)}.
          </Alert>
        )}
        {!contract.data.isRenewable && (
          <Alert severity="info">Este contrato foi criado sem permissão de renovação.</Alert>
        )}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            <DetailField label="Status">
              <StatusChip status={contract.data.status} />
            </DetailField>
            <DetailField label="Data de entrada">
              {formatCivilDate(contract.data.moveInDate)}
            </DetailField>
            <DetailField label="Data final">{formatCivilDate(contract.data.endDate)}</DetailField>
            <DetailField label="Aluguel mensal">
              {formatCents(contract.data.monthlyBaseValueCents)}
            </DetailField>
            <DetailField label="Duração">{contract.data.durationInMonths} meses</DetailField>
            <DetailField label="Dia de cobrança">Dia {contract.data.billingDay}</DetailField>
            <DetailField label="Renovável">{contract.data.isRenewable ? 'Sim' : 'Não'}</DetailField>
            <DetailField label="Criado em">{formatDateTime(contract.data.createdAt)}</DetailField>
            <DetailField label="Atualizado em">
              {formatDateTime(contract.data.updatedAt)}
            </DetailField>
          </Box>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
              Locatário
            </Typography>
            {tenant.isPending ? (
              <Skeleton height={72} />
            ) : tenant.isError ? (
              <Typography color="error">Não foi possível carregar o locatário.</Typography>
            ) : (
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }}>{tenant.data.cpf}</Typography>
                <Typography>{tenant.data.profession}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {tenant.data.email} · {tenant.data.mobilePhone}
                </Typography>
                <Link
                  component={RouterLink}
                  to={`/tenants/${tenant.data.id}`}
                  sx={{ alignSelf: 'flex-start', mt: 1 }}
                >
                  Ver locatário
                </Link>
              </Stack>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
              Imóvel
            </Typography>
            {property.isPending ? (
              <Skeleton height={72} />
            ) : property.isError ? (
              <Typography color="error">Não foi possível carregar o imóvel.</Typography>
            ) : (
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }}>Unidade {property.data.unitNumber}</Typography>
                <Typography>{property.data.neighborhood}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Tipo: {property.data.type}
                </Typography>
                <Link
                  component={RouterLink}
                  to={`/properties/${property.data.id}`}
                  sx={{ alignSelf: 'flex-start', mt: 1 }}
                >
                  Ver imóvel
                </Link>
              </Stack>
            )}
          </Paper>
        </Box>
      </Stack>
      {mayRenew && (
        <RenewContractDialog
          contract={contract.data}
          open={renewOpen}
          onClose={() => setRenewOpen(false)}
          onRenewed={(renewed) => setRenewedEndDate(renewed.endDate)}
        />
      )}
    </>
  );
}
