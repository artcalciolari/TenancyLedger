# iPad Onboarding Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prompt ADMIN/MANAGER users on iPad, once per session (with an explicit permanent opt-out), to open the onboarding wizard, and add a permanent nav entry to `/onboarding`.

**Architecture:** A pure `isIpad()` detector in `lib/device`, a self-contained `OnboardingPromptDialog` (MUI Dialog) mounted inside `AppShell` that reads `useAuth()` and browser storage, and a new `navigationGroups` item + `pageMeta` entry in `AppShell.tsx`. No backend changes.

**Tech Stack:** React 19, TypeScript, MUI, react-router 7, Vitest + Testing Library (jsdom). Spec: `docs/superpowers/specs/2026-07-25-ipad-onboarding-prompt-design.md`.

## Global Constraints

- All user-facing copy in pt-BR. Titles/labels used verbatim below: "Cadastro assistido", "Abrir assistente", "Agora não", "Não mostrar novamente".
- Roles gate: `MANAGEMENT_ROLES` (`['ADMIN', 'MANAGER']`) from `frontend/src/lib/roles/roles.ts`.
- Storage keys (verbatim): permanent `tenancy-ledger:onboarding-prompt-dismissed:v1:<userId>` (localStorage), soft `tenancy-ledger:onboarding-prompt-snoozed:v1:<userId>` (sessionStorage).
- Backdrop/Escape close = soft dismiss. Accidental close must never permanently silence the prompt.
- All storage access wrapped in try/catch — Safari private mode must not crash the app.
- Run all commands from `frontend/`. Tests: `npm test -- <file>`. Also run `npm run typecheck` and `npm run lint:check` before each commit.

---

### Task 1: `isIpad` device detector

**Files:**
- Create: `frontend/src/lib/device/device.ts`
- Test: `frontend/src/lib/device/device.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isIpad(nav?: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean` — default argument is the global `navigator`. Task 2 imports it from `../../lib/device/device`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/device/device.test.ts
import { describe, expect, it } from 'vitest';
import { isIpad } from './device';

const nav = (userAgent: string, maxTouchPoints: number) => ({ userAgent, maxTouchPoints });

const classicIpadUa =
  'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1';
const desktopModeIpadUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const windowsUa =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const androidTabletUa =
  'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

