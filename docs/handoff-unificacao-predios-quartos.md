# Handoff — Unificação de prédios e quartos (U1–U4)

> **Modelo executor sugerido:** Claude Sonnet 5 (ou superior). O corte U1 é um breaking change
> cross-stack (banco + domínio + API + frontend no mesmo ticket); não delegar a modelos menores
> que Sonnet.
>
> **Nível de raciocínio (thinking) mínimo por etapa** — para economizar cota, usar o menor
> nível que ainda é seguro; subir um degrau apenas se a etapa travar ou produzir migration/SQL
> errado na primeira tentativa:
>
> | Etapa | Mínimo | Justificativa |
> | --- | --- | --- |
> | U1 §5.1–5.2 (migration + domínio) | **medium** | SQL manual, GiST, ciclo `run → revert → run`; erro aqui contamina tudo |
> | U1 §5.3–5.5 (API, DTOs, frontend mínimo) | low | Renomeações mecânicas guiadas por typecheck/testes |
> | U2 (/portfolio) | low | UI nova, mas padrões prontos (filtros na URL, tema Livro-Razão) |
> | U3 (relabeling + descrição) | low | Varredura textual + 1 função central |
> | U4 (validação integral) | **medium** | Testes de concorrência GiST, baselines visuais, triagem de falhas E2E |
>
> Regras de economia de cota: rodar `npm run typecheck` cedo e deixar o compilador listar os
> renames pendentes em vez de raciocinar sobre eles; nas varreduras usar os greps da seção 10
> em vez de reler arquivos; não reler arquivos gerados (`openapi.json`, `schema.d.ts`); commits
> internos frequentes para nunca repetir trabalho após falha.
>
> **Fontes de verdade** (leia antes de codar, nesta ordem):
> 1. `docs/plano-unificacao-predios-quartos.md` — comportamento de produto.
> 2. `docs/Plano técnico integrado — unificação de prédios e quartos.md` — sequência e fronteiras técnicas.
> 3. Este arquivo — mapa concreto de código, checklists e armadilhas.
>
> Em conflito entre este handoff e os planos, os planos vencem — mas os caminhos de arquivo e
> nomes de constraint aqui foram verificados no código em 2026-07-20.

---

## 1. Missão em uma frase

Substituir o domínio genérico "imóvel/unidade" (`PropertyUnit`, `UnitType`, `property_units`,
`/properties`) pelo conceito **Quarto** (`Room`, `rooms`, `/rooms`), sempre vinculado a um
**Prédio**, com experiência unificada em `/portfolio`, **sem compatibilidade retroativa** e com
**reset deliberado dos dados locais**.

## 2. Estado atual (verificado no código)

### 2.1 Pré-requisitos já entregues — NÃO refazer

Os quatro fixups do MVP iPad já estão no `main` (branch atual: `agent/fix-user-invoice-invariants`):

| Fixup | Evidência no código |
| --- | --- |
| F1 — Ativação de contrato só com 1ª fatura `PAID` | `backend/src/contexts/contract/` + `backend/src/contexts/invoice/billing.service.ts` |
| F2 — Foto no draft de onboarding | migration `1783942200000-OnboardingDraftPhoto.ts`; coluna `photo_storage_key` em `onboarding_drafts` |
| F3 — Documento `GENERATED` versionado | `backend/src/contexts/contract/application/contract-documents.service.ts` |
| F4 — Atenção de renovação | migration `1783942100000-AddRenewalNotifications.ts`; campo `renewalAttention` em contratos |

Semântica desses quatro **não muda** durante a unificação. Só nomes vizinhos
(`propertyUnitId` → `roomId`) são adaptados.

### 2.2 Modelo atual que será substituído

`backend/src/contexts/property/domain/property-unit.entity.ts`:

- Tabela `property_units`: `id`, `neighborhood` (varchar 120), `type` (enum `property_unit_type`
  com `KITNET|ROOM|APARTMENT|HOUSE|COMMERCIAL`), `unit_number` (varchar 40),
  `building_id` (uuid **nullable** — unidade avulsa é permitida hoje), `created_at`.
- Índices únicos (criados por migration, marcados `synchronize: false` na entidade):
  `UQ_property_units_building_unit_ci` e `UQ_property_units_location_ci`.
