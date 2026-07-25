const loadLoginModule = () => import('../../modules/auth/LoginPage');
const loadDashboardModule = () => import('../../modules/dashboard/DashboardPage');
const loadChangePasswordModule = () => import('../../modules/auth/ChangePasswordPage');
const loadContractsModule = () => import('../../modules/contracts/ContractsPage');
const loadNewContractModule = () => import('../../modules/contracts/NewContractPage');
const loadContractDetailModule = () => import('../../modules/contracts/ContractDetailPage');
const loadInvoiceListModule = () => import('../../modules/invoices/InvoiceListPage');
const loadInvoiceDetailModule = () => import('../../modules/invoices/InvoiceDetailPage');
const loadReviewPaymentsModule = () => import('../../modules/invoices/ReviewPaymentsPage');
const loadPortfolioModule = () => import('../../modules/portfolio/PortfolioPage');
const loadNewRoomModule = () => import('../../modules/rooms/NewRoomPage');
const loadRoomDetailModule = () => import('../../modules/rooms/RoomDetailPage');
const loadNewBuildingModule = () => import('../../modules/buildings/NewBuildingPage');
const loadBuildingDetailModule = () => import('../../modules/buildings/BuildingDetailPage');
const loadTenantsModule = () => import('../../modules/tenants/TenantsPage');
const loadNewTenantModule = () => import('../../modules/tenants/NewTenantPage');
const loadTenantDetailModule = () => import('../../modules/tenants/TenantDetailPage');
const loadUsersModule = () => import('../../modules/users/UsersPage');
const loadNewUserModule = () => import('../../modules/users/NewUserPage');
const loadOnboardingModule = () => import('../../modules/onboarding/OnboardingWizard');
const loadCashboxModule = () => import('../../modules/cashbox/CashboxPage');

export const loadLoginPage = () =>
  loadLoginModule().then((module) => ({ default: module.LoginPage }));
export const loadDashboardPage = () =>
  loadDashboardModule().then((module) => ({ default: module.DashboardPage }));
export const loadChangePasswordPage = () =>
  loadChangePasswordModule().then((module) => ({ default: module.ChangePasswordPage }));
export const loadContractsPage = () =>
  loadContractsModule().then((module) => ({ default: module.ContractsPage }));
export const loadNewContractPage = () =>
  loadNewContractModule().then((module) => ({ default: module.NewContractPage }));
export const loadContractDetailPage = () =>
  loadContractDetailModule().then((module) => ({ default: module.ContractDetailPage }));
export const loadInvoiceListPage = () =>
  loadInvoiceListModule().then((module) => ({ default: module.InvoiceListPage }));
export const loadInvoiceDetailPage = () =>
  loadInvoiceDetailModule().then((module) => ({ default: module.InvoiceDetailPage }));
export const loadReviewPaymentsPage = () =>
  loadReviewPaymentsModule().then((module) => ({ default: module.ReviewPaymentsPage }));
export const loadPortfolioPage = () =>
  loadPortfolioModule().then((module) => ({ default: module.PortfolioPage }));
export const loadNewRoomPage = () =>
  loadNewRoomModule().then((module) => ({ default: module.NewRoomPage }));
export const loadRoomDetailPage = () =>
  loadRoomDetailModule().then((module) => ({ default: module.RoomDetailPage }));
export const loadNewBuildingPage = () =>
  loadNewBuildingModule().then((module) => ({ default: module.NewBuildingPage }));
export const loadBuildingDetailPage = () =>
  loadBuildingDetailModule().then((module) => ({ default: module.BuildingDetailPage }));
export const loadTenantsPage = () =>
  loadTenantsModule().then((module) => ({ default: module.TenantsPage }));
export const loadNewTenantPage = () =>
  loadNewTenantModule().then((module) => ({ default: module.NewTenantPage }));
export const loadTenantDetailPage = () =>
  loadTenantDetailModule().then((module) => ({ default: module.TenantDetailPage }));
export const loadUsersPage = () =>
  loadUsersModule().then((module) => ({ default: module.UsersPage }));
export const loadNewUserPage = () =>
  loadNewUserModule().then((module) => ({ default: module.NewUserPage }));
export const loadOnboardingWizard = () =>
  loadOnboardingModule().then((module) => ({ default: module.OnboardingWizard }));
export const loadCashboxPage = () =>
  loadCashboxModule().then((module) => ({ default: module.CashboxPage }));

const prefetchRoutes = [
  { prefix: '/dashboard', load: loadDashboardModule },
  { prefix: '/invoices', load: loadInvoiceListModule },
  { prefix: '/payments/review', load: loadReviewPaymentsModule },
  { prefix: '/cashbox', load: loadCashboxModule },
  { prefix: '/contracts', load: loadContractsModule },
  { prefix: '/tenants', load: loadTenantsModule },
  { prefix: '/portfolio', load: loadPortfolioModule },
  // Maior chunk lazy da aplicação: é o que mais ganha com o prefetch por hover/foco.
  { prefix: '/onboarding', load: loadOnboardingModule },
  { prefix: '/users', load: loadUsersModule },
  { prefix: '/account/password', load: loadChangePasswordModule },
] as const;

export function prefetchRoute(pathname: string) {
  const entry = prefetchRoutes.find((candidate) => pathname.startsWith(candidate.prefix));
  if (!entry) return;
  void entry.load();
}
