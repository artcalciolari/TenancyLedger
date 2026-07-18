# Política de cobertura e ratchet

Esta política mantém dois universos independentes. A cobertura unitária é definida por
`jest.collectCoverageFrom` em `backend/package.json`; controllers, DTOs, modules,
repositórios TypeORM, bootstrap e database continuam fora desse universo. A cobertura E2E é
medida separadamente por `test/jest-e2e.json`. Os relatórios não são mesclados.

## Gates e localização dos thresholds

| Gate            | Configuração                                                      | Regra                                                |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Unitário global | `backend/package.json` → `jest.coverageThreshold['src/']`         | Ratchet agregado de `All files` do universo unitário |
| Código alterado | `DIFF_COVERAGE_THRESHOLDS` em `backend/scripts/diff-coverage.mjs` | 100% lines, 100% functions e pelo menos 95% branches |
| E2E             | `backend/test/jest-e2e.json`                                      | Gate próprio sobre o universo E2E                    |

## Resultado da campanha unitária

Os percentuais abaixo medem somente o universo reduzido de `jest.collectCoverageFrom`. Eles não
representam toda a árvore `backend/src`: controllers, DTOs, modules, repositórios TypeORM,
bootstrap e database são medidos pelo gate E2E separado ou classificados pelo diff gate.

| Marco                                              | Suítes/testes | Statements         | Branches          | Functions        | Lines              |
| -------------------------------------------------- | ------------- | ------------------ | ----------------- | ---------------- | ------------------ |
| Baseline `d793c3c` (T1/T2 não alteraram unitários) | 33/264        | 1463/1637 (89,37%) | 795/1034 (76,88%) | 279/314 (88,85%) | 1348/1485 (90,77%) |
| T3 — dinheiro e segurança                          | 33/307        | 1528/1637 (93,34%) | 857/1034 (82,88%) | 290/314 (92,35%) | 1395/1485 (93,93%) |
| T4 — infraestrutura, cumulativo                    | 33/346        | 1562/1637 (95,41%) | 906/1034 (87,62%) | 296/314 (94,26%) | 1418/1485 (95,48%) |
| T5 — entidades de domínio                          | 36/447        | 1591/1637 (97,18%) | 938/1034 (90,71%) | 296/314 (94,26%) | 1447/1485 (97,44%) |
| T6 — cauda útil e fechamento                       | 37/459        | 1610/1637 (98,35%) | 950/1034 (91,87%) | 300/314 (95,54%) | 1465/1485 (98,65%) |

Do baseline ao fechamento, a campanha cobriu mais 147 statements, 155 branch outcomes, 21
functions e 117 lines. A T6 contribuiu +19/+12/+4/+18, respectivamente, sem alterar produção.

### Ratchet global final

| Métrica    | Medição estável | Threshold | Margem  | Piso vinculante |
| ---------- | --------------- | --------- | ------- | --------------- |
| Statements | 98,35%          | 98%       | 0,35 pp | 95%             |
| Branches   | 91,87%          | 91%       | 0,87 pp | 90%             |
| Functions  | 95,54%          | 95%       | 0,54 pp | 95%             |
| Lines      | 98,65%          | 98%       | 0,65 pp | 95%             |

Os valores inteiros imediatamente abaixo da medição deixam menos de um ponto percentual de
margem e evitam ratchetar acima do resultado reproduzido. Os ratchets por arquivo dos módulos
críticos permanecem em 90% de branches.

No Jest 30, qualquer arquivo que corresponda a um threshold por path é subtraído do grupo especial
`global`. Como `billing`, `auth`, `refresh-session` e `storage` mantêm ratchets próprios, usar
somente `global` mediria um subconjunto e não o `All files` exibido pelo relatório. O path agregado
`src/` aplica 98/91/95/98 a todo o universo instrumentado e, em paralelo, os quatro paths
específicos continuam aplicando 90% de branches aos módulos críticos. A chave `global` conserva os
mesmos valores como espelho declarativo; todos os arquivos pertencem a `src/`, portanto o grupo
residual `global` fica vazio sem substituir nem enfraquecer o gate agregado.

### Classificação final do resíduo

O relatório final deixa 27 statements, 84 branch outcomes, 14 functions e 20 lines sem
cobertura. A classificação conta pontos Istanbul; uma mesma linha pode gerar mais de um branch
ou function por causa do emit de decorators.

| Categoria                        | Statements | Branches | Functions | Lines  |
| -------------------------------- | ---------- | -------- | --------- | ------ |
| Comportamento testável           | 9          | 21       | 0         | 8      |
| Defesa inalcançável justificável | 4          | 12       | 0         | 0      |
| Instrumentação/framework/ORM     | 14         | 51       | 14        | 12     |
| **Total residual**               | **27**     | **84**   | **14**    | **20** |

**Comportamento testável, mantido como cauda de baixo risco:** credenciais padrão de banco em
produção (`environment.ts:221`); rota sem metadata de papel (`roles.guard.ts:16`); data default do
dashboard (`dashboard.service.ts:47`); cleanup rejeitado com valor não-`Error` e quoting CSV
(`billing.service.ts:368,544`); `affected` ausente e leitura repetida
(`notification.service.ts:53`, `notification.entity.ts:65`); erro inesperado no update de prédio
(`building.service.ts:87`); bairro ausente na criação de unidade (`property.service.ts:68`);
updates parciais/validações residuais (`building.entity.ts:49`,
`property-unit.entity.ts:68,72,84`); propagação de falhas não únicas de tenant
(`create-tenant.use-case.ts:53,62`, `update-tenant.use-case.ts:52,61`); cálculo de dígito zero do
CPF (`cpf.vo.ts:34`); e fallbacks HTTP de métricas (`metrics.interceptor.ts:27,34,37`). Esses casos
podem ser adicionados quando o risco correspondente mudar; não são necessários para esconder uma
lacuna numérica.