- Checks: `CHK_property_units_neighborhood_not_blank`, `CHK_property_units_unit_number_not_blank`.

`backend/src/contexts/property/domain/building.entity.ts` — **permanece como está**:
tabela `buildings` com `name` (único CI: `UQ_buildings_name_ci`), `neighborhood`, `address`
(nullable), `created_at`. Prédio é a fonte de bairro/endereço no modelo novo.

`backend/src/contexts/contract/domain/entities/contract.entity.ts`:

- Coluna `property_unit_id` (uuid, NOT NULL), índice `IDX_contracts_property_unit_id`.
- Exclusão GiST `EX_contracts_no_overlapping_period` (última versão definida em
  `1783930301000-ContractLifecycle.ts`):
  ```sql
  EXCLUDE USING gist (
    "property_unit_id" WITH =,
    daterange("move_in_date", COALESCE("end_date", 'infinity'::date), '[]') WITH &&
  ) WHERE ("status" NOT IN ('TERMINATED'::"contract_status", 'CANCELLED'::"contract_status"))
  ```
- Extensão `btree_gist` já criada (`1783898802000-IntegrityConstraints.ts`).

Descrição documental atual — `backend/src/contexts/property/domain/property-unit.description.ts`:

```ts
export function describePropertyUnit(property: PropertyUnit): string {
  return `${property.type} ${property.unitNumber} — ${property.neighborhood}`;
}
```

Consumidores: `contract-documents.service.ts` (linhas ~62 e ~113) e
`receipt-issuer.service.ts` (~61). Este é o **ponto único** de descrição; será trocado em U3.

### 2.3 Superfície de contaminação

`propertyUnit|property_unit|PropertyUnit` aparece em **~474 ocorrências / 85 arquivos**.
Principais bolsões:

- Backend: contexts `property`, `contract`, `onboarding`, `invoice`, `receipt`, `dashboard`;
  migrations; `backend/test/app.e2e-spec.ts`; `backend/test/fixtures/seed-fullstack-e2e.ts`;
  `backend/docs/openapi.json` (gerado).
- Frontend: `src/modules/{properties,contracts,invoices,onboarding,dashboard}`;
  `src/api/contract.ts`; `src/api/generated/schema.d.ts` (gerado); `e2e/**` (onboarding,
  contracts, integration, accessibility, ipad, visual).

### 2.4 Rotas atuais

Backend:

- `PropertyController` (`@Controller('properties')`, tag `Imóveis`):
  `POST /properties`, `PATCH /properties/:id`, `GET /properties`,
  `GET /properties/available` (usado pelo onboarding/novo contrato), `GET /properties/:id`.
- `BuildingController` (`backend/src/contexts/property/building.controller.ts`):
  `POST /buildings`, `PATCH /buildings/:id`, `GET /buildings`, `GET /buildings/:id`.

Frontend (`frontend/src/app/router/router.tsx`): rotas `/properties`, `/properties/new`,
`/properties/:propertyId`, `/buildings`, `/buildings/new`, `/buildings/:buildingId`.
Sidebar em `frontend/src/layouts/AppShell.tsx` (~linha 78): entradas separadas
"Imóveis" e "Prédios"; mapa de títulos/breadcrumbs nas linhas ~104–125.

---

## 3. Decisões de produto (fechadas — não reabrir)

| Tema | Decisão |
| --- | --- |
| Conceito locável | `Room` substitui integralmente unidade; **sempre** pertence a um prédio (vínculo imutável) |
| Campos do quarto | `id`, `buildingId` (NOT NULL), `number`, `createdAt`. **Sem** tipo, **sem** bairro próprio |
| Unicidade | `number` único **case-insensitive dentro do prédio**; números iguais em prédios diferentes OK |
| Descrição documental | `Quarto {número} — {nome do prédio}, {bairro}` (endereço fora, pois é opcional) |
| Onboarding/novo contrato | Seleção por data + prédio opcional + busca textual; listar **apenas quartos vagos** |
| Dashboard | `byProperty` vira `byRoom`; remover agrupamento de unidades sem prédio |
| Vacância | `(vagos / total) × 100`, 1 casa decimal; prédio sem quartos → percentual `null` |
| Ocupação | Data civil em `America/Sao_Paulo`; contratos vigentes contam; `CANCELLED`/`TERMINATED` ignorados |
| Compatibilidade | **Nenhuma.** Sem alias `/properties`, sem DTO duplicado, sem backfill de drafts/documentos |
| Dados locais | Descartáveis. Reset de volumes PostgreSQL + MinIO com confirmação humana explícita |

