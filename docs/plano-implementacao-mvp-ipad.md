# TenancyLedger — Plano de implementação em etapas (para Codex)

## Contexto

O plano de ação do proprietário transforma o TenancyLedger num MVP de locação mensal presencial via iPad: contrato `MONTH_TO_MONTH` sem prazo final, renovações mensais por mês-calendário, pagamento em dinheiro aprovado diretamente pelo proprietário, recibos sequenciais, wizard de cadastro no iPad, geração de PDF de contrato, dashboard financeiro com 3 conceitos (Recebido / A receber confirmado / Renovações previstas) e fechamento diário de caixa.

Este documento dilui esse plano em **21 etapas pequenas (E01–E21)**, cada uma cabendo num PR revisável que passa no CI: cobertura backend ≥98% lines/statements e ≥91% branches, `coverage:diff`, `openapi:check` (regenerar snapshot quando a API mudar) e, no frontend, `api:generate` + Vitest + Playwright quando aplicável.

**Stack atual**: NestJS 11 + TypeORM/Postgres (rich domain models, construtor privado + `create()`, invariantes em código E como `@Check`/`@Exclusion` no banco, migrations manuais); React 19 + MUI v9 + TanStack Query + cliente OpenAPI gerado; tema "Livro-Razão".

## Decisões de design (resolvidas)

- **D1 — Evoluir `Contract`, não criar agregado novo.** Adicionar `contractType` (`FIXED_TERM|MONTH_TO_MONTH`), `endDate`/`durationInMonths` nullable com CHECK de coerência. Exclusão GiST vira `daterange(move_in_date, COALESCE(end_date,'infinity'::date), '[]')`.
- **D2 — `paidThroughDate`/`nextRenewalDate` derivados** das faturas `PAID` (maior `period_end`; next = paidThrough + 1 dia), expostos como campos computados no DTO. Sem dual-write; segue padrão do projeto (ocupação derivada, `markExpired` lazy).
- **D3 — Sem entidade `Renewal`; estender `Invoice`** com `period_start`/`period_end`. `Renewal PAID/OVERDUE` ≡ `Invoice PAID/OVERDUE`; `UPCOMING` é projeção calculada (nunca persistida); `NOT_RENEWING`/`CANCELLED` viram estado do contrato. Evita duas máquinas de estado sobre o mesmo dinheiro.
- **D4 — CASH direto-aprovado via `createDirectSettlement()`**: nasce `APPROVED` com `reviewed_by = submitted_by`, coluna `is_direct_settlement`. `@Check` de coerência ganha ramo: autoaprovação só válida se `is_direct_settlement AND method='CASH'`. Fluxo de revisão existente intocado.
- **D5 — PDF com `pdfkit`** (leve, determinístico, sem headless browser), atrás de interface `DocumentRenderer` em `backend/src/infrastructure/pdf/`.
- **D6 — Recibo sequencial**: `CREATE SEQUENCE receipt_number_seq` + tabela `receipts` com `number` unique; atribuído na transação da aprovação/settlement. Gaps por rollback aceitáveis; duplicação impossível.
- **D7 — Rascunho do wizard em tabela `onboarding_drafts` (payload JSONB)** no backend — não Contract `DRAFT` (contaminaria invariantes e GiST) nem localStorage (morre com o Safari do iPad). Wizard só cria Tenant+Contract reais e válidos na finalização.
- **D8 — Status do contrato: parte persistida, parte derivada.** Enum ganha `PENDING_SIGNATURE`, `PAYMENT_PENDING`, `ENDING`, `CANCELLED` (+ `ACTIVE|EXPIRED|TERMINATED` existentes). `RENEWAL_DUE`/`PAYMENT_OVERDUE` são badges derivados das faturas no DTO — sem cron de sincronização. `DRAFT` não entra no enum (ver D7).
- **D9 — Ordem**: domínio → PDF/documentos → wizard iPad → financeiro. PDF antecipado porque o fim do wizard imprime contrato e o 1º pagamento emite recibo.

---

## Fase 0 — Domínio (E01–E06)

### E01 — Utilitário de mês-calendário
Extrair a aritmética de `Contract.calculateEndDate` (já faz clamp 29–31) para util puro: `addCalendarMonths(dateISO, n)` e `calendarPeriodFrom(startISO)` → `{start, end}` inclusivo (18/jul → 17/ago; 31/jan → 27/28-fev).
**Arquivos**: novo `backend/src/core/domain/calendar-period.ts` (+spec); `backend/src/contexts/contract/domain/entities/contract.entity.ts` delega sem mudar comportamento.
**Depende de**: —.
**Aceite**: specs cobrindo dias 29/30/31, fevereiro bissexto, virada de ano; specs existentes de `calculateEndDate` intactos; snapshot OpenAPI inalterado.

