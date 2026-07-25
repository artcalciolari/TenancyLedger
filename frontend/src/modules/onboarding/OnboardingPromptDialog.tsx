import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { brand } from '../../app/theme/theme';
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
    // Sem persistência disponível; o convite poderá reaparecer.
  }
}

interface OnboardingPromptProps {
  detectIpad?: () => boolean;
}

/**
 * Convite não bloqueante para o cadastro assistido. O acesso permanente continua
 * sendo o item "Cadastro assistido" do menu lateral; aqui só destacamos a opção
 * para quem opera em iPad, sem esconder o painel atrás de um diálogo modal.
 */
export function OnboardingPromptDialog({ detectIpad = isIpad }: OnboardingPromptProps) {
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

  if (!session || !open) return null;
  const userId = session.user.id;

  const snooze = () => {
    safeWrite(sessionStorage, `${PROMPT_SNOOZED_KEY_PREFIX}${userId}`);
    setOpen(false);
  };

  const dismissForever = () => {
    safeWrite(localStorage, `${PROMPT_DISMISSED_KEY_PREFIX}${userId}`);
    setOpen(false);
  };

  // Abrir o assistente não é uma recusa: apenas adia até a próxima sessão.
  const openWizard = () => {
    snooze();
    void navigate('/onboarding', {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  return (
    <Paper
      variant="outlined"
      role="region"
      aria-labelledby="onboarding-prompt-title"
      sx={{
        mb: 2.5,
        p: 2,
        borderColor: brand.borderInput,
        bgcolor: brand.accentTint,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            flexShrink: 0,
            bgcolor: 'background.paper',
            color: brand.accentDark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AutoFixHighOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id="onboarding-prompt-title"
            component="h2"
            sx={{ fontSize: '0.98rem', fontWeight: 700, color: brand.textPrimary }}
          >
            Cadastro assistido
          </Typography>
          <Typography sx={{ fontSize: '0.86rem', color: brand.textSecondary }}>
            Registre prédios, quartos, locatários e contratos em poucos passos.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ mt: 1.5, alignItems: { sm: 'center' } }}
          >
            <Button variant="contained" onClick={openWizard}>
              Abrir assistente
            </Button>
            <Button color="inherit" onClick={snooze}>
              Agora não
            </Button>
            <Button color="inherit" onClick={dismissForever}>
              Não mostrar novamente
            </Button>
          </Stack>
        </Box>
        <IconButton aria-label="Dispensar convite" onClick={snooze} sx={{ flexShrink: 0 }}>
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
}
