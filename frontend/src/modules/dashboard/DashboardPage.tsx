import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { formatCivilDate } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { MANAGEMENT_ROLES, hasRole } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { dashboardApi } from './api';

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
}

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography color="text.secondary">{label}</Typography>
        <Typography component="div" variant="h2" sx={{ my: 0.75 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const summary = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.summary,
    staleTime: 30_000,
  });
  const mayReview = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));

  if (summary.isPending) return <LoadingState label="Carregando visão geral…" />;
  if (summary.isError) {
    return <ProblemAlert error={summary.error} onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Posição consolidada em ${formatCivilDate(data.asOf)}.`}
      />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Contratos ativos"
            value={data.contracts.active}
            detail={`${data.contracts.expiringNext30Days} vencem nos próximos 30 dias`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Saldo em aberto"
            value={formatCents(data.invoices.outstandingAmountCents)}
            detail={`${data.invoices.total} faturas no total`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Valor vencido"
            value={formatCents(data.invoices.overdueAmountCents)}
            detail={`${formatCents(data.invoices.approvedAmountCents)} já aprovados`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Pagamentos em revisão"
            value={data.payments.submitted}
            detail={`${data.invoices.underReview} faturas em análise`}
          />
        </Grid>
      </Grid>
      <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
        Acessos rápidos
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <ReceiptLongOutlinedIcon color="primary" />
              <Typography component="h3" variant="h2">
                Faturas
              </Typography>
            </Stack>
          </CardContent>
          <CardActions>
            <Button component={RouterLink} to="/invoices">
              Consultar faturas
            </Button>
          </CardActions>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <AssignmentOutlinedIcon color="primary" />
              <Typography component="h3" variant="h2">
                Contratos
              </Typography>
            </Stack>
          </CardContent>
          <CardActions>
            <Button component={RouterLink} to="/contracts">
              Consultar contratos
            </Button>
          </CardActions>
        </Card>
        {mayReview && (
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <FactCheckOutlinedIcon color="primary" />
                <Typography component="h3" variant="h2">
                  Revisões
                </Typography>
              </Stack>
            </CardContent>
            <CardActions>
              <Button component={RouterLink} to="/payments/review">
                Abrir fila
              </Button>
            </CardActions>
          </Card>
        )}
      </Box>
    </>
  );
}