### E02 — Contract MONTH_TO_MONTH
`contractType` enum, `endDate`/`durationInMonths` nullable, GiST com `COALESCE(end_date,'infinity')`.
**Arquivos**: `contract.entity.ts` (+spec), `contract.service.ts`, DTOs, `contract.typeorm.repository.ts` (`hasOverlap` com COALESCE), migration nova (drop/recreate `EX_contracts_no_overlapping_period`, enum `contract_type`, checks de coerência tipo↔campos, backfill `FIXED_TERM`).
**Decisões**: `markExpired`/`renew` viram no-op/erro para `MONTH_TO_MONTH`; `endDate null` = infinito em `isActiveOn`.
**Depende de**: E01.
**Aceite**: `migration:run`/`revert` ok; integração prova que dois `MONTH_TO_MONTH` na mesma unidade violam exclusão; snapshot OpenAPI regenerado; frontend `api:generate` compila.

### E03 — Ciclo de vida estendido do contrato
Enum ganha `PENDING_SIGNATURE|PAYMENT_PENDING|ENDING|CANCELLED`; métodos `markSigned()`, `activate()`, `scheduleEnding(reason)`, `cancel(reason)`, `terminate(reason)`; colunas `status_reason`/`status_changed_at`; GiST exclui `TERMINATED|CANCELLED`.
**Arquivos**: `contract.entity.ts` (+spec), **duas** migrations (Postgres: `ALTER TYPE ... ADD VALUE` não pode estar na mesma transação que usa o valor), `contract.service.ts`, `contract.controller.ts` (endpoints de transição), DTOs.
**Decisões**: wizard cria em `PENDING_SIGNATURE`; criação legada `FIXED_TERM` continua nascendo `ACTIVE`.
**Depende de**: E02.
**Aceite**: matriz de transições testada (inválida → 409); `invoice-generation.worker.ts` ignora `PENDING_SIGNATURE|PAYMENT_PENDING`; migrations run+revert; OpenAPI regen.

### E04 — Invoice com período coberto + campos derivados
`period_start`/`period_end` em `invoices`; worker gera faturas `MONTH_TO_MONTH` por mês-calendário (E01); `paidThroughDate`, `nextRenewalDate` e badges (`RENEWAL_DUE` se next ≤ hoje+3d; `PAYMENT_OVERDUE` se fatura `OVERDUE`) no `ContractResponseDto`.
**Arquivos**: `invoice.entity.ts` (+spec), migration (colunas + backfill de `competence` + CHECK `period_end >= period_start` + unique `(contract_id, period_start)`), `invoice-generation.worker.ts` (+spec), `contract.service.ts`/DTOs.
**Depende de**: E02, E03.
**Aceite**: fatura 18/jul–17/ago com competence correta; backfill idempotente; `paidThroughDate` correto com pagamentos parciais; OpenAPI regen.

### E05 — Disponibilidade de unidades por data
`GET /properties/available?date=` (default hoje): unidades sem contrato ocupante na data (`end_date null` = infinito; ignora `TERMINATED|CANCELLED`); filtros `neighborhood`/`type`/`buildingId`.
**Arquivos**: `property.controller.ts`, `property.service.ts` (+spec), `property.typeorm.repository.ts`, DTOs.
**Depende de**: E02, E03.
**Aceite**: `MONTH_TO_MONTH` ativo nunca aparece; `FIXED_TERM` terminado antes da data aparece; OpenAPI regen.

### E06 — CASH direto-aprovado + estorno
(a) `PaymentTransaction.createDirectSettlement()` (D4); `POST /invoices/:id/settle-cash` (ADMIN|MANAGER) que aprova direto e ativa contrato se for a fatura do período inicial. (b) Estorno: status `REVERSED` com `reversal_reason`/`reversed_by`/`reversed_at` obrigatórios (nunca deletar), recálculo do status da fatura.
**Arquivos**: `payment-transaction.entity.ts` (+spec), migrations (coluna `is_direct_settlement`; `REVERSED` em migration separada; extensão do CHK de status), `billing.service.ts` (+spec), controllers, DTOs.
**Depende de**: E03, E04.
**Aceite**: direct-settlement PIX → erro; autoaprovação de `SUBMITTED` continua 409; estorno exige motivo; CHK testado em integração; 1º CASH em `PAYMENT_PENDING` → contrato `ACTIVE`; OpenAPI regen.

