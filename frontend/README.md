# Tenancy Ledger Frontend

SPA administrativa em React e TypeScript. A API local deve estar em
`http://127.0.0.1:3000`; o Vite encaminha chamadas de `/api` removendo esse prefixo.

```powershell
npm ci
npm run dev
```

O JWT fica apenas no `sessionStorage`. O contrato transitório de tipos está em
`src/api/legacy-contract` e deve ser removido quando `backend/docs/openapi.json` estiver completo.

Comandos de qualidade:

```powershell
npm run format:check
npm run lint:check
npm run typecheck
npm test
npm run test:ci
npm run build
npm run e2e
```
