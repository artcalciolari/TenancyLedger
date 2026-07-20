import type { CreateTenantForm } from '../tenants/schemas';
import type {
  CompleteOnboardingView,
  OnboardingDraftListView,
  OnboardingDraftStatus as ApiOnboardingDraftStatus,
  OnboardingDraftView,
  PropertyView,
} from '../../api/contract';
import type { operations } from '../../api/generated/schema';

export interface TenantReferenceDraft {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface PhotoDraftMetadata {
  name: string;
  type: string;
  size: number;
  skipped: boolean;
}

export interface OnboardingPayload {
  version: 1;
  personalData: CreateTenantForm;
  photo: PhotoDraftMetadata | null;
  references: TenantReferenceDraft[];
  propertyUnitId: string | null;
  moveInDate: string;
  monthlyBaseValueCents: number | null;
}

export type OnboardingDraftStatus = ApiOnboardingDraftStatus;

export type OnboardingDraft = Omit<OnboardingDraftView, 'payload'> & {
  payload: OnboardingPayload;
};

export type OnboardingDraftList = Omit<OnboardingDraftListView, 'data'> & {
  data: OnboardingDraft[];
};

export type CompleteOnboardingResult = CompleteOnboardingView;

type ApiAvailablePropertyFilters = NonNullable<
  operations['PropertyController_listAvailable']['parameters']['query']
>;

export type AvailablePropertyFilters = Omit<ApiAvailablePropertyFilters, 'date'> & { date: string };

export type AvailableProperty = PropertyView;

export interface PhotoSelection {
  file: File;
  previewUrl: string;
  metadata: PhotoDraftMetadata;
}