## Fase 1 — Documentos e PDF (E07–E10)

### E07 — Infra de PDF + storage de documentos privados
Instalar `pdfkit`; `DocumentRenderer` (interface + impl); estender `backend/src/infrastructure/storage.service.ts` com prefixo `documents/` reutilizando magic bytes e presigned ≤900s.
**Arquivos**: novo `backend/src/infrastructure/pdf/document-renderer.ts` (+spec asserindo bytes `%PDF-`), `storage.service.ts` (+spec), `storage.module.ts`.
**Depende de**: — (paralelizável com Fase 0).
**Aceite**: PDF válido em teste unitário (S3 mockado como nos specs atuais); snapshot OpenAPI inalterado.

### E08 — Recibos sequenciais
Contexto `receipt`: entidade `Receipt` (`number` via sequence, `payment_transaction_id` unique, `issued_at`, `storage_key`, snapshot de dados do inquilino/unidade/período/valor); emitido na aprovação E no direct-settlement; `GET /receipts/:id` + `/download` (presigned).
**Arquivos**: novo `backend/src/contexts/receipt/{domain,application,infrastructure}` (layout do contexto `tenant`); migration (sequence + tabela); hooks em `billing.service.ts`.
**Depende de**: E06, E07.
**Aceite**: recibo na mesma transação (falha de storage → rollback testado); números crescentes/únicos sob concorrência; estorno marca `voided_reason` sem apagar; OpenAPI regen.

### E09 — PDF do contrato
Template de contrato mensal (tenant, unidade, valor, período, regra de renovação) como funções pdfkit em TypeScript (não HTML); `GET /contracts/:id/document/preview` a partir de `PENDING_SIGNATURE`.
**Arquivos**: novo `contract-document.renderer.ts` no contexto contract (+spec), `contract.controller.ts`, `contract.service.ts`.
**Depende de**: E03, E07.
**Aceite**: preview retorna `application/pdf` com dados corretos; BRL formatado; OpenAPI regen.

### E10 — Histórico de documentos do contrato
Tabela `contract_documents` (`kind` = `GENERATED|SIGNED|OTHER`, `version`, `storage_key`, `uploaded_by`); upload multipart do assinado dispara `markSigned()` (`PENDING_SIGNATURE → PAYMENT_PENDING`); listagem com presigned; versões nunca sobrescritas.
**Arquivos**: nova entidade `contract-document.entity.ts` (+spec), migration, controller/service/repositório do contexto contract.
**Depende de**: E03, E07, E09.
**Aceite**: upload transiciona status; 2º upload cria `version=2` mantendo a 1; download autenticado, expira ≤900s; OpenAPI regen.

## Fase 2 — Fluxo presencial iPad (E11–E16)

### E11 — Foto do inquilino + referências (backend)
`photo_storage_key` no tenant + endpoints upload/download (JPEG/PNG/HEIC); tabela `tenant_references` (`name`, `relationship`, `phone`, `email?`, `verified_at?`, `verified_by?`, `notes?`) com CRUD aninhado e endpoint "marcar verificada".
**Arquivos**: `tenant.entity.ts`, nova `tenant-reference.entity.ts` (+specs), migration, `tenant.controller.ts`, DTOs, use-cases.
**Depende de**: E07.
**Aceite**: 0..N referências (política de "2 obrigatórias" fica no wizard); `verified_by` FK users; magic bytes na foto; OpenAPI regen.

### E12 — Rascunho de onboarding (backend)
Tabela `onboarding_drafts` (`payload jsonb`, `created_by`, `updated_at`, `status DRAFT|COMPLETED|DISCARDED`) + CRUD `/onboarding-drafts`.
**Arquivos**: novo contexto `backend/src/contexts/onboarding/` (layout de `tenant`), migration.
**Depende de**: — (paralelizável).
**Aceite**: payload opaco (só tamanho ≤~64KB e JSON válido); listagem restrita ao próprio usuário salvo ADMIN; OpenAPI regen.

