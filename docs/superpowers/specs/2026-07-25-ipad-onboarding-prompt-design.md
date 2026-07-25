# iPad Onboarding Prompt — Design

**Date:** 2026-07-25
**Status:** Approved approach A (AppShell dialog + nav item)

## Goal

When a management user (ADMIN or MANAGER) opens the frontend on an iPad and is authenticated, prompt them once to open the onboarding wizard (`/onboarding`). Also add a permanent navigation entry so the wizard is reachable from the UI on any device (the route is currently orphaned — no link points to it).

## Scope decisions (confirmed with user)

- **Device:** iPad only. Detection: `/iPad/` in the user agent OR (`Macintosh` in the user agent AND `navigator.maxTouchPoints > 1`), because iPadOS 13+ Safari reports a desktop Mac user agent. Touch-capable Macs matching the heuristic are an accepted edge case.
- **Frequency:** soft dismissal ("Agora não") hides the prompt for the current browser session only (`sessionStorage`); permanent dismissal requires the explicit "Não mostrar novamente" action (`localStorage`). Prevents accidentally silencing the prompt forever when the user logged in for another task. No backend change.
- **Roles:** ADMIN and MANAGER (`MANAGEMENT_ROLES`), matching the existing `/onboarding` route guard.

## Components

### 1. `frontend/src/lib/device/device.ts`

Pure function:

```ts
export function isIpad(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): boolean
```

Returns `true` for `iPad` UA or `Macintosh` UA with `maxTouchPoints > 1`. Navigator injected for tests. Unit tests in `device.test.ts` cover: classic iPad UA, iPadOS-13+ desktop-mode UA (Macintosh + touch), regular Mac (no touch), Windows/Android UAs.

### 2. `frontend/src/modules/onboarding/OnboardingPromptDialog.tsx`

MUI `Dialog` rendered inside `AppShell` (mounts for both fresh logins and restored sessions). Shows when **all** hold:

- `session` exists and `hasRole(session.user.role, MANAGEMENT_ROLES)`;
- `isIpad()` is true;
- permanent-dismissal `localStorage` key `tenancy-ledger:onboarding-prompt-dismissed:v1:<userId>` is absent;
- soft-dismissal `sessionStorage` key `tenancy-ledger:onboarding-prompt-snoozed:v1:<userId>` is absent;
- current path is not `/onboarding`.

Content (pt-BR, matching app language): title "Cadastro assistido", body inviting the user to open the onboarding wizard. Three actions:

- **"Abrir assistente"** — set the permanent key (goal reached, no need to prompt again), navigate to `/onboarding`.
- **"Agora não"** — set the soft key only, close. Prompt reappears on the next browser session/login.
- **"Não mostrar novamente"** — set the permanent key, close.

Closing via backdrop/Escape behaves like "Agora não" (soft) — accidental closes must never permanently silence the prompt. Storage access wrapped in `try/catch` (private-mode Safari); on failure the prompt simply won't persist dismissal but must not crash.

Component tests cover: renders for admin on iPad, absent for VIEWER, absent when either key present, each action sets the correct key, backdrop close sets only the soft key, "Abrir assistente" navigates.

### 3. Navigation entry in `AppShell.tsx`

Add to the `Cadastros` group of `navigationGroups`:

```ts
{
  label: 'Cadastro assistido',
  to: '/onboarding',
  icon: <AutoFixHighOutlinedIcon />,
  roles: MANAGEMENT_ROLES,
}
```

Plus a `pageMeta` entry: `'/onboarding': { title: 'Cadastro assistido', crumb: 'Cadastros' }`. Existing role filtering in `visibleGroups` handles visibility.

## Data flow

`AppShell` renders `OnboardingPromptDialog`; the dialog reads `useAuth()` session, evaluates `isIpad()` once on mount (`useState` initializer — the device doesn't change mid-session), checks `localStorage`, and manages its own open state. No new context, no backend calls.

## Error handling

- `localStorage`/`sessionStorage` unavailable: prompt still shows, dismissal not persisted, no crash.
- No session / restoring: dialog renders nothing (AppShell already sits behind `RequireAuth`, but the guard is cheap).

## Testing

- Unit: `device.test.ts` (UA matrix).
- Component: `OnboardingPromptDialog.test.tsx` (visibility matrix + actions), navigation entry visibility via existing AppShell patterns if practical.
- No e2e addition: Playwright device emulation of the iPadOS desktop-mode UA is possible but the logic is fully covered at unit/component level (YAGNI).

## Out of scope

- Backend persistence of dismissal.
- Android/other tablet detection.
- Any change to the wizard itself.
