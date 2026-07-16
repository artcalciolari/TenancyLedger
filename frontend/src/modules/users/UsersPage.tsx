import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { UpdateUserAccessInput, UserRole, UserView } from '../../api/contract';
import { queryKeys } from '../../api/query-keys';
import { brand, statusTones } from '../../app/theme/theme';
import { PageHeader } from '../../components/data-display/PageHeader';
import { PaginationBar } from '../../components/data-display/PaginationBar';
import {
  type ListSearchConfig,
  useListPageRange,
  useListSearchParams,
} from '../../components/data-display/useListSearchParams';
import { ProblemAlert } from '../../components/feedback/ProblemAlert';
import { EmptyState, LoadingState } from '../../components/feedback/QueryState';
import { roleLabel } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';
import { usersApi } from './api';
import { UserAccessDialog } from './UserAccessDialog';

interface UserListSearch {
  page: number;
  limit: number;
}

const userSearchConfig: ListSearchConfig<UserListSearch> = {
  filterKeys: [],
  parse: (_searchParams, page, limit) => ({ page, limit }),
};

const roleIcons: Record<UserRole, ReactNode> = {
  ADMIN: <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 19, color: brand.textTertiary }} />,
  MANAGER: <BadgeOutlinedIcon sx={{ fontSize: 19, color: brand.textTertiary }} />,
  VIEWER: <VisibilityOutlinedIcon sx={{ fontSize: 19, color: brand.textTertiary }} />,
};

function StatusPill({ active }: { active: boolean }) {
  const tone = active ? statusTones.success : statusTones.neutral;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.85,
        height: 26,
        px: 1.35,
        borderRadius: '8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        bgcolor: tone.bg,
        color: tone.fg,
      }}
    >
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tone.dot }} />
      {active ? 'Ativo' : 'Inativo'}
    </Box>
  );
}

export function UsersPage() {
  const listParams = useListSearchParams(userSearchConfig);
  const { limit, page, setPagination } = listParams;
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
  useListPageRange(listParams, users.data?.meta.totalPages);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem acessa o sistema e o que cada pessoa pode fazer."
        action={{ label: 'Novo usuário', to: '/users/new' }}
      />
      {users.isPending ? (
        <LoadingState label="Carregando usuários…" />
      ) : users.isError ? (
        <ProblemAlert error={users.error} onRetry={() => void users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum usuário cadastrado" />
      ) : (
        <Card sx={{ p: 0 }}>
          {mobile ? (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {rows.map((user) => (
                <Card key={user.id}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          bgcolor: brand.sidebarBg,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          flexShrink: 0,
                        }}
                      >
                        {user.email.charAt(0).toUpperCase()}
                      </Box>
                      <Typography sx={{ fontWeight: 650, overflowWrap: 'anywhere' }}>
                        {user.email}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}
                    >
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        {roleIcons[user.role]}
                        <Typography variant="body2">{roleLabel(user.role)}</Typography>
                      </Stack>
                      <StatusPill active={user.active} />
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button
                      variant="text"
                      startIcon={<TuneOutlinedIcon />}
                      onClick={() => setSelected(user)}
                    >
                      Alterar acesso
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Usuário</TableCell>
                    <TableCell>Papel</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              bgcolor: brand.sidebarBg,
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              flexShrink: 0,
                            }}
                          >
                            {user.email.charAt(0).toUpperCase()}
                          </Box>
                          <Typography
                            sx={{ fontSize: '0.92rem', fontWeight: 600, color: brand.textPrimary }}
                          >
                            {user.email}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          {roleIcons[user.role]}
                          <Typography variant="body2">{roleLabel(user.role)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <StatusPill active={user.active} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<TuneOutlinedIcon sx={{ fontSize: 18 }} />}
                          aria-label={`Alterar acesso de ${user.email}`}
                          onClick={() => setSelected(user)}
                        >
                          Alterar acesso
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box sx={{ bgcolor: brand.surfaceSubtle, borderTop: `1px solid ${brand.borderCard}` }}>
            <PaginationBar meta={users.data.meta} onChange={setPagination} />
          </Box>
        </Card>
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
