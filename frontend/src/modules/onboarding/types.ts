import type { CreateTenantForm } from '../tenants/schemas';
import type {
  CompleteOnboardingView,
  OnboardingDraftListView,
  OnboardingDraftStatus as ApiOnboardingDraftStatus,
  OnboardingDraftView,
  RoomView,
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
  roomId: string | null;
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

type ApiAvailableRoomFilters = NonNullable<
  operations['RoomController_list']['parameters']['query']
>;

export type AvailableRoomFilters = Omit<ApiAvailableRoomFilters, 'date' | 'status'> & {
  date: string;
};

export type AvailableRoom = RoomView;

export interface PhotoSelection {
  file: File;
  previewUrl: string;
  metadata: PhotoDraftMetadata;
}
