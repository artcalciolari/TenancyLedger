import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/problem';
import { brand } from '../../app/theme/theme';
import { formatDateTime } from '../../lib/dates/dates';
import { createTenantSchema } from '../tenants/schemas';
import { onboardingApi } from './api';
import {
  issuesToFieldErrors,
  onboardingPayloadSchema,
  referencesSchema,
  reviewSchema,
  type FieldErrors,
} from './schemas';
import { createEmptyPayload } from './state';
import { PersonalDataStep } from './steps/PersonalDataStep';
import { PhotoStep } from './steps/PhotoStep';
import { ReferencesStep } from './steps/ReferencesStep';
import { ReviewStep } from './steps/ReviewStep';
import { RoomSearchStep } from './steps/RoomSearchStep';
import type {
  AvailableProperty,
  CompleteOnboardingResult,
  OnboardingDraft,
  OnboardingPayload,
  PhotoSelection,
} from './types';

const steps = ['Dados pessoais', 'Foto', 'Referências', 'Quarto', 'Revisão'] as const;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

type PendingPhotoAction = { kind: 'upload'; file: File } | { kind: 'remove' } | null;

function contractIdFrom(result: CompleteOnboardingResult): string | undefined {
  return result.contractId;
}

function draftSignature(payload: OnboardingPayload): string {
  return JSON.stringify(payload);
}

