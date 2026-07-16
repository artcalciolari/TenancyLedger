# Tenancy Ledger

Sistema de gestão de locações organizado como um monorepo npm:

- `backend/`: API NestJS, PostgreSQL e armazenamento S3 compatível;
- `frontend/`: aplicação administrativa React e TypeScript.

O frontend cobre visão geral agregada, usuários, locatários, imóveis, prédios, contratos,
faturas, revisão de pagamentos, exportações e notificações, com autorização por papel.
Consulte o [README do frontend](frontend/README.md) para detalhes e comandos específicos.

## Requisitos

- Node.js 24 LTS e npm 11;
- Docker com Docker Compose para PostgreSQL e MinIO.

## Instalação

```bash
npm ci
```

## Desenvolvimento local

Prepare o ambiente do backend e suba suas dependências:

```powershell
Copy-Item backend/.env.example backend/.env
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d db minio
npm run --workspace backend migration:run
```

Em terminais separados, inicie a API e o frontend:

```bash
npm run dev:backend
npm run dev:frontend
```

A interface fica em `http://localhost:5173`, com proxy `/api` para a API em
`http://localhost:3000`. A documentação Swagger fica em `http://localhost:3000/docs`.

Para executar toda a API em contêineres, consulte o [README do backend](backend/README.md).

Para executar a pilha completa, incluindo o frontend Nginx e o proxy de mesma origem `/api`:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up --build
```

Nesse modo, a aplicação fica em `http://localhost:5173` e a API também continua exposta
diretamente em `http://localhost:3000` para diagnóstico e Swagger.

## Verificações

```bash
npm run format:check
npm run lint:check
npm run typecheck
npm run test:ci
npm run build
npm run storybook:build
```

O E2E full-stack é opt-in e pressupõe a infraestrutura exclusiva de teste já preparada:

```bash
E2E_INTEGRATION=1 npm run test:e2e:integration
```

Consulte o [README do frontend](frontend/README.md#e2e-full-stack) para migrations, seed seguro e
execução local. A CI mantém essa suíte em jobs separados com PostgreSQL e MinIO reais para
Chromium, Firefox e WebKit.

O contrato tipado do frontend é gerado a partir de `backend/docs/openapi.json`:

```bash
npm run api:generate
npm run api:check
```
