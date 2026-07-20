import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
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
  tone?: StatusTone;
}

function MetricCard({ label, value, detail, tone }: MetricCardProps) {
  const toneFg = tone ? statusTones[tone].fg : undefined;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            color: brand.textTertiary,
          }}
        >
          {label}
        </Typography>
        <Typography
          component="div"
          sx={{
            fontFamily: brand.fontDisplay,
            fontVariantNumeric: 'oldstyle-nums',
            fontSize: '2.1rem',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: toneFg ?? brand.textPrimary,
            mt: 0.75,
            pb: 1,
            borderBottom: `1px solid ${tone ? `${statusTones[tone].dot}59` : brand.borderCard}`,
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.82rem',
            mt: 1,
            color: toneFg ?? brand.textSecondary,
            fontWeight: tone ? 600 : 400,
          }}
        >
          {detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ListPanel({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2, pb: 1.5 }}
      >
        <Typography
          component="h2"
          variant="h2"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}
        >
          <Box component="span" aria-hidden sx={{ width: 3, height: 14, bgcolor: brand.razao }} />
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

function FinancialDailyChart({
  points,
}: {
  points: {
    date: string;
    receivedCents: number;
    confirmedReceivableCents: number;
    forecastRenewalsCents: number;
  }[];
}) {
  if (points.length === 0) {
    return (
      <Typography sx={{ color: brand.textTertiary, py: 5, textAlign: 'center' }}>
        Nenhum movimento no período.
      </Typography>
    );
  }
  const values = points.flatMap((point) => [
    point.receivedCents,
    point.confirmedReceivableCents,
    point.forecastRenewalsCents,
  ]);
  const maximum = Math.max(...values, 1);
  const x = (index: number) => 28 + (index * 664) / Math.max(points.length - 1, 1);
  const y = (value: number) => 180 - (value / maximum) * 140;
  const line = (field: 'receivedCents' | 'confirmedReceivableCents' | 'forecastRenewalsCents') =>
    points.map((point, index) => `${x(index)},${y(point[field])}`).join(' ');
  const legend = [
    { label: 'Recebido', color: statusTones.success.dot },
    { label: 'A receber', color: statusTones.warning.dot },
    { label: 'Previsto', color: statusTones.info.dot },
  ];

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 0.5, flexWrap: 'wrap' }}>
        {legend.map((item) => (
          <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 18, height: 3, bgcolor: item.color }} />
            <Typography sx={{ fontSize: '0.75rem', color: brand.textSecondary }}>
              {item.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        component="svg"
        role="img"
        aria-label="Série diária de valores recebidos, a receber e previstos"
        viewBox="0 0 720 210"
        sx={{ display: 'block', width: '100%', height: 220, px: 1 }}
      >
        <line x1="28" y1="180" x2="692" y2="180" stroke={brand.borderInput} />
        <line x1="28" y1="110" x2="692" y2="110" stroke={brand.borderRow} strokeDasharray="4 5" />
        <polyline
          points={line('receivedCents')}
          fill="none"
          stroke={statusTones.success.dot}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={line('confirmedReceivableCents')}
          fill="none"
          stroke={statusTones.warning.dot}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={line('forecastRenewalsCents')}
          fill="none"
          stroke={statusTones.info.dot}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.receivedCents)}
            r="3.5"
            fill={statusTones.success.dot}
          />
        ))}
        <text x="28" y="201" fill={brand.textTertiary} fontSize="11">
          {formatCivilDate(points[0]!.date)}
        </text>
        {points.length > 1 && (
          <text x="692" y="201" textAnchor="end" fill={brand.textTertiary} fontSize="11">
            {formatCivilDate(points.at(-1)!.date)}
          </text>
        )}
      </Box>
    </Box>
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
      tone: 'error' as const,
      amount: formatCents(data.invoices.overdueAmountCents),
      what: 'em faturas vencidas',
      cta: 'Ver faturas',
      to: '/invoices?status=OVERDUE',
    },
    mayReview &&
      data.payments.submitted > 0 && {
        tone: 'warning' as const,
        amount: data.payments.submitted,
        what: `pagamentos aguardando revisão · ${data.invoices.underReview} faturas em análise`,
        cta: 'Abrir fila',
        to: '/payments/review',
      },
    data.contracts.expiringNext30Days > 0 && {
      tone: 'info' as const,
      amount: data.contracts.expiringNext30Days,
      what: 'contratos vencem em 30 dias',
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
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard
            label="Recebido"
            value={formatCents(data.financial.receivedCents)}
            detail={`${formatCivilDate(data.period.from)} a ${formatCivilDate(data.period.to)}`}
            tone="success"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard
            label="A receber confirmado"
            value={formatCents(data.financial.confirmedReceivableCents)}
            detail="Faturas emitidas ainda em aberto"
            tone={data.financial.confirmedReceivableCents > 0 ? 'warning' : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard
            label="Renovações previstas"
            value={formatCents(data.financial.forecastRenewalsCents)}
            detail={`Projeção até ${formatCivilDate(data.period.forecastThrough)}`}
            tone="info"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ListPanel title="Movimento por dia">
            <FinancialDailyChart points={data.financial.daily} />
          </ListPanel>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ListPanel title="Resumo por prédio" count={`${data.financial.byBuilding.length} grupos`}>
            {data.financial.byBuilding.length === 0 ? (
              <Typography sx={{ color: brand.textTertiary, py: 5, textAlign: 'center' }}>
                Nenhum valor no período.
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table stickyHeader size="small" aria-label="Posição financeira por prédio">
                  <TableHead>
                    <TableRow>
                      <TableCell>Prédio</TableCell>
                      <TableCell align="right">Recebido</TableCell>
                      <TableCell align="right">A receber</TableCell>
                      <TableCell align="right">Previsto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.financial.byBuilding.map((building) => (
                      <TableRow key={building.buildingId ?? `standalone-${building.neighborhood}`}>
                        <TableCell>
                          <Typography sx={{ fontSize: '0.86rem', fontWeight: 600 }}>
                            {building.buildingName ??
                              `Imóveis sem prédio · ${building.neighborhood}`}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: brand.textTertiary }}>
                            {building.buildingName ? `${building.neighborhood} · ` : ''}
                            {building.propertyUnitCount}{' '}
                            {building.propertyUnitCount === 1 ? 'unidade' : 'unidades'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatCents(building.receivedCents)}</TableCell>
                        <TableCell align="right">
                          {formatCents(building.confirmedReceivableCents)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCents(building.forecastRenewalsCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </ListPanel>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ListPanel
            title="Posição por imóvel"
            count={`${data.financial.byProperty.length} imóveis`}
          >
            {data.financial.byProperty.length === 0 ? (
              <Typography sx={{ color: brand.textTertiary, py: 5, textAlign: 'center' }}>
                Nenhum valor no período.
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table stickyHeader size="small" aria-label="Posição financeira por imóvel">
                  <TableHead>
                    <TableRow>
                      <TableCell>Imóvel</TableCell>
                      <TableCell align="right">Recebido</TableCell>
                      <TableCell align="right">A receber</TableCell>
                      <TableCell align="right">Previsto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.financial.byProperty.map((property) => (
                      <TableRow key={property.propertyUnitId}>
                        <TableCell>
                          <Typography sx={{ fontSize: '0.86rem', fontWeight: 600 }}>
                            {property.buildingName ?? property.neighborhood} · Unid.{' '}
                            {property.unitNumber}
                          </Typography>
                          {property.buildingName && (
                            <Typography sx={{ fontSize: '0.75rem', color: brand.textTertiary }}>
                              {property.neighborhood}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{formatCents(property.receivedCents)}</TableCell>
                        <TableCell align="right">
                          {formatCents(property.confirmedReceivableCents)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCents(property.forecastRenewalsCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </ListPanel>
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
                      key={item.to}
                      component={RouterLink}
                      to={item.to}
                      direction="row"
                      spacing={1.75}
                      sx={{
                        alignItems: 'baseline',
                        px: 2.25,
                        py: 1.5,
                        borderTop: `1px solid ${brand.borderRow}`,
                        textDecoration: 'none',
                        '&:hover': { bgcolor: brand.surfaceSubtle },
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: brand.fontDisplay,
                          fontVariantNumeric: 'oldstyle-nums',
                          fontSize: '1.1rem',
                          fontWeight: 560,
                          whiteSpace: 'nowrap',
                          color: statusTones[item.tone].fg,
                        }}
                      >
                        {item.amount}
                      </Typography>
                      <Typography
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '0.86rem',
                          color: brand.textSecondary,
                        }}
                      >
                        {item.what}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.25}
                        sx={{ alignItems: 'center', color: 'primary.main', flexShrink: 0 }}
                      >
                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: 'inherit' }}>
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
                    <Stack
                      key={event.id}
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'flex-start', px: 2, py: 1.1 }}
                    >
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
                        <Typography
                          sx={{ fontSize: '0.88rem', fontWeight: 600, color: brand.textPrimary }}
                        >
                          {event.title}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: brand.textSecondary }}>
                          {event.message}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: brand.textTertiary,
                          whiteSpace: 'nowrap',
                        }}
                      >
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
            <Typography
              component="h2"
              variant="h2"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ width: 3, height: 14, bgcolor: brand.razao }}
              />
              Faturas recentes
            </Typography>
            <Stack
              component={RouterLink}
              to="/invoices"
              direction="row"
              spacing={0.25}
              sx={{
                alignItems: 'center',
                color: 'primary.main',
                textDecoration: 'none',
                fontSize: '0.86rem',
                fontWeight: 600,
              }}
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
