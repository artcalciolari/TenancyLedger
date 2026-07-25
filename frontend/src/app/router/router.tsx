import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';
import { RouteErrorPage } from '../../components/feedback/AppErrorBoundary';
import {
  AuthFormSkeleton,
  DashboardSkeleton,
  DetailPageSkeleton,
  FormPageSkeleton,
  ListPageSkeleton,
} from '../../components/feedback/QueryState';
import { AppShell } from '../../layouts/AppShell';
import { AuthLayout } from '../../layouts/AuthLayout';
import { RequireAuth, RequireRole } from './guards';
import {
  loadBuildingDetailPage,
  loadCashboxPage,
  loadChangePasswordPage,
  loadContractDetailPage,
  loadContractsPage,
  loadDashboardPage,
  loadInvoiceDetailPage,
  loadInvoiceListPage,
  loadLoginPage,
  loadNewBuildingPage,
  loadNewContractPage,
  loadNewRoomPage,
  loadNewTenantPage,
  loadNewUserPage,
  loadOnboardingWizard,
  loadPortfolioPage,
  loadReviewPaymentsPage,
  loadRoomDetailPage,
  loadTenantDetailPage,
  loadTenantsPage,
  loadUsersPage,
} from './routePrefetch';

const LoginPage = lazy(loadLoginPage);
const DashboardPage = lazy(loadDashboardPage);
const ChangePasswordPage = lazy(loadChangePasswordPage);
const ContractsPage = lazy(loadContractsPage);
const NewContractPage = lazy(loadNewContractPage);
const ContractDetailPage = lazy(loadContractDetailPage);
const InvoiceListPage = lazy(loadInvoiceListPage);
const InvoiceDetailPage = lazy(loadInvoiceDetailPage);
const ReviewPaymentsPage = lazy(loadReviewPaymentsPage);
const PortfolioPage = lazy(loadPortfolioPage);
const NewRoomPage = lazy(loadNewRoomPage);
const RoomDetailPage = lazy(loadRoomDetailPage);
const NewBuildingPage = lazy(loadNewBuildingPage);
const BuildingDetailPage = lazy(loadBuildingDetailPage);
const TenantsPage = lazy(loadTenantsPage);
const NewTenantPage = lazy(loadNewTenantPage);
const TenantDetailPage = lazy(loadTenantDetailPage);
const UsersPage = lazy(loadUsersPage);
const NewUserPage = lazy(loadNewUserPage);
const OnboardingWizard = lazy(loadOnboardingWizard);
const CashboxPage = lazy(loadCashboxPage);

const managementRoles = ['ADMIN', 'MANAGER'] as const;

const page = (
  element: ReactNode,
  fallback: ReactNode = <ListPageSkeleton label="Carregando página…" />,
) => <Suspense fallback={fallback}>{element}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout>{page(<LoginPage />, <AuthFormSkeleton />)}</AuthLayout>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <RequireRole roles={managementRoles}>
          {page(<OnboardingWizard />, <FormPageSkeleton />)}
        </RequireRole>
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: page(<DashboardPage />, <DashboardSkeleton />),
      },
      {
        path: 'invoices',
        element: page(<InvoiceListPage />, <ListPageSkeleton label="Carregando faturas…" />),
      },
      {
        path: 'invoices/:invoiceId',
        element: page(<InvoiceDetailPage />, <DetailPageSkeleton label="Carregando fatura…" />),
      },
      {
        path: 'payments/review',
        element: (
          <RequireRole roles={managementRoles}>
            {page(<ReviewPaymentsPage />, <ListPageSkeleton label="Carregando pagamentos…" />)}
          </RequireRole>
        ),
      },
      {
        path: 'cashbox',
        element: (
          <RequireRole roles={managementRoles}>
            {page(<CashboxPage />, <ListPageSkeleton label="Carregando caixa…" />)}
          </RequireRole>
        ),
      },
      {
        path: 'contracts',
        element: page(<ContractsPage />, <ListPageSkeleton label="Carregando contratos…" />),
      },
      {
        path: 'contracts/new',
        element: (
          <RequireRole roles={managementRoles}>
            {page(<NewContractPage />, <FormPageSkeleton />)}
          </RequireRole>
        ),
      },
      {
        path: 'contracts/:contractId',
        element: page(<ContractDetailPage />, <DetailPageSkeleton label="Carregando contrato…" />),
      },
      {
        path: 'tenants',
        element: page(<TenantsPage />, <ListPageSkeleton label="Carregando locatários…" />),
      },
      {
        path: 'tenants/new',
        element: (
          <RequireRole roles={managementRoles}>
            {page(<NewTenantPage />, <FormPageSkeleton />)}
          </RequireRole>
        ),
      },
      {
        path: 'tenants/:tenantId',
        element: page(<TenantDetailPage />, <DetailPageSkeleton label="Carregando locatário…" />),
      },
      {
        path: 'portfolio',
        element: page(<PortfolioPage />, <ListPageSkeleton label="Carregando portfólio…" />),
      },
      {
        path: 'rooms',
        element: <Navigate to="/portfolio?tab=rooms" replace />,
      },
      {
        path: 'rooms/new',
        element: (
          <RequireRole roles={managementRoles}>
            {page(<NewRoomPage />, <FormPageSkeleton />)}
          </RequireRole>
        ),
      },
      {
        path: 'rooms/:roomId',
        element: page(<RoomDetailPage />, <DetailPageSkeleton label="Carregando quarto…" />),
      },
      {
        path: 'buildings',
        element: <Navigate to="/portfolio" replace />,
      },
      {
        path: 'buildings/new',
        element: (
          <RequireRole roles={managementRoles}>
            {page(<NewBuildingPage />, <FormPageSkeleton />)}
          </RequireRole>
        ),
      },
      {
        path: 'buildings/:buildingId',
        element: page(<BuildingDetailPage />, <DetailPageSkeleton label="Carregando prédio…" />),
      },
      {
        path: 'users',
        element: (
          <RequireRole roles={['ADMIN']}>
            {page(<UsersPage />, <ListPageSkeleton label="Carregando usuários…" />)}
          </RequireRole>
        ),
      },
      {
        path: 'users/new',
        element: (
          <RequireRole roles={['ADMIN']}>{page(<NewUserPage />, <FormPageSkeleton />)}</RequireRole>
        ),
      },
      {
        path: 'account/password',
        element: page(<ChangePasswordPage />, <FormPageSkeleton />),
      },
      {
        path: 'forbidden',
        element: (
          <PlaceholderPage
            title="Acesso negado"
            description="Você não tem permissão para acessar esta página."
            kind="forbidden"
            action={{ label: 'Voltar para a visão geral', to: '/dashboard' }}
          />
        ),
      },
      {
        path: '*',
        element: (
          <PlaceholderPage
            title="Página não encontrada"
            description="Confira o endereço ou retorne para a página inicial."
            kind="not-found"
            action={{ label: 'Ir para a visão geral', to: '/dashboard' }}
          />
        ),
      },
    ],
  },
]);