---

## 4. Sequência de entrega

```
U1 (núcleo atômico) → U2 (/portfolio) → U3 (relabeling + descrição) → U4 (validação integral)
```

Estritamente sequencial — OpenAPI/cliente gerado são regenerados em cada etapa e conflitam se
paralelizar. Cada etapa só começa com a anterior verde em todos os gates (seção 9).

---

## 5. U1 — Núcleo Room atômico

Um ticket, um contrato novo íntegro de ponta a ponta. Commits internos ordenados são bem-vindos,
mas nada de estado intermediário "meio migrado" no fim do ticket.

### 5.1 Banco (migration manual)

Criar `backend/src/database/migrations/<timestamp>-UnifyRoomsDomain.ts` com timestamp **maior**
que `1783942200000` (última atual). Estilo do repositório: SQL manual via `queryRunner.query`,
com `up` e `down` completos (o gate exige `run → revert → run`).

No `up`:

1. `property_units` → `rooms`: pode ser `CREATE TABLE` nova + `DROP` da antiga (dados são
   descartáveis; não precisa preservar linhas), ou rename + alterações. Preferir criar limpa:
   - `id` uuid PK default gerado, `building_id` uuid NOT NULL FK → `buildings(id)`
     (RESTRICT), `number` varchar(40) NOT NULL, `created_at` timestamptz.
   - Check `CHK_rooms_number_not_blank` (`char_length(trim(number)) > 0`).
   - Único CI por prédio: `CREATE UNIQUE INDEX "UQ_rooms_building_number_ci" ON "rooms" ("building_id", lower("number"))`.
   - Índice de FK para joins/busca.
2. Dropar enum `property_unit_type` e os índices/checks antigos (`UQ_property_units_*`,
   `CHK_property_units_*`).
3. `contracts`: dropar `EX_contracts_no_overlapping_period` e `IDX_contracts_property_unit_id`,
   renomear/recriar coluna como `room_id` com FK para `rooms`, recriar índice
   (`IDX_contracts_room_id`) e a exclusão GiST **idêntica em semântica**, trocando apenas
   `property_unit_id` por `room_id` (manter o `WHERE status NOT IN ('TERMINATED','CANCELLED')`
   e o `COALESCE(end_date, 'infinity')`).
4. Varrer as demais tabelas que referenciam a unidade (receipts, notificações etc. — conferir
   com `grep -r property_unit backend/src/database/migrations backend/src/contexts`) e renomear
   colunas/FKs/índices para `room_id`.

Como contratos existentes apontam para unidades que deixarão de existir, a migration **assume
banco vazio** (pós-reset). Validar exatamente assim: reset → todas as migrations → revert da
última → run de novo. **Nunca** truncar/derrubar dados dentro da migration ou do bootstrap —
o reset é manual (seção 8).

### 5.2 Domínio backend

Em `backend/src/contexts/property/` (o diretório pode ser renomeado depois; o essencial é o
conteúdo):

- `room.entity.ts` substitui `property-unit.entity.ts`. Seguir o padrão das entidades atuais:
  construtor privado, `static create(buildingId, number)`, normalização
  `trim().replace(/\s+/g, ' ')`, `ValidationError` com mensagens em pt-BR, índices de migration
  com `synchronize: false`. `buildingId` obrigatório e imutável (sem setter; `update` só aceita
  `number`). Remover `UnitType` e `UpdatePropertyUnitFields`.
