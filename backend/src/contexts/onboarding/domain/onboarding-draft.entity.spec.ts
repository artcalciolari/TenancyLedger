import { ValidationError } from '../../../core/domain/errors/validation.error';
import {
  OnboardingDraft,
  OnboardingDraftNotEditableError,
  OnboardingDraftStatus,
} from './onboarding-draft.entity';

const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';

describe('OnboardingDraft', () => {
  it('creates a defensive JSON copy as an editable draft', () => {
    const payload = { step: 2, tenant: { name: 'Maria' } };
    const draft = OnboardingDraft.create(payload, USER_ID);
    payload.tenant.name = 'Alterada';

    expect(draft).toMatchObject({
      payload: { step: 2, tenant: { name: 'Maria' } },
      createdByUserId: USER_ID,
      status: OnboardingDraftStatus.DRAFT,
    });
  });

  it.each([null, false, 42, 'etapa', ['tenant', 'references']])(
    'accepts any JSON root value (%p)',
    (payload) => {
      expect(OnboardingDraft.create(payload, USER_ID).payload).toEqual(payload);
    },
  );

  it.each([
    ['undefined', undefined],
    [
      'circular data',
      (() => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      })(),
    ],
    ['BigInt', { value: BigInt(1) }],
  ])('rejects %s because it is not JSON serializable', (_label, payload) => {
    expect(() => OnboardingDraft.create(payload, USER_ID)).toThrow(
      new ValidationError('O payload do rascunho deve ser um JSON válido.'),
    );
  });

  it('accepts exactly 64 KiB and rejects a larger serialized payload', () => {
    const keyOverhead = Buffer.byteLength('{"value":""}', 'utf8');
    const exact = { value: 'x'.repeat(OnboardingDraft.MAX_PAYLOAD_BYTES - keyOverhead) };
    const oversized = { value: `${exact.value}x` };

    expect(() => OnboardingDraft.create(exact, USER_ID)).not.toThrow();
    expect(() => OnboardingDraft.create(oversized, USER_ID)).toThrow(
      new ValidationError('O payload do rascunho deve ter no máximo 64 KiB.'),
    );
  });

  it('updates payload while the draft is editable', () => {
    const draft = OnboardingDraft.create({ step: 1 }, USER_ID);
    draft.updatePayload({ step: 3 });
    expect(draft.payload).toEqual({ step: 3 });
  });

  it('marks a draft completed only once', () => {
    const draft = OnboardingDraft.create({}, USER_ID);
    draft.markCompleted();
    expect(draft.status).toBe(OnboardingDraftStatus.COMPLETED);
    expect(() => draft.markCompleted()).toThrow(OnboardingDraftNotEditableError);
    expect(() => draft.updatePayload({ step: 5 })).toThrow(OnboardingDraftNotEditableError);
    expect(() => draft.discard()).toThrow(
      new OnboardingDraftNotEditableError('Um rascunho concluído não pode ser descartado.'),
    );
  });

  it('discards a draft idempotently and prevents later edits', () => {
    const draft = OnboardingDraft.create({}, USER_ID);
    draft.discard();
    draft.discard();
    expect(draft.status).toBe(OnboardingDraftStatus.DISCARDED);
    expect(() => draft.updatePayload({})).toThrow(OnboardingDraftNotEditableError);
  });
});
