# Unificação de prédios e quartos

## Resumo

- Substituir “Imóveis” e “Prédios” por uma única entrada na sidebar: **Prédios e quartos**.
- Tornar **Quarto** o conceito locável oficial em todo o sistema; cada quarto pertence obrigatoriamente a um prédio.
- Exibir a vacância de cada prédio e oferecer busca/filtros robustos por prédio, quarto, situação e data.
- Remover completamente o domínio genérico de imóveis/unidades e reiniciar os dados locais.

## Domínio, banco e APIs

- Substituir `PropertyUnit`, `UnitType` e `property_units` por `Room` e `rooms`.
- O quarto terá `id`, `buildingId`, `number` e `createdAt`; não terá tipo nem bairro próprio. O prédio será a fonte de endereço e bairro.
- Exigir prédio na criação e manter o vínculo imutável; o número do quarto será obrigatório e único, sem diferenciar maiúsculas/minúsculas, dentro do prédio.
- Renomear referências em contratos, onboarding, recibos, dashboard e auditoria de `propertyUnitId/propertyUnit` para `roomId/room`, incluindo colunas, índices, chaves estrangeiras e regra de contratos sobrepostos.
- Substituir `/properties` por:
  - `GET/POST /rooms`
  - `GET/PATCH /rooms/:id`
  - `GET /rooms` com `q`, `buildingId`, `status=VACANT|OCCUPIED`, `date`, paginação.
- Expandir `/buildings` com `date` e `vacancy=WITH_VACANCY|FULL|NO_ROOMS`. A busca cobrirá nome, bairro e endereço.
- Respostas de prédio usarão `totalRooms`, `occupiedRooms`, `vacantRooms`, `vacancyPercentage` e, no detalhe, `rooms`.
- Vacância será `(vagos / total) × 100`, arredondada para uma casa decimal; prédios sem quartos retornarão percentual nulo.
- Ocupação será calculada na data civil selecionada, considerando contratos vigentes e ignorando cancelados ou encerrados.
- Criar uma migração de esquema segura para banco vazio. Como os dados são descartáveis, recriar os volumes locais de PostgreSQL e MinIO antes de executar todas as migrations; o usuário administrativo será recriado pelo bootstrap.
- Regenerar OpenAPI e o cliente TypeScript. Não manter compatibilidade com `/properties` ou com os antigos campos de API.

## Experiência unificada

- Criar `/portfolio`, com abas **Prédios** e **Quartos**; Prédios será a visão inicial.
- Manter rotas de detalhe e cadastro em `/buildings/*` e `/rooms/*`; `/buildings` redirecionará para a aba correspondente.
- Aba Prédios:
  - busca por nome, bairro ou endereço;
  - data de referência;
  - filtros “com vagas”, “lotado” e “sem quartos”;
  - ordenação inicial pela maior vacância, seguida pelo nome;
  - total, ocupados, vagos e percentual de vacância em cada linha/cartão.
- Aba Quartos:
  - busca por número do quarto, prédio, bairro ou endereço;
  - filtros por prédio, data e situação;
  - resultados com prédio, quarto, localização e situação na data escolhida.
- Persistir aba, filtros, data e paginação na URL.
- No detalhe do prédio, mostrar o resumo de vacância, permitir filtrar seus quartos e oferecer **Adicionar quarto**, abrindo `/rooms/new?buildingId=...`.
- O cadastro de quarto terá apenas prédio e identificação do quarto.
- Atualizar dashboard, contratos, faturas, recibos, PDFs e onboarding para usar exclusivamente “prédio” e “quarto”, inclusive na seleção de quartos disponíveis.
- Remover rótulos, filtros, ícones e textos relacionados a imóvel, unidade ou tipo de unidade.

## Testes e validação

- Testar exigência de prédio, número obrigatório, duplicidade no mesmo prédio e permissão de números iguais em prédios diferentes.
- Testar disponibilidade atual e futura, contratos sobrepostos, prédio lotado, com vagas e sem quartos.
- Validar buscas combinadas, filtros persistidos na URL, paginação e alternância entre abas.
- Cobrir cadastro prédio → quarto → contrato e o onboarding completo com quarto disponível.
- Atualizar testes unitários, integração, E2E, acessibilidade, responsividade e matriz iPad.
- Executar lint, formatação, typecheck, cobertura, OpenAPI check, builds de backend/frontend e migrations em banco vazio.
- Recriar e compilar os containers com `docker compose up --build`, confirmar migrations concluídas, serviços saudáveis e realizar smoke test da área unificada.

## Premissas

- Todos os dados atuais, inclusive documentos em MinIO, podem ser descartados.
- Não existem consumidores externos que precisem de compatibilidade com a API antiga.
- Todo quarto pertence a exatamente um prédio.
- A data padrão dos filtros será hoje em `America/Sao_Paulo`.
