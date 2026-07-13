import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { PlaceholderPage } from '../../components/feedback/PlaceholderPage';
import { RouteErrorPage } from '../../components/feedback/AppErrorBoundary';
import { LoadingState } from '../../components/feedback/QueryState';
import { AppShell } from '../../layouts/AppShell';
import { AuthLayout } from '../../layouts/AuthLayout';
import { RequireAuth, RequireRole } from './guards';

const LoginPage = lazy(() =>
  import('../../modules/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('../../modules/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const ChangePasswordPage = lazy(() =>
  import('../../modules/auth/ChangePasswordPage').then((module) => ({
    default: module.ChangePasswordPage,
  })),
);
const ContractsPage = lazy(() =>
  import('../../modules/contracts/ContractsPage').then((module) => ({
    default: module.ContractsPage,
  })),
);
const NewContractPage = lazy(() =>
  import('../../modules/contracts/NewContractPage').then((module) => ({
    default: module.NewContractPage,
  })),
);
const ContractDetailPage = lazy(() =>
  import('../../modules/contracts/ContractDetailPage').then((module) => ({
    default: module.ContractDetailPage,
  })),
);
const InvoiceListPage = lazy(() =>
  import('../../modules/invoices/InvoiceListPage').then((module) => ({
    default: module.InvoiceListPage,
  })),
);
const InvoiceDetailPage = lazy(() =>
  import('../../modules/invoices/InvoiceDetailPage').then((module) => ({
    default: module.InvoiceDetailPage,
  })),
);
const ReviewPaymentsPage = lazy(() =>
  import('../../modules/invoices/ReviewPaymentsPage').then((module) => ({
    default: module.ReviewPaymentsPage,
  })),
);
const PropertiesPage = lazy(() =>
  import('../../modules/properties/PropertiesPage').then((module) => ({
    default: module.PropertiesPage,
  })),
);
const NewPropertyPage = lazy(() =>
  import('../../modules/properties/NewPropertyPage').then((module) => ({
    default: module.NewPropertyPage,
  })),
);
const PropertyDetailPage = lazy(() =>
  import('../../modules/properties/PropertyDetailPage').then((module) => ({
    default: module.PropertyDetailPage,
  })),
);
const TenantsPage = lazy(() =>
  import('../../modules/tenants/TenantsPage').then((module) => ({ default: module.TenantsPage })),
);
const NewTenantPage = lazy(() =>
  import('../../modules/tenants/NewTenantPage').then((module) => ({
    default: module.NewTenantPage,
  })),
);
const TenantDetailPage = lazy(() =>
  import('../../modules/tenants/TenantDetailPage').then((module) => ({
    default: module.TenantDetailPage,
  })),
);
const UsersPage = lazy(() =>
  import('../../modules/users/UsersPage').then((module) => ({ default: module.UsersPage })),
);
const NewUserPage = lazy(() =>
  import('../../modules/users/NewUserPage').then((module) => ({ default: module.NewUserPage })),
);

const managementRoles = ['ADMIN', 'MANAGER'] as const;

const page = (element: ReactNode) => (
  <Suspense fallback={<LoadingState label="Carregando página…" />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout>{page(<LoginPage />)}</AuthLayout>,
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
        element: page(<DashboardPage />),
      },
      {
        path: 'invoices',
        element: page(<InvoiceListPage />),
      },
      {
        path: 'invoices/:invoiceId',
        element: page(<InvoiceDetailPage />),
      },
      {
        path: 'payments/review',
        element: <RequireRole roles={managementRoles}>{page(<ReviewPaymentsPage />)}</RequireRole>,
      },
      {
        path: 'contracts',
        element: page(<ContractsPage />),
      },
      {
        path: 'contracts/new',
        element: <RequireRole roles={managementRoles}>{page(<NewContractPage />)}</RequireRole>,
      },
      {
        path: 'contracts/:contractId',
        element: page(<ContractDetailPage />),
      },
      {
        path: 'tenants',
        element: page(<TenantsPage />),
      },
      {
        path: 'tenants/new',
        element: <RequireRole roles={managementRoles}>{page(<NewTenantPage />)}</RequireRole>,
      },
      {
        path: 'tenants/:tenantId',
        element: page(<TenantDetailPage />),
      },
      {
        path: 'properties',
        element: page(<PropertiesPage />),
      },
      {
        path: 'properties/new',
        element: <RequireRole roles={managementRoles}>{page(<NewPropertyPage />)}</RequireRole>,
      },
      {
        path: 'properties/:propertyId',
        element: page(<PropertyDetailPage />),
      },
      {
        path: 'users',
        element: <RequireRole roles={['ADMIN']}>{page(<UsersPage />)}</RequireRole>,
      },
      {
        path: 'users/new',
        element: <RequireRole roles={['ADMIN']}>{page(<NewUserPage />)}</RequireRole>,
      },
      {
        path: 'account/password',
        element: page(<ChangePasswordPage />),
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