function newestDraft(drafts: OnboardingDraft[]): OnboardingDraft | null {
  return (
    [...drafts]
      .filter((draft) => draft.status === 'DRAFT')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

function isUnitOccupancyConflict(detail: string): boolean {
  const normalized = detail.toLocaleLowerCase('pt-BR');
  const mentionsUnit = normalized.includes('unidade') || normalized.includes('quarto');
  const mentionsAvailability =
    normalized.includes('ocupad') ||
    normalized.includes('sobrepost') ||
    normalized.includes('disponível') ||
    normalized.includes('disponivel');
  return mentionsUnit && mentionsAvailability;
}

function isDuplicateTenantConflict(detail: string): boolean {
  const normalized = detail.toLocaleLowerCase('pt-BR');
  return (
    normalized.includes('cpf') ||
    normalized.includes('e-mail') ||
    normalized.includes('email') ||
    normalized.includes('telefone')
  );
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDraftId = searchParams.get('draft');
  const theme = useTheme();
  const compactStepper = useMediaQuery(theme.breakpoints.down('sm'));
  const initialPayload = useMemo(() => createEmptyPayload(), []);
  const [payload, setPayload] = useState<OnboardingPayload>(initialPayload);
  const [draftId, setDraftId] = useState<string | null>(requestedDraftId);
  const [lastSavedSignature, setLastSavedSignature] = useState(() =>
    draftSignature(initialPayload),
  );
  const [activeStep, setActiveStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [selectedProperty, setSelectedProperty] = useState<AvailableProperty | null>(null);
  const [photoSelection, setPhotoSelection] = useState<PhotoSelection | null>(null);
  const [remotePhotoUrl, setRemotePhotoUrl] = useState<string | null>(null);
  const [pendingPhotoAction, setPendingPhotoAction] = useState<PendingPhotoAction>(null);
  const photoPreviewRef = useRef<string | null>(null);
  const [dismissedDraftId, setDismissedDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    severity: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const allowNavigationRef = useRef(false);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);

  const dirty = draftSignature(payload) !== lastSavedSignature || pendingPhotoAction !== null;

  const requestedDraft = useQuery({
    queryKey: ['onboarding-draft', requestedDraftId],
    queryFn: () => onboardingApi.getDraft(requestedDraftId!),
    enabled: Boolean(requestedDraftId),
    retry: false,
  });
  const draftList = useQuery({
    queryKey: ['onboarding-drafts', 'DRAFT'],
    queryFn: () => onboardingApi.listDrafts(),
    enabled: !requestedDraftId,
    retry: false,
  });
  const resumeCandidate = newestDraft(draftList.data?.data ?? []);

  const loadDraft = useCallback((draft: OnboardingDraft) => {
    const parsed = onboardingPayloadSchema.safeParse(draft.payload);
    if (!parsed.success) {
      setMessage({ severity: 'error', text: 'O rascunho salvo não pôde ser lido.' });
      return;
    }
    setPayload(parsed.data);
    setDraftId(draft.id);
    setLastSavedSignature(draftSignature(parsed.data));
    setSelectedProperty(null);
    setPhotoSelection(null);
    setPendingPhotoAction(null);
    setRemotePhotoUrl(null);
    setActiveStep(0);
    setFieldErrors({});
    setLoadedDraftId(draft.id);
    setMessage({ severity: 'success', text: 'Rascunho retomado.' });
    if (draft.hasPhoto) {
      onboardingApi
        .getDraftPhotoUrl(draft.id)
        .then((photo) => setRemotePhotoUrl(photo.url))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!requestedDraft.data || loadedDraftId === requestedDraft.data.id) return;
    let active = true;
    const draft = requestedDraft.data;
    queueMicrotask(() => {
      if (active) loadDraft(draft);
    });
    return () => {
      active = false;
    };
  }, [loadDraft, loadedDraftId, requestedDraft.data]);

  useEffect(
    () => () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    },
    [],
  );

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowNavigationRef.current &&
      dirty &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`,
  );

  const persistDraft = useCallback(
    async (nextPayload: OnboardingPayload): Promise<OnboardingDraft> => {
      const saved = draftId
        ? await onboardingApi.updateDraft(draftId, nextPayload)
        : await onboardingApi.createDraft(nextPayload);
      setDraftId(saved.id);
      setLastSavedSignature(draftSignature(nextPayload));
      return saved;
    },
    [draftId],
  );

  const syncDraftPhoto = useCallback(
    async (id: string) => {
      if (!pendingPhotoAction) return;
      if (pendingPhotoAction.kind === 'upload') {
        await onboardingApi.uploadDraftPhoto(id, pendingPhotoAction.file);
      } else {
        await onboardingApi.removeDraftPhoto(id);
      }
      setPendingPhotoAction(null);
    },
    [pendingPhotoAction],
  );

  const persistDraftAndPhoto = useCallback(
    async (nextPayload: OnboardingPayload): Promise<OnboardingDraft> => {
      const saved = await persistDraft(nextPayload);
      await syncDraftPhoto(saved.id);
      return saved;
    },
    [persistDraft, syncDraftPhoto],
  );

  const saveMutation = useMutation({ mutationFn: persistDraftAndPhoto });
  const completeMutation = useMutation({
    mutationFn: async (nextPayload: OnboardingPayload) => {
      const saved = await persistDraftAndPhoto(nextPayload);
      const result = await onboardingApi.completeDraft(saved.id);
      return { result };
    },
  });

  const saveDraft = async () => {
    try {
      await saveMutation.mutateAsync(payload);
      setMessage({ severity: 'success', text: 'Rascunho salvo no servidor.' });
    } catch (error) {
      setMessage({
        severity: 'error',
        text:
          error instanceof ApiError ? error.problem.detail : 'Não foi possível salvar o rascunho.',
      });
      throw error;
    }
  };

  const updatePayload = (next: OnboardingPayload) => {
    setPayload(next);
    setFieldErrors({});
    setCompletionError(null);
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      const result = createTenantSchema.safeParse(payload.personalData);
      if (result.success) {
        setPayload((current) => ({ ...current, personalData: result.data }));
        setFieldErrors({});
        return true;
      }
      setFieldErrors(issuesToFieldErrors(result.error));
      return false;
    }
    if (
      step === 1 &&
      payload.photo &&
      !payload.photo.skipped &&
      !photoSelection &&
      !remotePhotoUrl
    ) {
      setFieldErrors({
        photo: 'Selecione a foto novamente ou marque para adicioná-la depois.',
      });
      return false;
    }
    if (step === 2) {
      const result = referencesSchema.safeParse(payload.references);
      if (result.success) {
        setPayload((current) => ({ ...current, references: result.data }));
        setFieldErrors({});
        return true;
      }
      const errors = issuesToFieldErrors(result.error);
      if (result.error.issues.some((issue) => issue.path.length === 0)) {
        errors.references = 'Informe pelo menos duas referências.';
      }
      setFieldErrors(errors);
      return false;
    }
    if (step === 3 && !payload.propertyUnitId) {
      setFieldErrors({ propertyUnitId: 'Selecione um quarto disponível.' });
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const goNext = () => {
    if (!validateStep(activeStep)) return;
    setActiveStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const complete = async () => {
    const personal = createTenantSchema.safeParse(payload.personalData);
    if (!personal.success) {
      setFieldErrors(issuesToFieldErrors(personal.error));
      setActiveStep(0);
      return;
    }
    const references = referencesSchema.safeParse(payload.references);
    if (!references.success) {
      setFieldErrors(issuesToFieldErrors(references.error));
      setActiveStep(2);
      return;
    }
    if (payload.photo && !payload.photo.skipped && !photoSelection && !remotePhotoUrl) {
      setFieldErrors({
        photo: 'Selecione a foto novamente ou marque para adicioná-la depois.',
      });
      setActiveStep(1);
      return;
    }
    const review = reviewSchema.safeParse({
      propertyUnitId: payload.propertyUnitId,
      moveInDate: payload.moveInDate,
      monthlyBaseValueCents: payload.monthlyBaseValueCents,
    });
    if (!review.success) {
      setFieldErrors(issuesToFieldErrors(review.error));
      return;
    }

    const normalized: OnboardingPayload = {
      ...payload,
      personalData: { ...personal.data, email: personal.data.email.toLowerCase() },
      references: references.data.map((reference) => {
        const email = reference.email?.trim().toLowerCase();
        return { ...reference, email: email === '' ? undefined : email };
      }),
      ...review.data,
    };
    setPayload(normalized);
    setCompletionError(null);
    try {
      const { result } = await completeMutation.mutateAsync(normalized);
      setLastSavedSignature(draftSignature(normalized));
      allowNavigationRef.current = true;
      const contractId = contractIdFrom(result);
      void navigate(contractId ? `/contracts/${contractId}` : '/contracts', { replace: true });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        isUnitOccupancyConflict(error.problem.detail)
      ) {
        setFieldErrors({
          propertyUnitId:
            'Este quarto acabou de ser ocupado. Escolha outra unidade para continuar.',
        });
        setCompletionError('A unidade selecionada não está mais disponível.');
        setSelectedProperty(null);
        setPayload((current) => ({ ...current, propertyUnitId: null }));
        setActiveStep(3);
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setCompletionError(error.problem.detail);
        if (isDuplicateTenantConflict(error.problem.detail)) setActiveStep(0);
        return;
      }
      const detail =
        error instanceof ApiError
          ? error.problem.detail
          : 'Não foi possível concluir o cadastro. O rascunho continua salvo.';
      setCompletionError(detail);
    }
  };

  const selectPhoto = (file: File) => {
    const extensionAccepted = /\.(?:heic|heif)$/i.test(file.name);
    if ((!file.type.startsWith('image/') && !extensionAccepted) || file.size > MAX_PHOTO_BYTES) {
      setMessage({
        severity: 'error',
        text:
          file.size > MAX_PHOTO_BYTES
            ? 'A foto deve ter no máximo 10 MB.'
            : 'Escolha uma imagem JPEG, PNG ou HEIC.',
      });
      return;
    }
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    const previewUrl = URL.createObjectURL(file);
    photoPreviewRef.current = previewUrl;
    const selection: PhotoSelection = {
      file,
      previewUrl,
      metadata: {
        name: file.name,
        type: file.type || 'image/heic',
        size: file.size,
        skipped: false,
      },
    };
    setPhotoSelection(selection);
    setRemotePhotoUrl(null);
    setPendingPhotoAction({ kind: 'upload', file });
    updatePayload({ ...payload, photo: selection.metadata });
  };

  const skipPhoto = () => {
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    photoPreviewRef.current = null;
    setPhotoSelection(null);
    setRemotePhotoUrl(null);
    setPendingPhotoAction({ kind: 'remove' });
    updatePayload({
      ...payload,
      photo: { name: '', type: '', size: 0, skipped: true },
    });
  };

  const leaveAfterSave = async () => {
    try {
      await saveDraft();
      allowNavigationRef.current = true;
      blocker.proceed?.();
    } catch {
      // A mensagem persistente mantém a falha visível e o diálogo aberto.
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <PersonalDataStep
            value={payload.personalData}
            errors={fieldErrors}
            onChange={(personalData) => updatePayload({ ...payload, personalData })}
          />
        );
      case 1:
        return (
          <PhotoStep
            metadata={payload.photo}
            selection={photoSelection}
            remotePhotoUrl={remotePhotoUrl}
            error={fieldErrors.photo}
            onSelect={selectPhoto}
            onSkip={skipPhoto}
          />
        );
      case 2:
        return (
          <ReferencesStep
            value={payload.references}
            errors={fieldErrors}
            onChange={(references) => updatePayload({ ...payload, references })}
          />
        );
      case 3:
        return (
          <RoomSearchStep
            moveInDate={payload.moveInDate}
            selectedId={payload.propertyUnitId}
            error={fieldErrors.propertyUnitId}
            onDateChange={(moveInDate) => updatePayload({ ...payload, moveInDate })}
            onSelect={(property) => {
              setSelectedProperty(property);
              updatePayload({ ...payload, propertyUnitId: property.id });
            }}
          />
        );
      default:
        return (
          <ReviewStep
            payload={payload}
            selectedProperty={selectedProperty}
            photoPreviewUrl={photoSelection?.previewUrl ?? remotePhotoUrl}
            errors={fieldErrors}
            onMoveInDateChange={(moveInDate) => updatePayload({ ...payload, moveInDate })}
            onMonthlyValueChange={(monthlyBaseValueCents) =>
              updatePayload({ ...payload, monthlyBaseValueCents })
            }
            onEdit={setActiveStep}
          />
        );
    }
  };

  if (requestedDraftId && requestedDraft.isPending) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <LinearProgress sx={{ width: 240 }} />
          <Typography color="text.secondary">Abrindo rascunho…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar
          sx={{
            minHeight: { xs: 64, md: 72 },
            borderBottom: `1px solid ${brand.borderCard}`,
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: brand.fontDisplay,
                fontSize: { xs: '1.1rem', md: '1.3rem' },
                fontWeight: 600,
              }}
            >
              Novo contrato mensal
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {draftId
                ? dirty
                  ? 'Alterações ainda não salvas'
                  : 'Rascunho salvo'
                : 'Novo cadastro'}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<SaveOutlinedIcon />}
            disabled={saveMutation.isPending || completeMutation.isPending || !dirty}
            onClick={() => void saveDraft().catch(() => undefined)}
            sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            {saveMutation.isPending ? 'Salvando…' : 'Salvar rascunho'}
          </Button>
          <IconButton aria-label="Fechar cadastro" onClick={() => void navigate('/dashboard')}>
            <CloseOutlinedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Paper square elevation={0} sx={{ borderBottom: `1px solid ${brand.borderCard}` }}>
        <Container maxWidth="lg" sx={{ py: { xs: 1.25, md: 2 } }}>
          {compactStepper ? (
            <Box>
              <Stack direction="row" sx={{ alignItems: 'center', mb: 0.75 }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 700, flex: 1 }}>
                  Etapa {activeStep + 1} de {steps.length}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {steps[activeStep]}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={((activeStep + 1) / steps.length) * 100}
              />
            </Box>
          ) : (
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label} completed={activeStep > steps.indexOf(label)}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}
        </Container>
      </Paper>

      <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
          {resumeCandidate &&
            resumeCandidate.id !== dismissedDraftId &&
            loadedDraftId !== resumeCandidate.id &&
            !dirty && (
              <Alert
                severity="info"
                sx={{ mb: 2.5 }}
                action={
                  <Stack direction="row" spacing={0.5}>
                    <Button color="inherit" size="small" onClick={() => loadDraft(resumeCandidate)}>
                      Retomar
                    </Button>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setDismissedDraftId(resumeCandidate.id)}
                    >
                      Agora não
                    </Button>
                  </Stack>
                }
              >
                Há um rascunho atualizado em {formatDateTime(resumeCandidate.updatedAt)}.
              </Alert>
            )}
          {requestedDraft.isError && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              Não foi possível abrir o rascunho solicitado. Você pode iniciar um novo cadastro.
            </Alert>
          )}
          {completionError && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {completionError}
            </Alert>
          )}
          {renderStep()}
        </Container>
      </Box>

      <Paper
        square
        elevation={4}
        component="footer"
        sx={{ borderTop: `1px solid ${brand.borderCard}`, zIndex: 1 }}
      >
        <Container maxWidth="lg" sx={{ py: 1.25 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Button
              variant="text"
              startIcon={<ArrowBackOutlinedIcon />}
              disabled={activeStep === 0 || completeMutation.isPending}
              onClick={() => {
                setFieldErrors({});
                setActiveStep((step) => Math.max(0, step - 1));
              }}
            >
              Voltar
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              startIcon={<SaveOutlinedIcon />}
              disabled={saveMutation.isPending || completeMutation.isPending || !dirty}
              onClick={() => void saveDraft().catch(() => undefined)}
              sx={{ display: { sm: 'none' } }}
            >
              Salvar
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button endIcon={<ArrowForwardOutlinedIcon />} onClick={goNext}>
                Continuar
              </Button>
            ) : (
              <Button
                startIcon={<CheckOutlinedIcon />}
                disabled={completeMutation.isPending}
                aria-busy={completeMutation.isPending}
                onClick={() => void complete()}
              >
                {completeMutation.isPending ? 'Concluindo…' : 'Concluir cadastro'}
              </Button>
            )}
          </Stack>
        </Container>
      </Paper>

      <Dialog open={blocker.state === 'blocked'} aria-labelledby="leave-onboarding-title">
        <DialogTitle id="leave-onboarding-title">Sair do cadastro?</DialogTitle>
        <DialogContent>
          <Typography>
            Há alterações ainda não salvas. Salve o rascunho para continuar depois neste iPad ou em
            outro dispositivo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => blocker.reset?.()}>
            Continuar preenchendo
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              allowNavigationRef.current = true;
              blocker.proceed?.();
            }}
          >
            Sair sem salvar
          </Button>
          <Button disabled={saveMutation.isPending} onClick={() => void leaveAfterSave()}>
            Salvar e sair
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(message)}
        autoHideDuration={5000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {message ? (
          <Alert severity={message.severity} onClose={() => setMessage(null)} variant="filled">
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