- Apagar `property-unit.entity.ts`, `property-unit.entity.spec.ts` e adaptar
  `property-unit.description.ts` → `room-description.ts` **mantendo por ora o formato de saída
  compatível com o novo modelo** (ex.: `Quarto {number} — {neighborhood do prédio}`); o formato
  canônico final entra em U3. Atenção: a função nova precisa receber prédio (ou dados dele),
  pois o quarto não tem mais bairro próprio — mude a assinatura já em U1 para
  `(room, building)` e centralize os 3 call sites (`contract-documents.service.ts` ×2,
  `receipt-issuer.service.ts` ×1).
- Repositórios: `property.repository.ts`/`property.typeorm.repository.ts` →
  `room.repository.ts`/`room.typeorm.repository.ts`. A busca de `GET /rooms` (parâmetro `q`)
  cobre: número do quarto, nome do prédio, bairro do prédio, endereço do prédio (join com
  `buildings`, `ILIKE`).
- Disponibilidade: portar a lógica de `listAvailable` (hoje em `property.service.ts`) para
  filtro `status=VACANT|OCCUPIED` + `date` em `GET /rooms`. Ocupado na data D = existe contrato
  com `room_id`, `status NOT IN (TERMINATED, CANCELLED)` e
  `daterange(move_in_date, COALESCE(end_date,'infinity'), '[]') @> D`. Data civil default: hoje
  em `America/Sao_Paulo` (há utilitário/convenção no código atual de `listAvailable` — reusar).

### 5.3 API backend

- `PropertyController` → `RoomController` (`@Controller('rooms')`, tag `Quartos`):
  - `POST /rooms` — body `{ buildingId: uuid, number: string(1..40) }`.
  - `PATCH /rooms/:id` — só `number`; `buildingId` presente no body → 422 (padrão atual de
    campo imutável já existe no `UpdatePropertyDto`, replicar abordagem).
  - `GET /rooms` — `q`, `buildingId`, `status=VACANT|OCCUPIED`, `date`, `page`, `limit`
    (padrões atuais: page 1, limit 20, max 100).
  - `GET /rooms/:id`.
  - Remover `GET /properties/available` (o caso de uso vira `GET /rooms?status=VACANT&date=...`).
- `BuildingController` expandido:
  - `GET /buildings` ganha `q` (nome, bairro, endereço), `date`,
    `vacancy=WITH_VACANCY|FULL|NO_ROOMS`, paginação.
  - Respostas com `totalRooms`, `occupiedRooms`, `vacantRooms`, `vacancyPercentage`
    (1 casa decimal, `null` se `totalRooms === 0`); detalhe inclui `rooms`.
- DTOs de resposta dos demais contexts: renomear `propertyUnitId`/`propertyUnit*` para
  `roomId`/`room*` em contract, invoice/billing, receipt, dashboard (`byProperty` → `byRoom`,
  `propertyUnitCount` → `roomCount` ou equivalente), onboarding, auditoria e CSVs. Mensagens de
  erro em pt-BR passam de "unidade imobiliária" para "quarto".
- Manter ordem de locks `invoice → contract` onde existir (fixup F1) — só renomear campos.

### 5.4 OpenAPI + cliente

```
npm run api:generate    # regenera backend/docs/openapi.json + frontend/src/api/generated
npm run api:check       # deve passar limpo
```

Nunca editar `backend/docs/openapi.json` ou `frontend/src/api/generated/schema.d.ts` à mão.

### 5.5 Frontend — adaptação mínima (não é o redesign)

Objetivo de U1 no frontend: **compilar e funcionar com o contrato novo**, sem UX nova.

- `src/modules/properties/api.ts|schemas.ts` → apontar para `/rooms` com campos novos
  (renomear módulo para `rooms/` já em U1 é aceitável; a página nova fica para U2).
- Formulários de quarto: só prédio (obrigatório) + número. Remover campo tipo/bairro.
- Onboarding (`src/modules/onboarding/`): seleção de quarto disponível usa
  `GET /rooms?status=VACANT&date=...&buildingId=...&q=...`; renomear `propertyUnitId` →
  `roomId` em `state.ts`, `schemas.ts`, `types.ts`, `steps/ReviewStep.tsx`, payload do draft.
  Drafts antigos morrem com o reset — sem migração de payload.
- Contratos, faturas, recibos, dashboard: renomear campos consumidos
  (`src/api/contract.ts`, `src/modules/contracts/*`, `src/modules/invoices/*`,
  `src/modules/dashboard/DashboardPage.tsx` com `byRoom`).
