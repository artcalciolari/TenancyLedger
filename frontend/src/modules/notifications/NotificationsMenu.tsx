import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { queryKeys } from '../../api/query-keys';
import { formatDateTime } from '../../lib/dates/dates';
import { notificationsApi } from './api';

export function NotificationsMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationsApi.list,
    staleTime: 15_000,
    refetchInterval: () => (document.visibilityState === 'visible' ? 30_000 : false),
  });
  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
  const unread = notifications.data?.unreadCount ?? 0;

  const open = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const goToNotification = (id: string, resourceId: string, readAt: string | null) => {
    if (!readAt) markRead.mutate(id);
    setAnchor(null);
    void navigate(`/invoices/${resourceId}`);
  };

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton aria-label={`${unread} notificações não lidas`} onClick={open}>
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { maxWidth: 420, width: 'calc(100vw - 32px)' } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h2">Notificações</Typography>
            <Button
              size="small"
              variant="text"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Marcar todas como lidas
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" role="status">
            Atualização automática a cada 30 segundos
            {notifications.isFetching ? ' · atualizando…' : ''}
          </Typography>
        </Box>
        <Divider />
        {notifications.isPending ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.isError ? (
          <Box sx={{ p: 2 }}>
            <Typography color="error" variant="body2">
              Não foi possível carregar as notificações.
            </Typography>
            <Button variant="text" onClick={() => void notifications.refetch()}>
              Tentar novamente
            </Button>
          </Box>
        ) : notifications.data.data.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            Nenhuma notificação.
          </Typography>
        ) : (
          notifications.data.data.map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() =>
                goToNotification(notification.id, notification.resourceId, notification.readAt)
              }
              sx={{
                alignItems: 'flex-start',
                bgcolor: notification.readAt ? undefined : 'action.hover',
                whiteSpace: 'normal',
              }}
            >
              <ListItemText
                primary={notification.title}
                secondary={`${notification.message} · ${formatDateTime(notification.createdAt)}`}
                slotProps={{
                  primary: { sx: { fontWeight: notification.readAt ? 500 : 750 } },
                }}
              />
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
