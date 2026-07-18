# Política de cobertura e ratchet

Esta política mantém dois universos independentes. A cobertura unitária é definida por
`jest.collectCoverageFrom` em `backend/package.json`; controllers, DTOs, modules,
repositórios TypeORM, bootstrap e database continuam fora desse universo. A cobertura E2E é
medida separadamente por `test/jest-e2e.json`. Os relatórios não são mesclados.

## Gates e localização dos thresholds

| Gate            | Configuração                                                      | Regra                                                |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Unitário global | `backend/package.json` → `jest.coverageThreshold`                 | Baseline global do universo unitário                 |
| Código alterado | `DIFF_COVERAGE_THRESHOLDS` em `backend/scripts/diff-coverage.mjs` | 100% lines, 100% functions e pelo menos 95% branches |
| E2E             | `backend/test/jest-e2e.json`                                      | Gate próprio sobre o universo E2E                    |

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