### E13 — Frontend: layout iPad + shell do wizard
Breakpoint tablet (md = layout desktop) e shell fullscreen `frontend/src/modules/onboarding/OnboardingWizard.tsx` (rota `/onboarding`, stepper MUI, "Salvar rascunho" → E12, guarda de navegação, tema Livro-Razão, touch ≥44px). Adicionar projeto iPad (1024×768 landscape) no `playwright.config.ts`.
**Arquivos**: `router.tsx`, `theme.ts`, novo `frontend/src/modules/onboarding/`, `playwright.config.ts`.
**Depende de**: E12.
**Aceite**: Vitest do shell (navegação + rascunho via MSW); snapshot iPad do wizard; snapshots visuais existentes atualizados conscientemente se o breakpoint alterar páginas atuais.

### E14 — Frontend: passos dados pessoais, foto, referências
Passo 1 reutiliza schemas de `frontend/src/modules/tenants/schemas.ts`; passo 2 foto com `<input type="file" accept="image/*" capture="environment">` + galeria + "depois"; passo 3 duas referências.
**Arquivos**: `steps/{PersonalDataStep,PhotoStep,ReferencesStep}.tsx` (+tests), `tenants/api.ts`.
**Depende de**: E11, E13.
**Aceite**: zod espelha DTOs; preview da foto; estado sobrevive a ir/voltar e salvar/retomar rascunho; Vitest+MSW.

### E15 — Frontend: busca de quarto + revisão + conclusão atômica
Passo 4 busca por data/bairro/tipo (E05) com cards de seleção; passo 5 revisão + valor + data de entrada (regra 18/jul→17/ago exibida). Conclusão via novo endpoint backend `POST /onboarding-drafts/:id/complete` — transação única cria tenant+refs+contract `MONTH_TO_MONTH` em `PENDING_SIGNATURE` e marca draft `COMPLETED` (PR maior, mas evita estados meio-criados).
**Arquivos**: `steps/{RoomSearchStep,ReviewStep}.tsx` (+tests), `onboarding/api.ts`, backend contexto onboarding (endpoint complete).
**Depende de**: E02, E03, E05, E11, E12, E14.
**Aceite**: e2e Playwright iPad do wizard completo (com seed); conflito GiST na unidade → erro amigável, volta ao passo 4; OpenAPI regen.

### E16 — Frontend: assinatura, impressão, 1º pagamento
Na `ContractDetailPage`: seção de documentos (prévia/imprimir PDF do E09; upload do assinado E10 com `capture`), ação "Registrar 1º pagamento em dinheiro" (E06) que ativa contrato e abre recibo (E08) para impressão.
**Arquivos**: `contracts/ContractDetailPage.tsx`, novos `ContractDocumentsSection.tsx`, `SettleCashDialog.tsx`, `invoices/api.ts`.
**Depende de**: E06, E08, E09, E10, E15.
**Aceite**: e2e `PENDING_SIGNATURE → PAYMENT_PENDING → ACTIVE`; recibo em nova aba com número sequencial; Vitest dos componentes.

## Fase 3 — Financeiro e caixa (E17–E21)

### E17 — Dashboard backend: 3 conceitos + por imóvel/por dia
**Recebido** (APPROVED não estornado no período), **A receber confirmado** (faturas `OPEN|PARTIALLY_PAID|OVERDUE` emitidas), **Renovações previstas** (projeção: contratos `ACTIVE` `MONTH_TO_MONTH` × períodos não faturados, janela de 30 dias); breakdowns por unidade/prédio e série por dia.
**Arquivos**: `dashboard.service.ts` (+spec), `dashboard.controller.ts`, DTOs.
**Depende de**: E04, E06.
**Aceite**: 3 números disjuntos (teste anti-dupla-contagem do mesmo período); estorno subtrai de Recebido; OpenAPI regen.

### E18 — Dashboard frontend
Redesenho da `DashboardPage`: 3 cartões conceituais, tabela por imóvel, visão por dia. Sem lib de gráficos — SVG próprio/MUI no tema Livro-Razão.
**Arquivos**: `dashboard/{DashboardPage.tsx,api.ts}` + componentes (+tests).
**Depende de**: E17.
**Aceite**: Vitest+MSW; snapshot visual desktop + iPad atualizado.

