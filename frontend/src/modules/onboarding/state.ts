import type { CreateTenantForm } from '../tenants/schemas';
import type { OnboardingPayload, TenantReferenceDraft } from './types';

export const emptyPersonalData: CreateTenantForm = {
  name: '',
  cpf: '',
  rg: '',
  profession: '',
  civilStatus: 'SINGLE',
  email: '',
  mobilePhone: '',
};

export const emptyReference = (): TenantReferenceDraft => ({
  name: '',
  relationship: '',
  phone: '',
  email: '',
});

export function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyPayload(): OnboardingPayload {
  return {
    version: 1,
    personalData: { ...emptyPersonalData },
    photo: null,
    references: [emptyReference(), emptyReference()],
    propertyUnitId: null,
    moveInDate: todayIso(),
    monthlyBaseValueCents: null,
  };
}

export function coveredCalendarPeriod(startIso: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(Date.UTC(year, monthIndex, day));
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== monthIndex ||
    start.getUTCDate() !== day
  ) {
    return null;
  }

  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));
  const daysInNextMonth = new Date(
    Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  nextMonth.setUTCDate(Math.min(day, daysInNextMonth));
  nextMonth.setUTCDate(nextMonth.getUTCDate() - 1);
  const end = nextMonth.toISOString().slice(0, 10);
  return { start: startIso, end };
}
