import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router';
import type { UserRole } from '../api/contract';
import { hasRole, MANAGEMENT_ROLES, roleLabel } from '../lib/roles/roles';
import { useAuth } from '../modules/auth/useAuth';

const drawerWidth = 264;

interface NavigationItem {
  label: string;
  to: string;
  icon: ReactNode;
  roles?: readonly UserRole[];
}

const navigation: NavigationItem[] = [
  { label: 'Faturas', to: '/invoices', icon: <ReceiptLongOutlinedIcon /> },
  {
    label: 'Revisão de pagamentos',
    to: '/payments/review',
    icon: <FactCheckOutlinedIcon />,
    roles: MANAGEMENT_ROLES,
  },
  { label: 'Contratos', to: '/contracts', icon: <AssignmentOutlinedIcon /> },
  { label: 'Locatários', to: '/tenants', icon: <PeopleAltOutlinedIcon /> },
  { label: 'Imóveis', to: '/properties', icon: <HomeWorkOutlinedIcon /> },
  {
    label: 'Usuários',
    to: '/users',
    icon: <PersonOutlinedIcon />,
    roles: ['ADMIN'],
  },
];

const pageTitles: Record<string, string> = {
  '/invoices': 'Faturas',
  '/payments/review': 'Revisão de pagamentos',
  '/contracts': 'Contratos',
  '/contracts/new': 'Novo contrato',
  '/tenants': 'Locatários',
  '/tenants/new': 'Novo locatário',
  '/properties': 'Imóveis',
  '/properties/new': 'Novo imóvel',
  '/users': 'Usuários',
  '/users/new': 'Novo usuário',
  '/account/password': 'Trocar senha',
  '/forbidden': 'Acesso negado',
};

function titleForPath(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/invoices/')) return 'Detalhe da fatura';
  if (pathname.startsWith('/contracts/')) return 'Detalhe do contrato';
  if (pathname.startsWith('/tenants/')) return 'Detalhe do locatário';
  if (pathname.startsWith('/properties/')) return 'Detalhe do imóvel';
  return 'Tenancy Ledger';
}

export function AppShell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { session, endSession } = useAuth();

  const visibleNavigation = useMemo(
    () =>
      navigation.filter(
        (item) => !item.roles || (session && hasRole(session.user.role, item.roles)),
      ),
    [session],
  );

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <ApartmentOutlinedIcon color="primary" />
        <Typography variant="h6" component="div" color="primary.dark" sx={{ fontWeight: 750 }}>
          Tenancy Ledger
        </Typography>
        {!desktop && (
          <IconButton
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            sx={{ ml: 'auto' }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List component="nav" aria-label="Navegação principal" sx={{ px: 1.5, py: 2 }}>
        {visibleNavigation.map((item) => {
          const selected =
            location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <ListItemButton
              component={RouterLink}
              to={item.to}
              key={item.to}
              onClick={() => setMobileOpen(false)}
              selected={selected}
              sx={{ minHeight: 48, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ mt: 'auto', p: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Button
          component={RouterLink}
          to="/account/password"
          onClick={() => setMobileOpen(false)}
          fullWidth
          startIcon={<PersonOutlinedIcon />}
          variant="text"
        >
          Minha conta
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <Button
        component="a"
        href="#main-content"
        sx={{
          left: 8,
          position: 'fixed',
          top: -100,
          zIndex: theme.zIndex.tooltip + 1,
          '&:focus': { top: 8 },
        }}
      >
        Ir para o conteúdo
      </Button>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          ml: { lg: `${drawerWidth}px` },
          width: { lg: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar>
          {!desktop && (
            <IconButton
              aria-label="Abrir menu"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography component="div" noWrap sx={{ fontWeight: 650 }}>
            {titleForPath(location.pathname)}
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', ml: 'auto' }}>
            <Avatar sx={{ bgcolor: 'primary.main', height: 36, width: 36 }}>
              {session?.user.email.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 650, maxWidth: 220 }}>
                {session?.user.email}
              </Typography>
              {session && (
                <Typography variant="caption" color="text.secondary">
                  {roleLabel(session.user.role)}
                </Typography>
              )}
            </Box>
            <Tooltip title="Sair">
              <IconButton aria-label="Sair" onClick={() => endSession('logged-out')}>
                <LogoutOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        aria-label="Menu lateral"
        sx={{ width: { lg: drawerWidth }, flexShrink: 0 }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 3, lg: 4 },
          pb: { xs: 2, sm: 3, lg: 4 },
          pt: { xs: 11, lg: 12 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