- `src/api/query-keys.ts` e `edit-cache-invalidation.ts`: renomear chaves de cache.
- Testes unitários (Vitest/Jest) adaptados no mesmo ticket. E2E Playwright podem ficar
  vermelhos até U2/U4 **somente** se o plano de PR deixar isso explícito; unitários não.

### 5.6 Definition of done de U1

- Gates da seção 9 verdes (unitários; E2E conforme recorte declarado).
- `GET /rooms`/`POST /rooms` funcionando ponta a ponta com frontend.
- Zero referência a `/properties` no código de produção (testes E2E antigos podem aguardar U4
  apenas se explicitado).

---

## 6. U2 — Experiência `/portfolio`

- Nova rota `/portfolio` com abas **Prédios** (inicial) e **Quartos**.
- `/buildings` (lista) passa a redirecionar para `/portfolio` (aba Prédios); manter
  `/buildings/new`, `/buildings/:buildingId`, e criar `/rooms/new`, `/rooms/:roomId`.
  Remover rotas `/properties*` do router e o item "Imóveis" da sidebar; a entrada única vira
  **"Prédios e quartos"** → `/portfolio` (`AppShell.tsx`: array de navegação ~linha 78 e mapa
  de títulos ~104–125).
- Aba Prédios: busca (nome/bairro/endereço), data de referência (default hoje em
  `America/Sao_Paulo`), filtros `com vagas | lotado | sem quartos`, ordenação por maior
  vacância e depois nome, cartão/linha com total/ocupados/vagos/percentual.
- Aba Quartos: busca (número/prédio/bairro/endereço), filtros prédio + data + situação;
  resultado mostra prédio, quarto, localização e situação na data.
- **Persistir aba, filtros, data e paginação na URL** (padrão já existe:
  `frontend/src/modules/contracts/filters.ts` e o refactor "share list filters" — reusar).
- Detalhe do prédio: resumo de vacância, filtro dos quartos, botão **Adicionar quarto** →
  `/rooms/new?buildingId=...`.
- Visual: seguir a direção **Livro-Razão** (tokens em `frontend/src/app/theme/theme.ts` —
  `brand.razao`, `brand.latao`, Fraunces/Archivo), **não** o handoff antigo de `docs/design/`.

---

## 7. U3 — Relabeling e documentos

- Descrição documental canônica: `Quarto {número} — {nome do prédio}, {bairro}` no construtor
  único (`room-description.ts`). Aplicar em prévia, versão armazenada (`GENERATED`) e recibo.
  Endereço nunca entra (é opcional).
- Varredura de linguagem em UI, PDFs, CSVs, e-mails/notificações, mensagens de erro e OpenAPI:
  eliminar "imóvel", "unidade", "tipo de unidade"; usar só "prédio" e "quarto".
  Arquivo `frontend/src/modules/properties/labels.ts` morre aqui se ainda existir.
- Dashboard: rótulos e agrupamentos finais por quarto; sem agrupamento "sem prédio".

---

## 8. Runbook de reset (executar antes de rodar a migration de U1 localmente)

⚠️ **Destrutivo e manual — exige confirmação humana explícita. Jamais automatizar em script,
migration ou bootstrap.**

```bash
cd backend
docker compose --env-file .env down -v     # apaga volumes postgres_data e minio_data
docker compose --env-file .env up --build  # sobe stack, roda migrations, bootstrap recria admin
```

Perde-se: todos os dados, documentos do MinIO, drafts. Isso é esperado e aprovado nas premissas.

---

## 9. Gates de validação (rodar da raiz; obrigatórios em cada etapa)

```bash
npm run lint:check && npm run format:check && npm run typecheck
npm test                 # Jest + Vitest
npm run test:ci          # cobertura — backend: 98% lines/statements, 95% functions, 91% branches
npm run api:check        # snapshot OpenAPI sincronizado
npm run build
npm run test:e2e         # backend E2E + Playwright (matriz iPad inclusa) — obrigatório em U4
```

Migrations: banco vazio → todas as migrations → `revert` da última → `run` de novo, sem erro.
Containers: `docker compose --env-file .env up --build` com serviços saudáveis + smoke test
manual da área unificada.

