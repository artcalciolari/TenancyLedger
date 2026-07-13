import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { UpdateUserAccessInput, UserView } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import { usePaginationParams } from '../../components/data-display/usePaginationParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { roleLabel } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { usersApi } from './api';
import { UserAccessDialog } from './UserAccessDialog';

export function UsersPage() {
  const { page, limit, setPagination } = usePaginationParams();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [selected, setSelected] = useState<UserView | null>(null);
  const users = useQuery({
    queryKey: queryKeys.users(page, limit),
    queryFn: () => usersApi.list(page, limit),
    placeholderData: keepPreviousData,
  });
  const updateAccess = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserAccessInput }) =>
      usersApi.updateAccess(id, input),
    onSuccess: async () => {
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const submitAccess = async (input: UpdateUserAccessInput) => {
    if (!selected) return;
    try {
      await updateAccess.mutateAsync({ id: selected.id, input });
    } catch {
      // A mutação mantém o problema disponível no diálogo.
    }
  };

  const rows = users.data?.data ?? [];

  useEffect(() => {
    if (users.data && page > Math.max(1, users.data.meta.totalPages)) {
      setPagination(1, limit);
    }
  }, [limit, page, setPagination, users.data]);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Administre os papéis e o acesso ao sistema."
        action={{ label: 'Novo usuário', to: '/users/new' }}
      />
      {users.isPending ? (
        <LoadingState label="Carregando usuários…" />
      ) : users.isError ? (
        <ProblemAlert error={users.error} onRetry={() => void users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum usuário cadastrado" />
      ) : (
        <Paper variant="outlined">
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((user) => (
                <Card variant="outlined" key={user.id}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}>
                      {user.email}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" label={roleLabel(user.role)} />
                      <Chip
                        size="small"
                        color={user.active ? 'success' : 'default'}
                        label={user.active ? 'Ativo' : 'Inativo'}
                      />
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button
                      variant="text"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => setSelected(user)}
                    >
                      Alterar acesso
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
                    <TableCell>E-mail</TableCell>
                    <TableCell>Papel</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{roleLabel(user.role)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={user.active ? 'success' : 'default'}
                          label={user.active ? 'Ativo' : 'Inativo'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Alterar acesso">
                          <IconButton
                            aria-label={`Alterar acesso de ${user.email}`}
                            onClick={() => setSelected(user)}
                          >
                            <EditOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <PaginationBar meta={users.data.meta} onChange={setPagination} />
        </Paper>
      )}
      <UserAccessDialog
        currentUserId={session?.user.id}
        error={updateAccess.error}
        loading={updateAccess.isPending}
        onClose={() => {
          updateAccess.reset();
          setSelected(null);
        }}
        onSubmit={submitAccess}
        user={selected}
      />
    </>
  );
}
