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
import { formatCivilDate } from '../../lib/dates/dates';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { propertiesApi } from './api';
import { unitTypeLabel } from './labels';

export function PropertiesPage() {
  const { page, limit, setPagination } = usePaginationParams();
  const { session } = useAuth();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const properties = useQuery({
    queryKey: queryKeys.properties(page, limit),
    queryFn: () => propertiesApi.list(page, limit),
    placeholderData: keepPreviousData,
  });
  const mayCreate = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const rows = properties.data?.data ?? [];

  useEffect(() => {
    if (properties.data && page > Math.max(1, properties.data.meta.totalPages)) {
      setPagination(1, limit);
    }
  }, [limit, page, properties.data, setPagination]);

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Consulte as unidades imobiliárias cadastradas."
        action={mayCreate ? { label: 'Novo imóvel', to: '/properties/new' } : undefined}
      />
      {properties.isPending ? (
        <LoadingState label="Carregando imóveis…" />
      ) : properties.isError ? (
        <ProblemAlert error={properties.error} onRetry={() => void properties.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum imóvel cadastrado" />
      ) : (
        <Paper variant="outlined">
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((property) => (
                <Card variant="outlined" key={property.id}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>
                      {property.neighborhood} · {property.unitNumber}
                    </Typography>
                    <Typography color="text.secondary">{unitTypeLabel(property.type)}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Cadastrado em {formatCivilDate(property.createdAt)}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      component={RouterLink}
                      variant="text"
                      to={`/properties/${property.id}`}
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
                    <TableCell>Bairro</TableCell>
                    <TableCell>Unidade</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Cadastro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((property) => (
                    <TableRow key={property.id} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/properties/${property.id}`}>
                          {property.neighborhood}
                        </Link>
                      </TableCell>
                      <TableCell>{property.unitNumber}</TableCell>
                      <TableCell>{unitTypeLabel(property.type)}</TableCell>
                      <TableCell>{formatCivilDate(property.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationBar meta={properties.data.meta} onChange={setPagination} />
        </Paper>
      )}
    </>
  );
}
