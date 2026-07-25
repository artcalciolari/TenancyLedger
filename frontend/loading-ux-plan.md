# Frontend loading UX improvement plan (reduce flashes and first-load slowness)

## Goal

Keep navigation visually stable and reduce full-page loading flashes while preserving route code splitting.

## Phase 1 — Baseline and target definition

1. Capture current behavior for reference:
   - Cold start after `docker compose up --build`.
   - Navigation between core routes (`/dashboard`, `/contracts`, `/invoices`, `/portfolio`, `/tenants`).
2. Define acceptance criteria:
   - No full-screen blank/spinner swap on most intra-app navigations.
   - Existing content/shell remains visible during refetch when possible.
   - First route visit can show lightweight skeleton/placeholders, not abrupt layout jumps.

## Phase 2 — Route-loading strategy (`lazy` + `Suspense`)

1. Refactor route fallback behavior in `frontend/src/app/router/router.tsx`:
   - Replace generic page-wide `<LoadingState />` fallback with layout-preserving route skeletons.
   - Keep `AppShell` mounted and avoid full content replacement where possible.
2. Introduce route-specific lightweight placeholders:
   - Create shared skeleton primitives under `frontend/src/components/feedback/` (e.g., card/list/table skeletons).
   - Use per-module skeletons matching each page structure.
3. Optional optimization:
   - Prefetch likely-next route chunks on nav hover/focus for primary menu items in `AppShell`.

## Phase 3 — Data-loading strategy (React Query)

1. Replace hard `isPending => <LoadingState />` branches on list/detail pages with progressive states:
   - Show skeleton only for true first load (no prior data).
   - Keep previous data visible during refetch/filter/page transitions.
2. Apply React Query options where appropriate:
   - `placeholderData: keepPreviousData` on paginated/filterable lists.
   - Tune `staleTime` per page to reduce unnecessary rapid reloads.
   - Avoid overly aggressive loading-state resets on key changes.
3. Keep errors explicit:
   - Preserve existing `ProblemAlert` error surfaces.

## Phase 4 — Session restore and auth guards

1. Review `frontend/src/app/router/guards.tsx` + `modules/auth/AuthProvider.tsx`:
   - Minimize visual blocking during brief restore windows.
   - Ensure restore/loading state does not unnecessarily replace already-rendered shell content.
2. Validate that auth redirects still behave correctly (`expired`, `password-changed`, logged-out paths).

## Phase 5 — Perceived performance and network warm-up

1. Preload critical assets:
   - Ensure fonts and critical CSS are not causing avoidable layout flicker.
2. Consider proactive data prefetch:
   - Prefetch dashboard summary + common menu destination data after login/session restore.
3. Confirm static asset caching behavior remains correct in `frontend/nginx.conf`.

## Phase 6 — Validation

1. Run targeted frontend checks:
   - `npm run lint:check --workspace frontend`
   - `npm run typecheck --workspace frontend`
   - `npm run test --workspace frontend`
2. Manual UX pass:
   - Cold compose run and warm run comparison.
   - Desktop + mobile breakpoints.
   - Verify no regressions in permission-gated routes.

## Suggested implementation order (smallest-risk first)

1. Route skeleton fallback primitives.
2. React Query progressive loading on top 3 high-traffic pages (Dashboard, Contracts, Invoices).
3. Extend pattern to remaining modules.
4. Auth/restore smoothing.
5. Optional prefetch enhancements.

## Done criteria

- Navigation no longer exhibits abrupt full-page flash in common flows.
- First-load states feel intentional (skeleton/progressive), not blocking.
- All frontend checks pass and guarded routes keep current behavior.