**Defesa inalcançável justificável:** formatos de `driverError` que violam o contrato do driver
TypeORM (`auth.service.ts:202,204`, `building.service.ts:124,126`,
`property.service.ts:164,166`, `update-tenant.use-case.ts:63`); valor nulo passado aos helpers CSV
privados depois de o fluxo público já normalizá-lo (`contract.service.ts:304`,
`billing.service.ts:542`); ausência de partes `year/month/day` em uma implementação conforme de
`Intl.DateTimeFormat` (`invoice-generation.worker.ts:133`, `civil-date.ts:9`); e o fallback
`Request failed.` que não é alcançado depois da classificação de exceções
(`http-exception-audit.filter.ts:48`). As defesas permanecem no código e não receberam
`istanbul ignore`.

**Instrumentação/framework/ORM:** os 14 functions residuais são callbacks gerados por decorators
ou wrappers de framework em `refresh-session.entity.ts:23`, `current-user.decorator.ts:5`,
`contract.entity.ts:44,52`, `invoice.entity.ts:49,74`,
`payment-transaction.entity.ts:56,106,114`, `notification.entity.ts:36`,
`audit-log.entity.ts:19` e `openapi.decorators.ts:30`. Os 51 branches restantes desta categoria
se dividem em: 30 emits de DI/Nest nos construtores dos services, guards, interceptor e filter; 17
emits de decorators/transformers nas entidades; três defaults dos wrappers OpenAPI; e o construtor
vazio reservado ao TypeORM em `CpfVO:8`. Os pontos de DI estão nas linhas de parâmetros decorados
de `admin-bootstrap`, `auth`, `refresh-session`, `jwt-auth`, `jwt.strategy`, `roles`, `contract`,
`dashboard`, `billing`, `invoice-generation`, `notification`, `property`, `tenant.queries`, audit,
storage e metrics. Executá-los diretamente testaria emit do compilador ou integração de framework,
não comportamento da aplicação.

O `coverage-final.json` consumido pelo diff gate é sempre o relatório **unitário fresco** de
`npm run test:ci`. O reporter `json` está declarado explicitamente em `backend/package.json`.
Nenhum outro comando Jest deve rodar entre `test:ci` e `coverage:diff`, pois o relatório é
last-run-wins.

## Uso local

Depois de commitar as alterações que serão comparadas:

```bash
cd backend
npm run test:ci
npm run coverage:diff -- origin/main
```

Também são aceitos `--base <ref>` e `DIFF_COVERAGE_BASE=<ref>`. Sem base explícita, a execução
local tenta `origin/main`; se ele não existir, tenta `HEAD^` e emite um aviso. Se nenhum commit
seguro estiver disponível, o gate falha e pede um fetch ou uma base explícita.

O script usa `git diff --unified=0 <base>...HEAD -- backend/src`. Portanto, alterações ainda
não commitadas não fazem parte da medição.

## Comportamento no CI

O job `backend-quality` usa histórico completo no checkout e executa o gate imediatamente após
`test:ci`:

- pull request: `github.event.pull_request.base.sha`;
- push: `github.event.before`;
- SHA ausente, zerado ou indisponível: fallback visível para `HEAD^`;
- fallback indisponível: falha fechada, sem aprovar um diff desconhecido.

Cada ref é resolvida para um SHA de commit antes de chegar ao comando `git diff`. Isso evita que
uma entrada parecida com opção seja interpretada pelo Git.

## Classificação dos arquivos alterados

O script normaliza paths absolutos Windows/POSIX do Istanbul e paths relativos do Git contra a
raiz do repositório. Para cada arquivo sob `backend/src`, ele registra uma classificação:

- `INCLUDED`: pertence ao universo unitário e participa do gate;
- `EXCLUDED`: informa a regra de `collectCoverageFrom` responsável e não entra no denominador;
- `DELETED` ou `NO-ADDED-LINES`: aparece no relatório, sem linha nova executável;
- `ERROR`: deveria pertencer ao universo unitário, mas está ausente do coverage map.

Arquivos excluídos nunca são omitidos silenciosamente e não são inferidos como cobertos por E2E.
Uma mudança que queira cobrar controllers via changed-code coverage exige planejamento de
artefatos entre jobs; não deve mesclar relatórios incidentalmente.

As linhas são associadas aos `statementMap` que cruzam as linhas do hunk. Funções usam a
localização de declaração, e branches usam a localização instrumentada do branch. A saída lista
arquivo e linha para cada lacuna.

## Regra de ratchet

Thresholds podem subir depois de uma medição estável, mas **nunca podem ser reduzidos**. Para
alterá-los:

1. rode a suíte correspondente mais de uma vez em ambiente limpo;
2. registre cobertura global e hotspots por arquivo;
3. eleve o threshold para um valor logo abaixo do resultado estável, sem ultrapassar a meta que a
   suíte consegue sustentar;
4. mantenha o novo valor em mudanças futuras, inclusive durante refactors.

É proibido compensar uma regressão reduzindo threshold, ampliando `collectCoverageFrom` com novas
exclusões ou mesclando cobertura unitária e E2E. Uma exceção de instrumentação exige justificativa
local no código e revisão explícita.
