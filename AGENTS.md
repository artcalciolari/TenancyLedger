# Repository Guidelines

## Project Structure & Module Organization

This npm-workspaces monorepo contains two applications:

- `backend/`: NestJS API. Business capabilities live under `src/contexts/`; shared infrastructure is in `src/core/` and `src/infrastructure/`; TypeORM migrations are in `src/database/migrations/`. Unit tests sit beside source as `*.spec.ts`, while API integration tests are in `backend/test/`.
- `frontend/`: React, Vite, and MUI client. Route-level features live in `src/modules/`, reusable UI in `src/components/`, and app configuration in `src/app/`. Vitest tests use `*.test.ts(x)`; Playwright suites are under `frontend/e2e/`.
- `docs/` holds plans and design notes. Keep generated OpenAPI artifacts synchronized with backend contracts.

## Build, Test, and Development Commands

Run commands from the repository root with Node 24 and npm 11:

- `npm run dev:backend` / `npm run dev:frontend`: start the API or Vite development server.
- `npm run build`: build both workspaces.
- `npm run lint:check && npm run typecheck`: run static validation without rewriting files.
- `npm test`: run Jest and Vitest unit suites.
- `npm run test:ci`: run unit tests with coverage.
- `npm run test:e2e`: run backend E2E plus the Playwright browser/device matrix.
- `npm run api:generate`: regenerate the OpenAPI snapshot and frontend client after API changes.
- From `backend/`, use `docker compose --env-file .env up --build` for the local stack.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, LF endings, single quotes, trailing commas, and a 100-column print width. Prettier and ESLint are authoritative; run `npm run format:check` before submitting. Use PascalCase for React components, classes, and DTOs; camelCase for functions and variables; and kebab-case for general filenames. Follow existing NestJS suffixes such as `.controller.ts`, `.service.ts`, and `.entity.ts`.

## Testing Guidelines

Add tests with every behavior change. Backend Jest thresholds are 98% lines/statements, 95% functions, and 91% branches. Cover domain rules with colocated tests and HTTP/database behavior with E2E tests. Frontend changes should include Vitest coverage and Playwright scenarios for navigation, responsive behavior, or accessibility changes.

## Commit & Pull Request Guidelines

Follow Conventional Commits, for example `fix: preserve frontend edit consistency` or `refactor(frontend): share list filters`. Keep commits focused. Pull requests should explain intent and impact, list validation commands, link issues or plans, and include screenshots for UI changes. Call out migrations, breaking API changes, and regenerated artifacts.

## Security & Configuration

Copy environment values from `backend/.env.example`; never commit `.env`, credentials, tokens, generated logs, or local storage data. Run `npm run security:audit` when changing dependencies.