describe('isIpad', () => {
  it('reconhece iPad clássico pelo user agent', () => {
    expect(isIpad(nav(classicIpadUa, 5))).toBe(true);
  });

  it('reconhece iPadOS 13+ em modo desktop (Macintosh + toque)', () => {
    expect(isIpad(nav(desktopModeIpadUa, 5))).toBe(true);
  });

  it('não considera Mac sem toque', () => {
    expect(isIpad(nav(desktopModeIpadUa, 0))).toBe(false);
  });

  it('não considera Windows nem tablet Android', () => {
    expect(isIpad(nav(windowsUa, 10))).toBe(false);
    expect(isIpad(nav(androidTabletUa, 5))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/device/device.test.ts`
Expected: FAIL — cannot resolve `./device`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/device/device.ts
/**
 * iPadOS 13+ no Safari se identifica como Mac desktop; o toque diferencia.
 * Macs com tela de toque são um falso positivo aceito (spec 2026-07-25).
 */
export function isIpad(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): boolean {
  if (/iPad/.test(nav.userAgent)) return true;
  return /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/device/device.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint:check
git add src/lib/device/device.ts src/lib/device/device.test.ts
git commit -m "feat(frontend): add iPad device detection helper"
```

---

### Task 2: `OnboardingPromptDialog` component

**Files:**
- Create: `frontend/src/modules/onboarding/OnboardingPromptDialog.tsx`
- Test: `frontend/src/modules/onboarding/OnboardingPromptDialog.test.tsx`

**Interfaces:**
- Consumes: `isIpad` from `../../lib/device/device` (Task 1); `useAuth` from `../auth/useAuth`; `hasRole`, `MANAGEMENT_ROLES` from `../../lib/roles/roles`.
- Produces: `OnboardingPromptDialog({ detectIpad?: () => boolean })` — named export, no required props. `detectIpad` defaults to `isIpad` and exists for test injection. Task 3 renders `<OnboardingPromptDialog />` inside `AppShell`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/modules/onboarding/OnboardingPromptDialog.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../../api/contract';
import type { AuthSession } from '../../lib/auth/session';
import { AuthContext } from '../auth/AuthContext';
import {
  OnboardingPromptDialog,
  PROMPT_DISMISSED_KEY_PREFIX,
  PROMPT_SNOOZED_KEY_PREFIX,
} from './OnboardingPromptDialog';

const userId = 'a1111111-1111-4111-8111-111111111111';
const dismissedKey = `${PROMPT_DISMISSED_KEY_PREFIX}${userId}`;
const snoozedKey = `${PROMPT_SNOOZED_KEY_PREFIX}${userId}`;

function makeSession(role: UserRole): AuthSession {
  return {
    accessToken: 'token',
    user: { id: userId, email: 'admin@example.com', active: true, role },
  };
}

function renderPrompt({ role = 'ADMIN' as UserRole, detectIpad = () => true } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <OnboardingPromptDialog detectIpad={detectIpad} /> },
      { path: '/onboarding', element: <div>Assistente</div> },
    ],
    { initialEntries: ['/dashboard'] },
  );
  render(
    <AuthContext.Provider
      value={{
        session: makeSession(role),
        reason: null,
        restoring: false,
        startSession: vi.fn(),
        endSession: vi.fn(),
      }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return router;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('OnboardingPromptDialog', () => {
  it('aparece para ADMIN em iPad', async () => {
    renderPrompt();
    expect(await screen.findByRole('dialog', { name: 'Cadastro assistido' })).toBeVisible();
  });

  it('não aparece para VIEWER', () => {
    renderPrompt({ role: 'VIEWER' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não aparece fora do iPad', () => {
    renderPrompt({ detectIpad: () => false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não aparece com dispensa permanente registrada', () => {
    localStorage.setItem(dismissedKey, String(Date.now()));
    renderPrompt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não aparece com adiamento na sessão atual', () => {
    sessionStorage.setItem(snoozedKey, String(Date.now()));
    renderPrompt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Agora não" adia apenas na sessão', async () => {
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sessionStorage.getItem(snoozedKey)).not.toBeNull();
    expect(localStorage.getItem(dismissedKey)).toBeNull();
  });

  it('"Não mostrar novamente" dispensa permanentemente', async () => {
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Não mostrar novamente' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(localStorage.getItem(dismissedKey)).not.toBeNull();
  });

  it('fechar com Escape apenas adia', async () => {
    renderPrompt();
    await screen.findByRole('dialog', { name: 'Cadastro assistido' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sessionStorage.getItem(snoozedKey)).not.toBeNull();
    expect(localStorage.getItem(dismissedKey)).toBeNull();
  });

  it('"Abrir assistente" navega e dispensa permanentemente', async () => {
    const router = renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir assistente' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(localStorage.getItem(dismissedKey)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/modules/onboarding/OnboardingPromptDialog.test.tsx`
Expected: FAIL — cannot resolve `./OnboardingPromptDialog`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/modules/onboarding/OnboardingPromptDialog.tsx
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/modules/onboarding/OnboardingPromptDialog.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npm run typecheck && npm run lint:check
git add src/modules/onboarding/OnboardingPromptDialog.tsx src/modules/onboarding/OnboardingPromptDialog.test.tsx
git commit -m "feat(frontend): add onboarding wizard prompt dialog for iPad"
```

---

### Task 3: AppShell integration — nav entry + dialog mount

**Files:**
- Modify: `frontend/src/layouts/AppShell.tsx` (imports ~lines 1–34, `navigationGroups` "Cadastros" group ~lines 74–86, `pageMeta` ~lines 100–116, JSX before closing root `</Box>` ~line 538)

**Interfaces:**
- Consumes: `OnboardingPromptDialog` from `../modules/onboarding/OnboardingPromptDialog` (Task 2).
- Produces: nav item "Cadastro assistido" → `/onboarding` visible to ADMIN/MANAGER; dialog mounted app-wide.

- [ ] **Step 1: Add imports**

In `AppShell.tsx`, alongside the other `@mui/icons-material` imports (alphabetical order):

```tsx
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
```

Alongside the module imports:

```tsx
import { OnboardingPromptDialog } from '../modules/onboarding/OnboardingPromptDialog';
```

- [ ] **Step 2: Add nav item and page meta**

In the `Cadastros` group of `navigationGroups`, after the "Prédios e quartos" item:

```tsx
{
  label: 'Cadastro assistido',
  to: '/onboarding',
  icon: <AutoFixHighOutlinedIcon />,
  roles: MANAGEMENT_ROLES,
},
```

In `pageMeta`, after the `'/portfolio'` entry:

```ts
'/onboarding': { title: 'Cadastro assistido', crumb: 'Cadastros' },
```

- [ ] **Step 3: Mount the dialog**

In the `AppShell` return JSX, immediately before the closing tag of the root `<Box>` (after the `<Box component="main">…<Outlet /></Box>` block):

```tsx
<OnboardingPromptDialog />
```

- [ ] **Step 4: Verify full suite, typecheck, lint**

Run: `npm test && npm run typecheck && npm run lint:check`
Expected: all pass. The dialog is inert in existing tests (jsdom UA is not iPad, so `isIpad()` is false).

- [ ] **Step 5: Commit**

```bash
git add src/layouts/AppShell.tsx
git commit -m "feat(frontend): surface onboarding wizard via nav entry and iPad prompt"
```
