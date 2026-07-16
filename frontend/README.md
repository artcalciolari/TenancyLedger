# Tenancy Ledger Frontend

SPA administrativa em React e TypeScript. A API local deve estar em
`http://127.0.0.1:3000`; o Vite encaminha chamadas de `/api` removendo esse prefixo.

A interface cobre autenticação, visão geral agregada, usuários, locatários, imóveis,
prédios, contratos, faturas, revisão manual de pagamentos, exportações CSV e notificações.
As listas usam busca e filtros remotos documentados pela API, sem requisições por tecla.
O tema é claro e fixo, definido pelos tokens de marca em `src/app/theme/theme.ts`,
conforme o redesign documentado em `docs/design/design-handoff-tenancy-ledger-redesign/`.

```powershell
npm ci
npm run dev
```

O JWT de acesso fica apenas no `sessionStorage`. A sessão é renovada por um token opaco em
cookie `HttpOnly`, rotativo e inacessível ao JavaScript; chamadas usam credenciais de mesma
origem e um único refresh coordena respostas `401` concorrentes. Os tipos de API em
`src/api/generated/schema.d.ts` são gerados a partir de `backend/docs/openapi.json`; não
edite o arquivo gerado manualmente.

Para atualizar ou verificar o contrato:

```powershell
npm run api:generate
npm run api:check
```

Comandos de qualidade:

```powershell
npm run format:check
npm run lint:check
npm run typecheck
npm test
npm run test:ci
npm run build
npm run e2e
npm run e2e:visual
npm run storybook
npm run storybook:build
```

`e2e:visual` compara login, dashboard e lista de faturas com baselines versionados em
`e2e/visual/__screenshots__`. Os baselines são Linux/Chromium para coincidir com a CI; em
Windows ou macOS, atualize-os com `mcr.microsoft.com/playwright:v1.61.1-noble`, mantendo a
versão alinhada ao `@playwright/test` fixado no projeto. Isso evita diferenças de rasterização
de fonte entre sistemas operacionais.

O catálogo Storybook documenta cabeçalhos, estados de feedback e status e disponibiliza o painel
do addon de acessibilidade durante o desenvolvimento. Os gates automatizados de WCAG rodam nas
jornadas Playwright. A telemetria do cliente envia somente release, rota normalizada, `requestId`
e fingerprints sanitizados para `/client-errors`; tokens, PII e URLs assinadas não entram no evento.

Os thresholds de cobertura Vitest abrangem o núcleo do cliente (HTTP, sessão, datas, dinheiro e
observabilidade) e componentes com estado crítico, como restauração de sessão e submissão
idempotente. Páginas e jornadas completas são verificadas separadamente pelo Playwright para não
confundir cobertura de linhas com cobertura de comportamento no navegador.

## E2E full-stack

Os testes rápidos de `e2e/` continuam usando mocks e a matriz completa de navegadores. A suíte
real fica em `e2e/integration/`, roda em série e só é registrada quando `E2E_INTEGRATION=1`.
A CI executa essa jornada separadamente em Chromium, Firefox e WebKit. Localmente, a variável
`E2E_FULLSTACK_BROWSER` seleciona um desses motores e usa Chromium quando ela não é informada.

Com PostgreSQL, MinIO e o backend já disponíveis, use um banco exclusivo cujo nome contenha o
segmento `e2e`, aplique as migrations e execute o seed protegido antes do Playwright:

```powershell
$env:NODE_ENV = 'test'
$env:E2E_INTEGRATION = '1'
$env:E2E_FULLSTACK_BROWSER = 'chromium'
$env:DB_DATABASE = 'tenancyledger_local_e2e'
npm run --workspace backend migration:run
npm run --workspace backend test:e2e:seed
npm run dev:backend
# Em outro terminal, com E2E_INTEGRATION=1:
npm run --workspace frontend e2e:integration
```

As demais variáveis de banco, JWT e MinIO seguem `backend/.env.example`. O seed recusa execução
fora de `NODE_ENV=test`, sem a flag explícita ou contra um banco sem `e2e` no nome.
