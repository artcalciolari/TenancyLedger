import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import { Alert, Box, Button, Card, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import type { InvoiceView } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand } from '../../app/theme/theme';
import { StatusChip } from '../../components/data-display/StatusChip';
import { TechnicalDetails } from '../../components/data-display/TechnicalDetails';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate, formatDateTime } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { invoicesApi } from '../invoices/api';
import { SettleCashDialog } from '../invoices/SettleCashDialog';
import { propertiesApi } from '../properties/api';
import { unitTypeLabel } from '../properties/labels';
import { tenantsApi } from '../tenants/api';
import { civilStatusLabel } from '../tenants/labels';
import { useContract } from './hooks';
import { ContractDocumentsSection } from './ContractDocumentsSection';
import { RenewContractDialog } from './RenewContractDialog';

const uppercaseLabelSx = {
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
  color: brand.textTertiary,
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography component="div" sx={uppercaseLabelSx}>
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{ overflowWrap: 'anywhere', mt: 0.5, color: brand.textPrimary }}
      >
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
  const [settleInvoice, setSettleInvoice] = useState<InvoiceView | null>(null);
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
  const invoices = useQuery({
    queryKey: ['invoices', { contractId, onboardingPayment: true }],
    queryFn: () => invoicesApi.list({ page: 1, limit: 20, contractId }),
    enabled: Boolean(contractId),
  });

  if (contract.isPending) return <LoadingState label="Carregando contrato…" />;
  if (contract.isError) {
    return <ProblemAlert error={contract.error} onRetry={() => void contract.refetch()} />;
  }

  const mayManage = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const mayRenew = Boolean(
    mayManage &&
    contract.data.isRenewable &&
    contract.data.status !== 'TERMINATED' &&
    contract.data.durationInMonths !== null &&
    contract.data.durationInMonths < 600,
  );
  const payableInvoice = invoices.data?.data
    .filter(
      (invoice) =>
        invoice.outstandingAmountCents > 0 &&
        ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status),
    )
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];

  return (
    <>
      <Stack
        direction="row"
        component={RouterLink}
        to="/contracts"
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
        Voltar para contratos
      </Stack>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography component="h1" variant="h1">
            {property.data
              ? `${property.data.neighborhood} · Unid. ${property.data.unitNumber}`
              : 'Contrato'}
          </Typography>
          <StatusChip status={contract.data.status} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {mayRenew && (
            <Button variant="outlined" onClick={() => setRenewOpen(true)} sx={{ flexShrink: 0 }}>
              Renovar contrato
            </Button>
          )}
          {mayManage && contract.data.status === 'PAYMENT_PENDING' && payableInvoice && (
            <Button
              startIcon={<LocalAtmOutlinedIcon />}
              onClick={() => setSettleInvoice(payableInvoice)}
              sx={{ flexShrink: 0 }}
            >
              Registrar 1º pagamento em dinheiro
            </Button>
          )}
        </Stack>
      </Stack>
      <Stack spacing={2}>
        {renewedEndDate && (
          <Alert severity="success" onClose={() => setRenewedEndDate(null)}>
            Contrato renovado. A nova data final confirmada é {formatCivilDate(renewedEndDate)}.
          </Alert>
        )}
        {!contract.data.isRenewable && contract.data.contractType !== 'MONTH_TO_MONTH' && (
          <Alert severity="info">Este contrato foi criado sem permissão de renovação.</Alert>
        )}
        {contract.data.contractType === 'MONTH_TO_MONTH' && (
          <Alert severity="info">
            Contrato mensal sem prazo final. A renovação acompanha os períodos pagos.
          </Alert>
        )}
        <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
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
            <DetailField label="Data de entrada">
              {formatCivilDate(contract.data.moveInDate)}
            </DetailField>
            <DetailField label="Data final">
              {contract.data.endDate ? formatCivilDate(contract.data.endDate) : 'Sem prazo final'}
            </DetailField>
            <DetailField label="Aluguel mensal">
              {formatCents(contract.data.monthlyBaseValueCents)}
            </DetailField>
            <DetailField label="Duração">
              {contract.data.durationInMonths === null
                ? 'Mensal contínuo'
                : `${contract.data.durationInMonths} meses`}
            </DetailField>
            <DetailField label="Dia de cobrança">Dia {contract.data.billingDay}</DetailField>
            <DetailField label="Renovável">{contract.data.isRenewable ? 'Sim' : 'Não'}</DetailField>
            <DetailField label="Criado em">{formatDateTime(contract.data.createdAt)}</DetailField>
            <DetailField label="Atualizado em">
              {formatDateTime(contract.data.updatedAt)}
            </DetailField>
          </Box>
          <TechnicalDetails id={contract.data.id} />
        </Card>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
            <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
              Locatário
            </Typography>
            {tenant.isPending ? (
              <Skeleton height={72} />
            ) : tenant.isError ? (
              <Typography color="error">Não foi possível carregar o locatário.</Typography>
            ) : (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    bgcolor: brand.sidebarBg,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {tenant.data.name.charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, color: brand.textPrimary }}>
                    {tenant.data.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: brand.textTertiary }}>
                    CPF {tenant.data.cpf} · {civilStatusLabel(tenant.data.civilStatus)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.82rem',
                      color: brand.textTertiary,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {tenant.data.email}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.82rem',
                      color: brand.textTertiary,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {tenant.data.mobilePhone}
                  </Typography>
                </Box>
                <Typography
                  component={RouterLink}
                  to={`/tenants/${tenant.data.id}`}
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: brand.accent,
                    textDecoration: 'none',
                  }}
                >
                  Abrir
                </Typography>
              </Stack>
            )}
          </Card>
          <Card sx={{ p: { xs: 2.25, sm: 2.75 } }}>
            <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
              Imóvel
            </Typography>
            {property.isPending ? (
              <Skeleton height={72} />
            ) : property.isError ? (
              <Typography color="error">Não foi possível carregar o imóvel.</Typography>
            ) : (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '11px',
                    bgcolor: brand.accentTint,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ApartmentOutlinedIcon sx={{ color: brand.accent, fontSize: 22 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, color: brand.textPrimary }}>
                    {property.data.neighborhood} · Unid. {property.data.unitNumber}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: brand.textTertiary }}>
                    {unitTypeLabel(property.data.type)}
                  </Typography>
                </Box>
                <Typography
                  component={RouterLink}
                  to={`/properties/${property.data.id}`}
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: brand.accent,
                    textDecoration: 'none',
                  }}
                >
                  Abrir
                </Typography>
              </Stack>
            )}
          </Card>
        </Box>
        {mayManage && (
          <ContractDocumentsSection
            contractId={contract.data.id}
            mayManage
            canPreview={contract.data.contractType === 'MONTH_TO_MONTH'}
          />
        )}
      </Stack>
      {mayRenew && (
        <RenewContractDialog
          contract={{
            id: contract.data.id,
            durationInMonths: contract.data.durationInMonths ?? 0,
          }}
          open={renewOpen}
          onClose={() => setRenewOpen(false)}
          onRenewed={(renewed) => setRenewedEndDate(renewed.endDate)}
        />
      )}
      {settleInvoice && (
        <SettleCashDialog
          key={settleInvoice.id}
          invoice={settleInvoice}
          open
          onClose={() => setSettleInvoice(null)}
          onSettled={() => {
            void contract.refetch();
            void invoices.refetch();
          }}
        />
      )}
    </>
  );
}