### E19 — Fechamento diário de caixa (backend)
Contexto `cashbox`: `CashClosing` (`closing_date` unique, `expected_cash_cents` calculado no servidor dos CASH APPROVED do dia, `counted_cash_cents`, `difference_cents` derivado, `closed_by`, `closed_at`, `status CLOSED|REOPENED`, `reopen_reason?`). Settle/estorno CASH em dia fechado → 409; `POST /cash-closings/:date/reopen` (ADMIN, motivo obrigatório).
**Arquivos**: novo `backend/src/contexts/cashbox/`, migration, guarda em `billing.service.ts`.
**Depende de**: E06.
**Aceite**: expected bate com settlements do dia; difference pode ser negativa; reabertura auditada; 2º fechamento do mesmo dia → 409; OpenAPI regen.

### E20 — Fechamento de caixa (frontend)
Página `/cashbox` (ADMIN|MANAGER): esperado × contado, diferença em vermelho-razão se ≠0, histórico, reabrir com motivo.
**Arquivos**: novo `frontend/src/modules/cashbox/` + rota.
**Depende de**: E19.
**Aceite**: Vitest+MSW; e2e do fechamento; 409 de dia fechado exibido no `SettleCashDialog` com link para reabertura.

### E21 — Renovações: notificações + lista de trabalho
Worker (`@nestjs/schedule`, padrão do `invoice-generation.worker.ts`) cria notificações `RENEWAL_DUE` (next ≤ 3 dias) e `PAYMENT_OVERDUE`; frontend: filtro "Renovações" na `ContractsPage` pelos badges derivados + destaque no `NotificationsMenu`.
**Arquivos**: contexto `notification` (novo tipo), worker novo, `contracts/{ContractsPage,filters,labels}`, `NotificationsMenu.tsx`.
**Depende de**: E04, E17.
**Aceite**: worker idempotente (sem duplicar por contrato/período); filtro testado; OpenAPI regen se DTOs mudarem.

---

## Grafo de dependências

```
E01 → E02 → E03 → E04 → E17 → E18
             │      │      └→ E21
             │      └→ E06 → E08;  E06 → E19 → E20
             ├→ E05
             ├→ E09 → E10
E07 → {E08, E09, E11}
E12 → E13 → E14 → E15 → E16 ← {E06, E08, E09, E10}
       (E15 também depende de E02, E03, E05, E11)
```

Trilhas paralelas desde o início: **E01 (domínio), E07 (PDF/storage), E12 (drafts)**.

## Riscos

1. `ALTER TYPE ... ADD VALUE` não roda na mesma transação que usa o valor (E03, E06) → sempre duas migrations.
2. Recriar exclusão GiST com dados existentes (E02, E03): nova expressão é mais permissiva para o legado (`end_date` nunca é null hoje); testar run+revert.
3. Gate de 98% com contextos novos (receipt/onboarding/cashbox): entidade+specs no mesmo PR, nunca scaffold sem teste; `coverage:diff` como sinal precoce.
4. Snapshot OpenAPI muda em quase toda etapa backend: `openapi:generate` + commit do snapshot + `api:generate` no frontend fazem parte do definition-of-done.
5. Câmera iPad/Safari: `capture` é hint; HEIC pode chegar do iOS → aceitar HEIC no backend (E11); testar em Safari real.
6. Projeção de "Renovações previstas" para MONTH_TO_MONTH é infinita → janela fixa de 30 dias documentada no Swagger (E17).
7. Mudança de breakpoint (E13) pode quebrar snapshots visuais → rodar Playwright completo e atualizar no mesmo PR.

## Verificação por fase

- **Fase 0**: `cd backend && npm run lint:check && npm run typecheck && npm run test:ci && npm run coverage:diff && npm run openapi:check && npm run test:e2e:ci`; `migration:run`/`revert`/`run` contra Postgres local; manual via Swagger: criar `MONTH_TO_MONTH`, tentar 2º na mesma unidade (409), settle CASH → fatura `PAID` + contrato `ACTIVE`.
- **Fase 1**: Fase 0 + baixar preview de contrato e recibo via presigned (MinIO local), conferir `%PDF`; dois pagamentos concorrentes → recibos com números distintos e crescentes; upload de assinado transiciona status.
- **Fase 2**: `cd frontend && npm run api:generate && npm run lint && npm run test && npx playwright test` (com projeto iPad); manual em iPad/simulador: wizard completo com câmera, salvar rascunho no meio, retomar, concluir, imprimir contrato, 1º CASH, imprimir recibo.
- **Fase 3**: seed com valores conhecidos → conferir os 3 números do dashboard; fechar caixa com contagem divergente; settle CASH em dia fechado (409) → reabrir → concluir; notificação de renovação a 3 dias.
