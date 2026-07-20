import type { OnboardingDraftView, PropertyView } from '../../api/contract';
import { executeOpenApi, executeOpenApiVoid, openApiClient } from '../../api/openapi-client';
import { onboardingPayloadSchema } from './schemas';
import type {
  AvailablePropertyFilters,
  CompleteOnboardingResult,
  OnboardingDraft,
  OnboardingDraftList,
  OnboardingPayload,
} from './types';

function toOnboardingDraft(value: OnboardingDraftView): OnboardingDraft {
  return { ...value, payload: onboardingPayloadSchema.parse(value.payload) };
}

export const onboardingApi = {
  async listDrafts(): Promise<OnboardingDraftList> {
    const value = await executeOpenApi(
      openApiClient.GET('/onboarding-drafts', { params: { query: { status: 'DRAFT' } } }),
    );
    return { ...value, data: value.data.map(toOnboardingDraft) };
  },

  async getDraft(id: string): Promise<OnboardingDraft> {
    const value = await executeOpenApi(
      openApiClient.GET('/onboarding-drafts/{id}', { params: { path: { id } } }),
    );
    return toOnboardingDraft(value);
  },

  async createDraft(payload: OnboardingPayload): Promise<OnboardingDraft> {
    const value = await executeOpenApi(
      openApiClient.POST('/onboarding-drafts', { body: { payload: { ...payload } } }),
    );
    return toOnboardingDraft(value);
  },

  async updateDraft(id: string, payload: OnboardingPayload): Promise<OnboardingDraft> {
    const value = await executeOpenApi(
      openApiClient.PATCH('/onboarding-drafts/{id}', {
        params: { path: { id } },
        body: { payload: { ...payload } },
      }),
    );
    return toOnboardingDraft(value);
  },

  completeDraft(id: string): Promise<CompleteOnboardingResult> {
    return executeOpenApi(
      openApiClient.POST('/onboarding-drafts/{id}/complete', { params: { path: { id } } }),
    );
  },

  async availableProperties(filters: AvailablePropertyFilters): Promise<PropertyView[]> {
    return executeOpenApi(
      openApiClient.GET('/properties/available', {
        params: {
          query: {
            date: filters.date,
            neighborhood: filters.neighborhood,
            type: filters.type,
            buildingId: filters.buildingId,
          },
        },
      }),
    );
  },

  uploadDraftPhoto(draftId: string, photo: File): Promise<void> {
    const form = new FormData();
    form.set('photo', photo, photo.name);
    return executeOpenApiVoid(
      openApiClient.POST('/onboarding-drafts/{id}/photo', {
        params: { path: { id: draftId } },
        body: { photo: photo.name },
        bodySerializer: () => form,
      }),
    );
  },

  removeDraftPhoto(draftId: string): Promise<void> {
    return executeOpenApiVoid(
      openApiClient.DELETE('/onboarding-drafts/{id}/photo', { params: { path: { id: draftId } } }),
    );
  },

  getDraftPhotoUrl(draftId: string): Promise<{ url: string; expiresInSeconds: number }> {
    return executeOpenApi(
      openApiClient.GET('/onboarding-drafts/{id}/photo/download', {
        params: { path: { id: draftId } },
      }),
    );
  },
};
