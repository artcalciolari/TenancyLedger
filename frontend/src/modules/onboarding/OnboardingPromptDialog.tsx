import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { isIpad } from '../../lib/device/device';
import { hasRole, MANAGEMENT_ROLES } from '../../lib/roles/roles';
import { useAuth } from '../auth/useAuth';

export const PROMPT_DISMISSED_KEY_PREFIX = 'tenancy-ledger:onboarding-prompt-dismissed:v1:';
export const PROMPT_SNOOZED_KEY_PREFIX = 'tenancy-ledger:onboarding-prompt-snoozed:v1:';

/** Safari em modo privado pode lançar ao gravar; a dispensa apenas não persiste. */
function safeRead(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(storage: Storage, key: string): void {
  try {
    storage.setItem(key, String(Date.now()));
  } catch {
    // Sem persistência disponível; o prompt poderá reaparecer.
  }
}

interface OnboardingPromptDialogProps {
  detectIpad?: () => boolean;
}

export function OnboardingPromptDialog({ detectIpad = isIpad }: OnboardingPromptDialogProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    if (!session || !hasRole(session.user.role, MANAGEMENT_ROLES)) return false;
    if (location.pathname === '/onboarding') return false;
    if (!detectIpad()) return false;
    if (safeRead(localStorage, `${PROMPT_DISMISSED_KEY_PREFIX}${session.user.id}`)) return false;
    if (safeRead(sessionStorage, `${PROMPT_SNOOZED_KEY_PREFIX}${session.user.id}`)) return false;
    return true;
  });

  if (!session) return null;
  const userId = session.user.id;

  const snooze = () => {
    safeWrite(sessionStorage, `${PROMPT_SNOOZED_KEY_PREFIX}${userId}`);
    setOpen(false);
  };

  const dismissForever = () => {
    safeWrite(localStorage, `${PROMPT_DISMISSED_KEY_PREFIX}${userId}`);
    setOpen(false);
  };

  const openWizard = () => {
    dismissForever();
    void navigate('/onboarding');
  };

  return (
    <Dialog open={open} onClose={snooze} aria-labelledby="onboarding-prompt-title">
      <DialogTitle id="onboarding-prompt-title">Cadastro assistido</DialogTitle>
      <DialogContent>
        <Typography>
          Deseja abrir o assistente de cadastro guiado? Ele ajuda a registrar prédios, quartos,
          locatários e contratos em poucos passos.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={dismissForever}>
          Não mostrar novamente
        </Button>
        <Button onClick={snooze}>Agora não</Button>
        <Button variant="contained" onClick={openWizard}>
          Abrir assistente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
