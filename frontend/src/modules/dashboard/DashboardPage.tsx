import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { StatusChip } from '../../components/data-display/StatusChip';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { LoadingState } from '../../components/feedback/QueryState';
import { brand, statusTones, type StatusTone } from '../../app/theme/theme';
import { formatCivilDate, formatCompetence, formatDateTime } from '../../lib/dates/dates';
import { formatCents } from '../../lib/money/money';
import { MANAGEMENT_ROLES, hasRole } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { invoicesApi } from '../invoices/api';
import { notificationsApi } from '../notifications/api';
import { dashboardApi } from './api';

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  tone?: StatusTone;
}

function MetricCard({ label, value, detail, icon, tone }: MetricCardProps) {
  const dotColor = tone ? statusTones[tone].dot : brand.textTertiary;
  const iconBg = tone ? statusTones[tone].bg : brand.accentTint;
  const iconFg = tone ? statusTones[tone].fg : brand.accent;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              color: brand.textTertiary,
            }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              bgcolor: iconBg,
              color: iconFg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { fontSize: 19 },
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography
          component="div"
          sx={{ fontFamily: '"Newsreader", Georgia, serif', fontSize: '2.1rem', fontWeight: 500, lineHeight: 1, color: brand.textPrimary }}
        >
          {value}
        </Typography>
        <Stack direction="row" spacing={0.85} sx={{ alignItems: 'center', mt: 1.25 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.82rem', color: tone ? statusTones[tone].fg : brand.textSecondary, fontWeight: tone ? 600 : 400 }}>
            {detail}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ListPanel({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <Card sx={{ height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2, pb: 1.5 }}>
        <Typography component="h2" variant="h2">
          {title}
        </Typography>
        {count && (
          <Typography sx={{ fontSize: '0.8rem', color: brand.textTertiary }}>{count}</Typography>
        )}
      </Stack>
      <Box sx={{ pb: 1 }}>{children}</Box>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const mayReview = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const summary = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.summary,
    staleTime: 30_000,
  });
  const recentInvoices = useQuery({
    queryKey: queryKeys.invoices({ page: 1, limit: 5 }),
    queryFn: () => invoicesApi.list({ page: 1, limit: 5 }),
    staleTime: 30_000,
  });
  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationsApi.list,
    staleTime: 15_000,
  });

  if (summary.isPending) return <LoadingState label="Carregando visão geral…" />;
  if (summary.isError) {
    return <ProblemAlert error={summary.error} onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;

  const attentionItems = [
    data.invoices.overdueAmountCents > 0 && {
      icon: <ScheduleOutlinedIcon />,
      tone: 'error' as const,
      title: 'Faturas vencidas',
      sub: `${formatCents(data.invoices.overdueAmountCents)} em atraso`,
      cta: 'Ver faturas',
      to: '/invoices?status=OVERDUE',
    },
    mayReview &&
      data.payments.submitted > 0 && {
        icon: <FactCheckOutlinedIcon />,
        tone: 'warning' as const,
        title: `${data.payments.submitted} pagamentos aguardando revisão`,
        sub: `${data.invoices.underReview} faturas em análise`,
        cta: 'Abrir fila',
        to: '/payments/review',
      },
    data.contracts.expiringNext30Days > 0 && {
      icon: <EventOutlinedIcon />,
      tone: 'info' as const,
      title: `${data.contracts.expiringNext30Days} contratos vencem em 30 dias`,
      sub: 'Renovação recomendada',
      cta: 'Ver contratos',
      to: '/contracts',
    },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item));

  const recentActivity = notifications.data?.data.slice(0, 4) ?? [];

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Posição consolidada em ${formatCivilDate(data.asOf)}.`}
      />
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Contratos ativos"
            value={data.contracts.active}
            detail={`${data.contracts.expiringNext30Days} vencem nos próximos 30 dias`}
            icon={<DescriptionOutlinedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Saldo em aberto"
            value={formatCents(data.invoices.outstandingAmountCents)}
            detail={`Distribuído em ${data.invoices.total} faturas`}
            icon={<AccountBalanceWalletOutlinedIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Valor vencido"
            value={formatCents(data.invoices.overdueAmountCents)}
            detail={data.invoices.overdueAmountCents > 0 ? 'Precisa de atenção' : 'Nenhuma pendência'}
            icon={<ScheduleOutlinedIcon />}
            tone={data.invoices.overdueAmountCents > 0 ? 'error' : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            label="Em revisão"
            value={data.payments.submitted}
            detail={`${data.invoices.underReview} faturas em análise`}
            icon={<FactCheckOutlinedIcon />}
            tone={data.payments.submitted > 0 ? 'warning' : undefined}
          />
        </Grid>
      </Grid>

      {(attentionItems.length > 0 || recentActivity.length > 0) && (
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          {attentionItems.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <ListPanel title="Precisa de atenção" count={`${attentionItems.length} itens`}>
                <Stack>
                  {attentionItems.map((item) => (
                    <Stack
                      key={item.title}
                      component={RouterLink}
                      to={item.to}
                      direction="row"
                      spacing={1.75}
                      sx={{
                        alignItems: 'center',
                        px: 2,
                        py: 1.4,
                        mx: 1,
                        borderRadius: '12px',
                        textDecoration: 'none',
                        '&:hover': { bgcolor: brand.surfaceSubtle },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '11px',
                          flexShrink: 0,
                          bgcolor: statusTones[item.tone].bg,
                          color: statusTones[item.tone].fg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {item.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.94rem', fontWeight: 600, color: brand.textPrimary }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.83rem', color: brand.textSecondary }}>
                          {item.sub}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', color: 'primary.main', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '0.86rem', fontWeight: 600, color: 'inherit' }}>
                          {item.cta}
                        </Typography>
                        <ChevronRightOutlinedIcon sx={{ fontSize: 18 }} />
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </ListPanel>
            </Grid>
          )}
          {recentActivity.length > 0 && (
            <Grid size={{ xs: 12, md: attentionItems.length > 0 ? 6 : 12 }}>
              <ListPanel title="Atividade recente">
                <Stack>
                  {recentActivity.map((event) => (
                    <Stack key={event.id} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', px: 2, py: 1.1 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '9px',
                          flexShrink: 0,
                          mt: 0.15,
                          bgcolor: brand.accentTint,
                          color: brand.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <NotificationsNoneOutlinedIcon sx={{ fontSize: 18 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: brand.textPrimary }}>
                          {event.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: brand.textSecondary }}>
                          {event.message}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: brand.textTertiary, whiteSpace: 'nowrap' }}>
                        {formatDateTime(event.createdAt)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </ListPanel>
            </Grid>
          )}
        </Grid>
      )}

      {recentInvoices.data && recentInvoices.data.data.length > 0 && (
        <Card>
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2.5,
              py: 2,
              borderBottom: `1px solid ${brand.borderCard}`,
            }}
          >
            <Typography component="h2" variant="h2">
              Faturas recentes
            </Typography>
            <Stack
              component={RouterLink}
              to="/invoices"
              direction="row"
              spacing={0.25}
              sx={{ alignItems: 'center', color: 'primary.main', textDecoration: 'none', fontSize: '0.86rem', fontWeight: 600 }}
            >
              Ver todas
              <ChevronRightOutlinedIcon sx={{ fontSize: 18 }} />
            </Stack>
          </Stack>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Fatura</TableCell>
                  <TableCell>Mês ref.</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell sx={{ width: 44 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {recentInvoices.data.data.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    hover
                    onClick={() => void navigate(`/invoices/${invoice.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography
                        component={RouterLink}
                        to={`/invoices/${invoice.id}`}
                        sx={{
                          display: 'block',
                          fontSize: '0.94rem',
                          fontWeight: 600,
                          color: brand.textPrimary,
                          textDecoration: 'none',
                        }}
                      >
                        {invoice.contract.propertyUnit.neighborhood} · Unid.{' '}
                        {invoice.contract.propertyUnit.unitNumber}
                      </Typography>
                      <Typography sx={{ fontSize: '0.79rem', color: brand.textTertiary }}>
                        {invoice.contract.tenant.name} · CPF {invoice.contract.tenant.cpf}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatCompetence(invoice.competence)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCents(invoice.totalValueCents)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={invoice.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ color: brand.borderInput }}>
                      <ChevronRightOutlinedIcon />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </>
  );
}
