import type {
  CashClosingStatus as ApiCashClosingStatus,
  CashClosingView as ApiCashClosingView,
} from '../../api/contract';
import type { operations } from '../../api/generated/schema';

export type CashClosingStatus = ApiCashClosingStatus;
export type CashClosingView = ApiCashClosingView;

export type CashClosingFilters = NonNullable<
  operations['CashboxController_list']['parameters']['query']
>;
