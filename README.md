# Tenancy Ledger

[Português](#português) · [English](#english)

Backend de gestão de locações construído como monólito modular com NestJS, PostgreSQL
e armazenamento S3 compatível. O projeto prioriza integridade relacional,
idempotência do faturamento e rastreabilidade de pagamentos.

## Português

### Estado atual

Esta base entrega a fundação do backend, sem frontend:

- autenticação JWT, gestão administrativa de usuários e autorização por papéis
  (`ADMIN`, `MANAGER` e `VIEWER`);
- cadastro e consulta paginada de inquilinos e imóveis;
- criação, consulta e renovação de contratos;
- geração diária e idempotente de faturas por contrato e competência;
- registro idempotente de pagamentos parciais, com aprovação ou rejeição explícita;
- valores monetários representados em centavos inteiros;
- PostgreSQL administrado somente por migrations, sem `synchronize`;
- comprovantes privados no MinIO, validados por conteúdo e acessados por URL temporária;
- healthchecks, métricas Prometheus protegidas, logs estruturados com redação de PII,
  trilha append-only (incluindo auditoria transacional do ledger no banco), rate limit
  e validação das variáveis de ambiente.

A conciliação continua sendo manual e não há portal de inquilino, notificações ou
integração bancária. Esses são candidatos para a próxima etapa junto do frontend.

### Arquitetura

O código segue um monólito modular: cada contexto mantém suas regras e sua
persistência, enquanto infraestrutura transversal fica fora dos contextos.

```text
src/
├── contexts/
│   ├── auth/       # identidade, JWT e autorização
│   ├── tenant/     # dados cadastrais de inquilinos
│   ├── property/   # unidades imobiliárias
│   ├── contract/   # vigência e condições da locação
│   └── invoice/    # faturas, pagamentos e geração agendada
├── core/           # erros e componentes compartilhados
├── database/       # DataSource e migrations TypeORM
└── infrastructure/ # integrações externas, como S3/MinIO
```

As fronteiras são mantidas no código, mas todos os módulos são publicados em um
único processo e usam o mesmo banco. Faturas possuem unicidade por contrato e
competência (`AAAA-MM`), o que torna a repetição segura do job de geração.
Pagamentos usam uma chave idempotente única por fatura; renovações e alterações do
último administrador são serializadas no PostgreSQL para preservar invariantes sob concorrência.

### Requisitos

- Node.js 24 LTS e npm 11;
- Docker com Docker Compose, para a execução completa ou apenas das dependências.

### Início rápido com Docker

```bash
cp .env.example .env
docker compose up --build
```

No PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`. O serviço
`migrate` aplica as migrations depois que o PostgreSQL fica saudável; a API só é
iniciada após PostgreSQL, MinIO e migrations estarem prontos.

Serviços locais:

| Serviço                             | Endereço                             |
| ----------------------------------- | ------------------------------------ |
| API                                 | `http://localhost:3000`              |
| Liveness                            | `http://localhost:3000/health/live`  |
| Readiness (PostgreSQL e MinIO)      | `http://localhost:3000/health/ready` |
| OpenAPI/Swagger                     | `http://localhost:3000/docs`         |
| Métricas (header `x-metrics-token`) | `http://localhost:3000/metrics`      |
| MinIO API                           | `http://localhost:9000`              |
| MinIO Console                       | `http://localhost:9001`              |
| PostgreSQL                          | `localhost:5432`                     |

As portas do Compose são vinculadas somente a `127.0.0.1`. Altere as credenciais
do arquivo `.env` antes de usar um ambiente compartilhado. Para encerrar:

`MINIO_PUBLIC_ENDPOINT` deve apontar para o endereço do storage acessível pelo
navegador; o backend o usa para assinar URLs sem expor o hostname interno do Compose.

```bash
docker compose down
```

Use `docker compose down --volumes` apenas quando quiser apagar permanentemente
os dados locais.

### Execução local da API

```bash
cp .env.example .env
npm ci
docker compose up -d db minio
npm run migration:run
npm run start:dev
```

### Autenticação inicial

Defina `AUTH_BOOTSTRAP_EMAIL` e `AUTH_BOOTSTRAP_PASSWORD` no `.env`. Na primeira
inicialização, o backend cria esse usuário com papel `ADMIN`. As duas variáveis
devem ser fornecidas juntas; a senha deve possuir ao menos 12 caracteres, com
maiúscula, minúscula, número e símbolo.

```bash
curl --request POST http://localhost:3000/auth/login \
  --header "Content-Type: application/json" \
  --data '{"email":"admin@example.com","password":"ChangeMeNow123!"}'
```

Envie o token retornado nas demais chamadas:

```text
Authorization: Bearer <accessToken>
```

O login e o healthcheck são públicos. `/metrics` usa o segredo `METRICS_TOKEN` no
header `x-metrics-token`. As demais rotas exigem JWT e aplicam os papéis necessários.

### Endpoints

| Método  | Rota                                               | Finalidade                          |
| ------- | -------------------------------------------------- | ----------------------------------- |
| `GET`   | `/health` ou `/health/live`                        | Estado do processo da API           |
| `GET`   | `/health/ready`                                    | Estado do PostgreSQL e do MinIO     |
| `POST`  | `/auth/login`                                      | Obter token JWT                     |
| `POST`  | `/auth/users`                                      | Criar usuário (`ADMIN`)             |
| `GET`   | `/auth/users`                                      | Listar usuários (`ADMIN`)           |
| `PATCH` | `/auth/users/:id/access`                           | Alterar papel/atividade             |
| `POST`  | `/auth/change-password`                            | Alterar a própria senha             |
| `POST`  | `/tenants`                                         | Criar inquilino                     |
| `GET`   | `/tenants`                                         | Listar inquilinos com paginação     |
| `GET`   | `/tenants/:id`                                     | Consultar inquilino                 |
| `POST`  | `/properties`                                      | Criar imóvel                        |
| `GET`   | `/properties`                                      | Listar imóveis com paginação        |
| `GET`   | `/properties/:id`                                  | Consultar imóvel                    |
| `POST`  | `/contracts`                                       | Criar contrato                      |
| `GET`   | `/contracts`                                       | Listar contratos                    |
| `GET`   | `/contracts/:id`                                   | Consultar contrato                  |
| `PATCH` | `/contracts/:id/renew`                             | Renovar contrato                    |
| `GET`   | `/invoices`                                        | Listar faturas                      |
| `GET`   | `/invoices/:id`                                    | Consultar fatura e pagamentos       |
| `POST`  | `/invoices/:id/payments`                           | Registrar pagamento                 |
| `PATCH` | `/invoices/:invoiceId/payments/:paymentId/approve` | Aprovar pagamento                   |
| `PATCH` | `/invoices/:invoiceId/payments/:paymentId/reject`  | Rejeitar pagamento                  |
| `GET`   | `/invoices/:invoiceId/payments/:paymentId/proof`   | Obter URL temporária do comprovante |

Consulte `/docs` para esquemas, parâmetros e respostas. Campos monetários usam o
sufixo `Cents` e aceitam somente inteiros; por exemplo, `monthlyBaseValueCents: 150000`
representa R$ 1.500,00.

Pagamentos não realizados em dinheiro usam `multipart/form-data`: envie `amountCents`,
`method`, `proofType` e o arquivo no campo `proof`. São aceitos PDF, JPEG, PNG e WebP
de até 10 MiB; MIME e assinatura binária precisam coincidir. Toda submissão exige o
header `Idempotency-Key` (8 a 128 caracteres ASCII visíveis). Repetir a mesma chave e
o mesmo conteúdo devolve o pagamento existente; reutilizá-la com conteúdo diferente
retorna conflito sem duplicar o registro ou o upload.

### Migrations

Nunca habilite `synchronize` para conveniência. Toda alteração de esquema deve
ser registrada e revisada como migration.

```bash
# Ver migrations e aplicar pendências
npm run migration:show
npm run migration:run

# Gerar migration a partir das entidades
npm run migration:generate -- src/database/migrations/DescribeChange

# Reverter somente a última migration
npm run migration:revert
```

Na imagem compilada, os comandos `migration:*:prod` validam e exigem apenas as
variáveis `DB_*`; segredos de JWT, métricas e storage não precisam ser expostos ao job.

O job diário de faturamento considera apenas contratos ativos e usa
`INVOICE_CRON_TIME_ZONE` e `INVOICE_GENERATION_DAYS_AHEAD`. Pode ser desativado
com `INVOICE_CRON_ENABLED=false`.

### Scripts de desenvolvimento

| Comando                  | Ação                                       |
| ------------------------ | ------------------------------------------ |
| `npm run start:dev`      | Executa a API com recarga automática       |
| `npm run build`          | Compila a aplicação                        |
| `npm run typecheck`      | Verifica tipos sem gerar arquivos          |
| `npm run format:check`   | Verifica formatação Prettier               |
| `npm run lint:check`     | Executa ESLint sem alterar arquivos        |
| `npm test`               | Executa testes unitários                   |
| `npm run test:ci`        | Executa testes unitários com cobertura     |
| `npm run test:e2e:ci`    | Executa testes de integração com cobertura |
| `npm run security:audit` | Audita dependências de produção            |

O workflow de CI usa Node 24 LTS, instala com `npm ci`, executa todas essas validações,
aplica migrations em PostgreSQL real, testa com MinIO e constrói a imagem Docker.
A cobertura é publicada como artefato do workflow.

### Produção

A imagem é multi-stage, contém apenas dependências de produção e executa como o
usuário sem privilégios `node`. Configure segredos reais fora do repositório. Em
`NODE_ENV=production`, o backend exige TLS para PostgreSQL/MinIO, SSE no storage,
segredos JWT/métricas explícitos e rejeita credenciais de desenvolvimento. Habilite
criptografia em repouso no serviço/volume PostgreSQL e no backup. Execute
`npm run migration:run:prod` na imagem compilada como etapa única antes de subir réplicas.
Para uma CA privada ou mTLS do PostgreSQL, monte os PEMs e configure
`DB_SSL_CA_FILE`, `DB_SSL_CERT_FILE` e `DB_SSL_KEY_FILE` (certificado e chave juntos).
O bucket de produção deve existir previamente e suportar SSE-S3 `AES256`; no MinIO,
configure KMS/KES. A API testa `HeadBucket`, escrita criptografada e remoção de um
objeto efêmero durante o startup e falha cedo se a policy ou o SSE estiverem incorretos.
Antes de aceitar uploads de usuários externos, conecte uma etapa de quarentena e
antimalware; a validação atual cobre tamanho, MIME/magic bytes e entrega como anexo.

## English

### Current status

This repository provides the backend foundation; it does not include a frontend:

- JWT authentication, administrative user management, and role-based access
  (`ADMIN`, `MANAGER`, and `VIEWER`);
- tenant and property creation and paginated queries;
- contract creation, queries, and renewal;
- daily, idempotent invoice generation by contract and billing period;
- idempotent partial-payment records with explicit approval or rejection;
- monetary values represented as integer cents;
- PostgreSQL managed only through migrations, with no `synchronize`;
- private proof files in S3-compatible MinIO with content validation and signed URLs;
- healthchecks, protected Prometheus metrics, PII-redacted structured logs,
  append-only audit trails (including transactional database ledger audit), rate limiting,
  and environment validation.

Reconciliation is still manual. There is no tenant portal, notification system, or
bank integration yet. These are natural candidates for the frontend phase.

### Architecture

The application is a modular monolith. Authentication, tenants, properties,
contracts, and invoices are separate contexts inside one NestJS process and one
PostgreSQL database. Cross-cutting code lives under `core`, `database`, and
`infrastructure`. A unique constraint on contract and `YYYY-MM` period makes
invoice generation safe to retry.
Payment submissions use a per-invoice idempotency key, while contract renewal and
last-admin changes are serialized in PostgreSQL to preserve concurrency invariants.

### Requirements and quick start

- Node.js 24 LTS and npm 11;
- Docker with Docker Compose for the full stack or local dependencies.

```bash
cp .env.example .env
docker compose up --build
```

On PowerShell, use `Copy-Item .env.example .env`. The one-shot `migrate` service
runs after PostgreSQL becomes healthy, and the API waits for PostgreSQL, MinIO,
and migrations. The local addresses are listed in the Portuguese service table
above; Compose binds every published port to `127.0.0.1`.

To run the API directly on the host:

```bash
cp .env.example .env
npm ci
docker compose up -d db minio
npm run migration:run
npm run start:dev
```

### Authentication and API

Set `AUTH_BOOTSTRAP_EMAIL` and `AUTH_BOOTSTRAP_PASSWORD` together. At startup, the
application creates the initial `ADMIN`; the password must contain at least 12
characters with upper/lowercase, a number, and a symbol. Call `POST /auth/login`,
then send the returned token as `Authorization: Bearer <accessToken>`. Metrics use
`x-metrics-token`; all business routes require JWT.

The endpoint table, migration commands, and npm scripts above are language-neutral
and apply unchanged. Monetary fields end in `Cents` and accept integers only.
Open `/docs` for the complete OpenAPI schema.
`POST /invoices/:id/payments` also requires an `Idempotency-Key` header (8–128 visible
ASCII characters); retrying the same request returns the existing payment.

### Production notes

The multi-stage image contains production dependencies only and runs as the
unprivileged `node` user. Keep secrets outside the repository. Production startup
requires TLS/SSE and explicit JWT, metrics, database, and MinIO secrets. Enable
database/backup encryption at rest. Apply compiled migrations once before starting
API replicas, and keep schema synchronization disabled.
Set `MINIO_PUBLIC_ENDPOINT` to the HTTPS object-storage address reachable by browsers.
Migration jobs require only `DB_*` settings. Private PostgreSQL CAs and mTLS are supported
through `DB_SSL_CA_FILE`, `DB_SSL_CERT_FILE`, and `DB_SSL_KEY_FILE`. Pre-provision the
production bucket and configure MinIO KMS/KES for SSE-S3; startup verifies encrypted write
and delete capability. Add quarantine/antimalware scanning before enabling public uploads.

## Licença / License

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).

Distributed under the MIT License. See [LICENSE](LICENSE).
