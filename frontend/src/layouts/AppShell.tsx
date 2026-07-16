import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box,
  Drawer,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router';
import { queryKeys } from '../api/query-keys';
import type { UserRole } from '../api/contract';
import { brand } from '../app/theme/theme';
import { hasRole, MANAGEMENT_ROLES, roleLabel } from '../lib/roles/roles';
import { useAuth } from '../modules/auth/useAuth';
import { dashboardApi } from '../modules/dashboard/api';
import { NotificationsMenu } from '../modules/notifications/NotificationsMenu';

const sidebarWidth = 262;
const topbarHeight = 68;

interface NavigationItem {
  label: string;
  to: string;
  icon: ReactNode;
  roles?: readonly UserRole[];
  showReviewBadge?: boolean;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: NavigationGroup[] = [
  {
    label: 'Operação',
    items: [
      { label: 'Visão geral', to: '/dashboard', icon: <GridViewOutlinedIcon /> },
      { label: 'Faturas', to: '/invoices', icon: <ReceiptLongOutlinedIcon /> },
      {
        label: 'Revisão de pagamentos',
        to: '/payments/review',
        icon: <FactCheckOutlinedIcon />,
        roles: MANAGEMENT_ROLES,
        showReviewBadge: true,
      },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { label: 'Contratos', to: '/contracts', icon: <DescriptionOutlinedIcon /> },
      { label: 'Locatários', to: '/tenants', icon: <PeopleAltOutlinedIcon /> },
      { label: 'Imóveis', to: '/properties', icon: <HomeWorkOutlinedIcon /> },
      { label: 'Prédios', to: '/buildings', icon: <ApartmentOutlinedIcon /> },
    ],
  },
  {
    label: 'Administração',
    items: [
      {
        label: 'Usuários',
        to: '/users',
        icon: <ManageAccountsOutlinedIcon />,
        roles: ['ADMIN'],
      },
    ],
  },
];

const pageMeta: Record<string, { title: string; crumb: string }> = {
  '/dashboard': { title: 'Visão geral', crumb: 'Painel' },
  '/invoices': { title: 'Faturas', crumb: 'Operação' },
  '/payments/review': { title: 'Revisão de pagamentos', crumb: 'Operação' },
  '/contracts': { title: 'Contratos', crumb: 'Cadastros' },
  '/contracts/new': { title: 'Novo contrato', crumb: 'Cadastros · Contratos' },
  '/tenants': { title: 'Locatários', crumb: 'Cadastros' },
  '/tenants/new': { title: 'Novo locatário', crumb: 'Cadastros · Locatários' },
  '/properties': { title: 'Imóveis', crumb: 'Cadastros' },
  '/properties/new': { title: 'Novo imóvel', crumb: 'Cadastros · Imóveis' },
  '/buildings': { title: 'Prédios', crumb: 'Cadastros' },
  '/buildings/new': { title: 'Novo prédio', crumb: 'Cadastros · Prédios' },
  '/users': { title: 'Usuários', crumb: 'Administração' },
  '/users/new': { title: 'Novo usuário', crumb: 'Administração' },
  '/account/password': { title: 'Trocar senha', crumb: 'Conta' },
  '/forbidden': { title: 'Acesso negado', crumb: '' },
};

function metaForPath(pathname: string): { title: string; crumb: string } {
  if (pageMeta[pathname]) return pageMeta[pathname];
  if (pathname.startsWith('/invoices/'))
    return { title: 'Detalhe da fatura', crumb: 'Operação · Faturas' };
  if (pathname.startsWith('/contracts/'))
    return { title: 'Detalhe do contrato', crumb: 'Cadastros · Contratos' };
  if (pathname.startsWith('/tenants/'))
    return { title: 'Detalhe do locatário', crumb: 'Cadastros · Locatários' };
  if (pathname.startsWith('/properties/'))
    return { title: 'Detalhe do imóvel', crumb: 'Cadastros · Imóveis' };
  if (pathname.startsWith('/buildings/'))
    return { title: 'Detalhe do prédio', crumb: 'Cadastros · Prédios' };
  return { title: 'Tenancy Ledger', crumb: '' };
}

export function AppShell() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpAnchor, setHelpAnchor] = useState<HTMLElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { session, endSession } = useAuth();

  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.roles || (session && hasRole(session.user.role, item.roles)),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [session],
  );

  const mayReview = Boolean(session && hasRole(session.user.role, MANAGEMENT_ROLES));
  const summary = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: dashboardApi.summary,
    staleTime: 30_000,
    enabled: mayReview,
  });
  const reviewCount = summary.data?.payments.submitted ?? 0;

  useEffect(() => {
    if (mobileOpen) mobileCloseButtonRef.current?.focus();
  }, [mobileOpen]);

  const { title, crumb } = metaForPath(location.pathname);

  const sidebar = (temporary: boolean) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: brand.sidebarBg,
      }}
    >
      <Stack
        direction="row"
        spacing={1.4}
        sx={{ alignItems: 'center', height: topbarHeight, px: 2.75, flexShrink: 0 }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '9px',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ApartmentOutlinedIcon sx={{ color: '#fff', fontSize: 21 }} />
        </Box>
        <Typography
          sx={{ fontSize: '1.02rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}
        >
          Tenancy Ledger
        </Typography>
        {!desktop && (
          <IconButton
            ref={temporary ? mobileCloseButtonRef : undefined}
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            sx={{ ml: 'auto', color: brand.sidebarItemInactiveFg }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Stack>
      <Box
        component="nav"
        aria-label="Navegação principal"
        sx={{ flex: 1, overflowY: 'auto', px: 1.75, py: 1 }}
      >
        {visibleGroups.map((group) => (
          <Box key={group.label} sx={{ mb: 2.25 }}>
            <Typography
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: brand.sidebarGroupLabel,
                px: 1.5,
                pb: 1,
              }}
            >
              {group.label}
            </Typography>
            {group.items.map((item) => {
              const selected =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              const badge = item.showReviewBadge && reviewCount > 0 ? reviewCount : null;
              return (
                <Box
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 44,
                    borderRadius: '10px',
                    px: 1.5,
                    mb: 0.4,
                    textDecoration: 'none',
                    bgcolor: selected ? brand.sidebarItemActiveBg : 'transparent',
                    '&:hover': {
                      bgcolor: selected ? brand.sidebarItemActiveBg : 'rgba(255,255,255,0.04)',
                    },
                    '&:focus-visible': { outline: '3px solid #79C2C7', outlineOffset: 2 },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 22,
                      borderRadius: '0 3px 3px 0',
                      bgcolor: selected ? brand.accentBright : 'transparent',
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      color: selected ? brand.sidebarIconActive : brand.sidebarIconInactive,
                      '& svg': { fontSize: 21 },
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: '0.92rem',
                      fontWeight: selected ? 700 : 500,
                      color: selected ? '#FFFFFF' : brand.sidebarItemInactiveFg,
                    }}
                  >
                    {item.label}
                  </Typography>
                  {badge !== null && (
                    <Box
                      sx={{
                        minWidth: 20,
                        height: 20,
                        px: 0.75,
                        borderRadius: '10px',
                        bgcolor: brand.ocre,
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {badge}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1.75, borderTop: `1px solid ${brand.sidebarBorder}`, flexShrink: 0 }}>
        <Stack
          direction="row"
          spacing={1.4}
          component={RouterLink}
          to="/account/password"
          onClick={() => setMobileOpen(false)}
          sx={{
            alignItems: 'center',
            borderRadius: '11px',
            px: 1.25,
            py: 1,
            bgcolor: 'rgba(255,255,255,0.04)',
            textDecoration: 'none',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
              flexShrink: 0,
            }}
          >
            {session?.user.email.charAt(0).toUpperCase()}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
              {session?.user.email}
            </Typography>
            {session && (
              <Typography sx={{ fontSize: '0.72rem', color: brand.sidebarFooterMuted }}>
                {roleLabel(session.user.role)}
              </Typography>
            )}
          </Box>
          <Tooltip title="Sair">
            <IconButton
              aria-label="Sair"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                endSession('logged-out');
              }}
              sx={{ color: brand.sidebarFooterMuted, width: 32, height: 32 }}
            >
              <LogoutOutlinedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: brand.pageBg }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          left: 8,
          top: -100,
          zIndex: theme.zIndex.tooltip + 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: '#fff',
          fontWeight: 650,
          '&:focus': { top: 8 },
        }}
      >
        Ir para o conteúdo
      </Box>
      <Box
        component="nav"
        aria-label="Menu lateral"
        sx={{ width: { lg: sidebarWidth }, flexShrink: 0 }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': { width: sidebarWidth, border: 'none' },
          }}
        >
          {sidebar(true)}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': { width: sidebarWidth, boxSizing: 'border-box', border: 'none' },
          }}
        >
          {sidebar(false)}
        </Drawer>
      </Box>
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: { xs: 0, lg: sidebarWidth },
          right: 0,
          height: topbarHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: { xs: 2, sm: 3, lg: 5 },
          bgcolor: 'rgba(243,241,234,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${brand.borderInput}`,
          zIndex: theme.zIndex.appBar,
        }}
      >
        {!desktop && (
          <IconButton aria-label="Abrir menu" onClick={() => setMobileOpen(true)} sx={{ mr: 0.5 }}>
            <MenuIcon />
          </IconButton>
        )}
        <Box sx={{ minWidth: 0 }}>
          {crumb && (
            <Typography
              sx={{
                fontSize: '0.74rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: brand.textSecondary,
              }}
            >
              {crumb}
            </Typography>
          )}
          <Typography
            noWrap
            sx={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: brand.textPrimary,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: 'auto' }}>
          <NotificationsMenu />
          <Tooltip title="Ajuda">
            <IconButton
              aria-label="Ajuda"
              onClick={(event: MouseEvent<HTMLElement>) => setHelpAnchor(event.currentTarget)}
              sx={{
                width: 42,
                height: 42,
                borderRadius: '11px',
                bgcolor: 'background.paper',
                border: `1px solid ${brand.borderInput}`,
                color: brand.textSecondary,
              }}
            >
              <HelpOutlineOutlinedIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(helpAnchor)}
            anchorEl={helpAnchor}
            onClose={() => setHelpAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Typography sx={{ p: 2, maxWidth: 260, fontSize: '0.86rem' }}>
              Problemas para acessar ou usar o sistema? Fale com o administrador do sistema.
            </Typography>
          </Popover>
        </Stack>
      </Box>
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 3, lg: 5 },
          pb: { xs: 3, lg: 6 },
          pt: { xs: `${topbarHeight + 24}px`, lg: `${topbarHeight + 28}px` },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