---

## 10. U4 — Validação integral (checklist de saída)

Testes exigidos pelo plano de produto:

- [ ] Criação de quarto exige prédio; número obrigatório; duplicado no mesmo prédio (CI) → 409;
      mesmo número em prédios diferentes → OK.
- [ ] `buildingId` imutável no PATCH (422).
- [ ] Disponibilidade atual e futura; contrato sobreposto rejeitado pela exclusão GiST
      (incluir teste de concorrência como o existente para contratos).
- [ ] Prédio lotado / com vagas / sem quartos (`vacancyPercentage` null).
- [ ] Buscas combinadas, filtros persistidos na URL, paginação, alternância de abas.
- [ ] Fluxo prédio → quarto → contrato e onboarding completo com quarto disponível.
- [ ] Recibo/PDF com descrição canônica `Quarto {número} — {prédio}, {bairro}`.
- [ ] E2E, acessibilidade, responsividade e matriz iPad atualizados
      (baselines visuais em `frontend/e2e/{ipad,visual}` **vão quebrar** — regenerar
      screenshots deliberadamente, não aumentar threshold).
- [ ] Fixtures: `backend/test/fixtures/seed-fullstack-e2e.ts` e specs E2E reescritos para rooms.

Busca final de código morto — deve retornar **zero** em código de produção (planos em `docs/`
podem citar historicamente):

```bash
grep -rniE "propertyunit|property_unit|unittype|/properties" backend/src frontend/src frontend/e2e backend/test
grep -rniE "imóvel|imovel|unidade imobiliária" backend/src frontend/src   # revisar caso a caso
```

---

## 11. Armadilhas conhecidas

1. **Índices `synchronize: false`**: entidades declaram índices únicos por nome, mas quem cria
   é a migration. Se a migration esquecer o índice CI novo, o TypeORM não avisa.
2. **Exclusão GiST**: a cláusula `WHERE` e o `COALESCE(end_date, 'infinity')` são
   comportamento de negócio (mês-a-mês sem fim + cancelados liberam o quarto). Copiar
   literalmente, só trocando a coluna.
3. **Arquivos gerados**: `backend/docs/openapi.json` e `frontend/src/api/generated/*` — nunca
   editar à mão; sempre `npm run api:generate`.
4. **Cobertura backend é ratchet** (gate de diff coverage no CI): apagar arquivos com testes e
   criar código novo sem specs derruba o gate. Escrever specs junto, não depois.
5. **Locks `invoice → contract`** (fixup F1): manter a ordem ao renomear; não "aproveitar" para
   refatorar transações.
6. **Baselines visuais iPad**: commits recentes (`ff8c09c`, `d1d6130`) acabaram de estabilizar
   CI — mudanças de UI exigem novos snapshots via fluxo oficial do Playwright
   (`--update-snapshots`), com diff revisado.
7. **`ForeignKey` decorator**: o repo usa o decorator `@ForeignKey` do TypeORM (ver
   `onboarding-draft.entity.ts`) além de FKs em migration — seguir o padrão do arquivo vizinho.
8. **Mensagens em pt-BR**: toda `ValidationError`/`ConflictError` e descrição Swagger é em
   português. Manter tom e formato ("O número do quarto é obrigatório.").
9. **Não criar camada de compatibilidade**: sem alias de rota, sem campo duplicado no DTO, sem
   feature flag. Se algo parecer exigir compatibilidade, é sinal de erro de sequência.

## 12. Convenções do repositório (resumo do AGENTS.md)

- Node 24 / npm 11, comandos da raiz do monorepo.
- TypeScript, 2 espaços, LF, aspas simples, 100 colunas; Prettier/ESLint mandam.
- Sufixos NestJS (`.controller.ts`, `.service.ts`, `.entity.ts`); kebab-case em nomes de
  arquivo; PascalCase em classes/DTOs/componentes.
- Conventional Commits (`feat:`, `fix:`, `refactor(frontend):` …); um assunto por commit.
- PRs: intenção, impacto, comandos de validação executados, screenshots de UI; destacar
  migrations, breaking changes e artefatos regenerados.
