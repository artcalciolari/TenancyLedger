import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { usePaginationParams } from '../../components/data-display/usePaginationParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { tenantsApi } from './api';
import { civilStatusLabel } from './labels';

export function TenantsPage() {
  const { page, limit, setPagination } = usePaginationParams();
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tenants = useQuery({
    queryKey: queryKeys.tenants(page, limit),
    queryFn: () => tenantsApi.list(page, limit),
    placeholderData: keepPreviousData,
  });
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const rows = tenants.data?.data ?? [];

  useEffect(() => {
    if (tenants.data && page > Math.max(1, tenants.data.meta.totalPages)) {
      setPagination(1, limit);
    }
  }, [limit, page, setPagination, tenants.data]);

  return (
    <>
      <PageHeader
        title="Locatários"
        description="Consulte os dados cadastrais retornados de forma mascarada."
        action={mayCreate ? { label: 'Novo locatário', to: '/tenants/new' } : undefined}
      />
      {tenants.isPending ? (
        <LoadingState label="Carregando locatários…" />
      ) : tenants.isError ? (
        <ProblemAlert error={tenants.error} onRetry={() => void tenants.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum locatário cadastrado" />
      ) : (
        <Paper variant="outlined">
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((tenant) => (
                <Card variant="outlined" key={tenant.id}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>{tenant.cpf}</Typography>
                    <Typography color="text.secondary">{tenant.profession}</Typography>
                    <Typography variant="body2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                      {tenant.email}
                    </Typography>
                    <Typography variant="body2">{tenant.mobilePhone}</Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      variant="text"
                      to={`/tenants/${tenant.id}`}
                      startIcon={<OpenInNewOutlinedIcon />}
                    >
                      Ver detalhes
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>CPF</TableCell>
                    <TableCell>Profissão</TableCell>
                    <TableCell>Estado civil</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Telefone</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((tenant) => (
                    <TableRow hover key={tenant.id}>
                      <TableCell>
                        <Link component={RouterLink} to={`/tenants/${tenant.id}`}>
                          {tenant.cpf}
                        </Link>
                      </TableCell>
                      <TableCell>{tenant.profession}</TableCell>
                      <TableCell>{civilStatusLabel(tenant.civilStatus)}</TableCell>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>{tenant.email}</TableCell>
                      <TableCell>{tenant.mobilePhone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationBar meta={tenants.data.meta} onChange={setPagination} />
        </Paper>
      )}
    </>
  );
}
