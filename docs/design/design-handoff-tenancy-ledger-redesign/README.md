# Handoff: Tenancy Ledger — Redesign UI/UX

## Overview

Redesign da SPA administrativa **Tenancy Ledger** (gestão de locações: autenticação, visão
geral, faturas, revisão de pagamentos, contratos, locatários, imóveis, usuários). O objetivo
foi dar ao produto uma **identidade visual sóbria, moderna e acolhedora** (hoje ele é genérico
e "sem vida"), **simplificar a linguagem** para usuários não técnicos e **melhorar a UX** —
**sem alterar o comportamento nem os contratos de API**.

Decisões do briefing:

- Público: um pouco de cada (equipe administrativa, proprietários, locatários).
- Escopo: repensar layout/organização quando fizer sentido; comportamento intacto.
- Linguagem: simplificar; manter dados técnicos acessíveis em "avançado".
- Tema: **somente claro** (remover o alternador claro/escuro/sistema).
- Dispositivo: **desktop**.
- Uma proposta bem resolvida (sem variações).

## About the Design Files

Os arquivos deste pacote são **referências de design feitas em HTML** (protótipos de aparência
e comportamento) — **não são código de produção para copiar**. A tarefa é **recriar estes
designs no ambiente já existente do projeto**: **React 19 + TypeScript + MUI v9 + Emotion +
TanStack Query + React Router + React Hook Form + Zod** (ver `frontend/package.json`). Reaproveite
os componentes, hooks, chamadas de API e a estrutura de rotas que já existem — troca-se a
**camada de apresentação** (tema, layout, componentes visuais, copy), preservando lógica,
data-fetching, validação e permissões.

O protótipo é um único arquivo `.dc.html` com um roteador interno (troca de tela via estado)
apenas para navegação da demo. No app real, cada "tela" corresponde às páginas/rotas já
existentes.

## Fidelity

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento, raios, sombras e estados finais
estão definidos abaixo em valores exatos. Recrie pixel-a-pixel usando MUI (tema + `sx`),
mantendo o mesmo comportamento das páginas atuais.

---

## Sistema de Design (Design Tokens)

### Fontes (Google Fonts)

- **Display / títulos e números grandes:** `Newsreader` (serifada) — pesos 400/500/600.
  Use em `<h1>` de página e nos números "herói" (métricas, valores da fatura).
- **UI / corpo:** `Hanken Grotesk` — 400/500/600/700/800. Tudo que não é display.
- **Monoespaçada (IDs técnicos):** `IBM Plex Mono` — 400/500.
- Ícones: **Material Symbols Rounded** (eixo `wght` 300). No app, prefira `@mui/icons-material`
  equivalentes (o projeto já usa) — o mapa de ícones está em "Assets".

### Cores (tema claro)

| Token                                           | Hex                                                                     | Uso                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| Fundo da página (papel quente)                  | `#F3F1EA`                                                               | `background.default`                     |
| Superfície / cartão                             | `#FFFFFF`                                                               | `background.paper`                       |
| Superfície sutil (cabeçalho de tabela, rodapés) | `#FBFAF6`                                                               | zebra/headers                            |
| Barra lateral (tinta escura)                    | `#16242B`                                                               | sidebar bg                               |
| **Marca / destaque (teal)**                     | `#0E6E78`                                                               | `primary.main`, botões, links, nav ativo |
| Destaque escuro (hover/tinta)                   | `color-mix(#0E6E78 80%, #000)` ≈ `#0B565E`                              | `primary.dark`                           |
| Destaque tinta (fundo suave)                    | `color-mix(#0E6E78 13%, #fff)` ≈ `#E4EFF0`                              | chips/ícones tint                        |
| Destaque claro (sobre a sidebar)                | `color-mix(#0E6E78 58%, #fff)` ≈ `#79C2C7`                              | ícone/nav ativo na sidebar               |
| Ocre (tempero, badge)                           | `#B9822F`                                                               | badge de contagem, detalhe               |
| Texto primário                                  | `#1C2A30`                                                               | títulos/corpo                            |
| Texto secundário                                | `#5E6E73`                                                               | descrições                               |
| Texto terciário                                 | `#8A969A`                                                               | labels/captions                          |
| Borda hairline                                  | `#EBE6D8` (cartões) / `#E4DFD2` (inputs) / `#F1EEE4` (linhas de tabela) |                                          |

### Cores de status (tinta + texto + "dot")

| Status                                        | Fundo     | Texto     | Dot       |
| --------------------------------------------- | --------- | --------- | --------- |
| Sucesso (Pago/Ativo/Aprovado)                 | `#E7F1EA` | `#1F5E3C` | `#2F7D53` |
| Neutro (Em aberto/Expirado/Encerrado/Inativo) | `#ECEDEA` | `#4B5A5F` | `#7C8C90` |
| Info/Parcial                                  | `#E4EFF0` | `#0B565E` | `#0E6E78` |
| Alerta (Em análise/Enviado)                   | `#F6EEDA` | `#855812` | `#B0771C` |
| Erro (Vencida/Rejeitada)                      | `#F7E7E4` | `#973129` | `#B4443C` |

### Escala / raios / sombras

- Raio: cartões **16px**; inputs/botões **10–12px**; chips **8px**; avatares **50%**.
- Sombra de cartão: `0 1px 2px rgba(20,36,43,0.03), 0 10px 26px -18px rgba(20,36,43,0.18)`.
- Sombra de botão primário: `0 8px 18px -8px rgba(14,110,120,0.5)`.
- Espaçamento base 4px; padding de cartão 20–24px; gaps de seção 16–28px.
- Alvo mínimo de toque/altura de controle: **44–46px** (mantém a acessibilidade atual).

### Tema (implementação sugerida em `theme.ts`)

Reescrever `createAppTheme` para **modo claro fixo**, com `primary.main = #0E6E78`,
`background.default = #F3F1EA`, `background.paper = #FFFFFF`, `shape.borderRadius = 12`,
`typography.fontFamily = 'Hanken Grotesk', ...`, e uma variante `h1` usando `Newsreader`.
Derive tints com `color-mix` (ou pré-calcule os hex acima). **Remover** o alternador de tema
e o `ThemePreferenceContext`/`ThemePreferenceMenu` do AppBar (comportamento aprovado no briefing).

---

## Telas / Views

> Cada tela abaixo mapeia para arquivos reais em `frontend/src`. Recrie o visual mantendo a
> lógica desses arquivos.

### 1. Shell (layout) — `src/layouts/AppShell.tsx`

- **Sidebar fixa, 262px, fundo `#16242B`.** Logo (glifo `apartment` em quadrado teal 34px +
  "Tenancy Ledger" branco 700). Navegação **agrupada** por seções com rótulo em maiúsculas
  (`#5E7075`, 0.68rem): **Operação** (Visão geral, Faturas, Revisão de pagamentos — com badge
  ocre de contagem), **Cadastros** (Contratos, Locatários, Imóveis), **Administração** (Usuários).
  - Item ativo: fundo `rgba(255,255,255,0.08)`, texto branco 700, **barra teal-clara à esquerda**
    (3px), ícone `#79C2C7`. Inativo: texto `#AEBBBD`, ícone `#7C8C90`. Altura 44px, raio 10px.
  - Rodapé da sidebar: cartão do usuário (avatar teal, e-mail, papel) + botão sair.
  - Mantenha o filtro de itens por papel (`hasRole`) e o item "Revisão" só para `MANAGEMENT_ROLES`,
    "Usuários" só `ADMIN` — igual ao atual.
- **Topbar fixa, 68px**, fundo `rgba(243,241,234,0.85)` + `backdrop-filter: blur(8px)`, borda
  inferior `#E4DFD2`. Esquerda: **eyebrow** (grupo/breadcrumb em maiúsculas) + título da página.
  Direita: sino de notificações (com ponto vermelho quando há não lidas) e ícone de ajuda.
  Botões 42px, raio 11px, fundo branco, borda `#E4DFD2`.
- **Main:** `margin-left:262px; padding: 96px 40px 48px;` fundo `#F3F1EA`. Conteúdo em **largura
  total** (sem `max-width` além de ~960px em formulários).

### 2. Login — `src/modules/auth/LoginPage.tsx` + `src/layouts/AuthLayout.tsx`

- **Duas colunas.** Painel esquerdo (46%) `#16242B`: logo no topo; título serifado grande
  ("Suas locações, organizadas com calma."); subtítulo `#AEBBBD`; rodapé com régua ocre +
  "Acesso seguro e privado". Dois brilhos radiais sutis (teal e ocre) de fundo.
- Painel direito (branco): "Entrar" (Newsreader), subtítulo, campos **E-mail** e **Senha**
  (altura 50px, borda `#DCD6C8`, ícone à esquerda, olho de mostrar senha), link "Esqueci minha
  senha", botão **Entrar** teal cheio (52px) com seta, e nota de ajuda.
- Comportamento: **inalterado** — mesmo schema Zod (`email`, `password` 8–128), mesmos alertas
  (sessão expirada, senha alterada, erro 429/detalhe), foco no primeiro erro, redirect `returnTo`.

### 3. Visão geral — `src/modules/dashboard/DashboardPage.tsx`

- Saudação serifada + "posição consolidada em {data}".
- **4 cartões de métrica** (grid `repeat(auto-fit, minmax(210px,1fr))` — quebra 2×2 em telas
  estreitas, 4-em-linha no desktop). Cada card: label em maiúsculas + ícone em círculo tint;
  **número herói serifado**; linha de contexto com "dot" colorido. Dados reais do
  `DashboardSummaryResponseDto`: `contracts.active` (+`expiringNext30Days`),
  `invoices.outstandingAmountCents` (+`total`), `invoices.overdueAmountCents` (destaque erro),
  `payments.submitted` (+`invoices.underReview`).
- **Duas colunas** (auto-fit minmax 300px): **"Precisa de atenção"** (lista acionável:
  faturas vencidas → /invoices, pagamentos em revisão → /payments/review, contratos a vencer →
  /contracts) e **"Atividade recente"** (derivada de notificações). _Estas listas são um
  acréscimo de UX; se não houver endpoint dedicado, derive de dados já disponíveis ou esconda._
- **"Faturas recentes"**: tabela compacta (primeiras ~5 de `/invoices`) com link "Ver todas".

### 4. Faturas (lista) — `src/modules/invoices/InvoiceListPage.tsx`

- Cabeçalho + botão secundário "Exportar planilha" (o `CsvExportButton` atual).
- **Toolbar:** busca ampla ("Buscar por bairro, unidade, CPF ou profissão"); **"Mês de
  referência"** (renomear "Competência", `type=month`); botão **"Filtros avançados"** que
  **recolhe** os filtros técnicos (ID do contrato/UUID, período de vencimento, método,
  pagamento) — hoje sempre visíveis. Abaixo, **chips de status em 1 clique**: Todas / Em aberto
  / Vencidas / Em análise / Pagas (ativo = teal cheio; contagem ao lado).
- **Tabela** (cabeçalho maiúsculo em `#FBFAF6`): **Fatura** (imóvel `Bairro · Unid. N` em negrito
  - `profissão · CPF •••.xxx-xx` como secundário — substitui o UUID/monospace) · Mês ref. ·
    Vencimento · Valor (dir., tabular) · Saldo (dir.; **realçado** se > 0, apagado se quitado) ·
    Situação (chip tint + dot) · chevron. Linha inteira clicável → detalhe.
- Rodapé de paginação (o `PaginationBar`/`TablePagination` atual: 20/50/100, "1–N de total").
- **Mantenha** toda a lógica de filtros/URL/`useQuery` existente; o ID do contrato continua
  disponível em "Filtros avançados".

### 5. Detalhe da fatura — `src/modules/invoices/InvoiceDetailPage.tsx`

- Voltar + título serifado "Fatura de {mês}" + chip de situação + botão primário "Registrar
  pagamento" (quando `canManage && availableCents > 0`).
- **Trio de resumo:** Valor total · Aprovado (verde) · **Saldo a pagar** (card escuro `#16242B`,
  número branco) — grid auto-fit minmax 200px.
- **Duas colunas:** "Contrato vinculado" (imóvel + aluguel + `<details>` "Dados técnicos" com o
  **UUID em mono + copiar** — é aqui que o dado técnico fica acessível) e "Locatário" (avatar +
  profissão + `CPF •••.xxx-xx` + estado civil).
- **Pagamentos:** cartões com ícone do método, valor, data, chip de status, "Ver comprovante"
  e ações Aprovar/Rejeitar (regras atuais: `SUBMITTED`, não ser o próprio submitter; senão o
  aviso "Você enviou este pagamento…").

### 6. Revisão de pagamentos — `src/modules/invoices/ReviewPaymentsPage.tsx`

- Cabeçalho + "Atualizar"; banner info "A fila atualiza sozinha a cada 30 segundos…" (mantém o
  `refetchInterval` atual).
- Filtros compactos (busca, competência, método, período).
- **Cartões agrupados por fatura:** cabeçalho (Fatura {mês} · imóvel · profissão·CPF · Saldo à
  direita) e, por pagamento: ícone do método + **valor serifado** + método/data; "Ver
  comprovante" ou "Sem comprovante digital"; botões **Rejeitar** (contorno vermelho) / **Aprovar**
  (verde cheio), ou o aviso "Você enviou este pagamento…" quando for o próprio.

### 7. Contratos / Locatários / Imóveis / Usuários (listas)

Mesmo padrão de lista da tela 4 (toolbar + tabela + rodapé), páginas:
`ContractsPage.tsx`, `TenantsPage.tsx`, `PropertiesPage.tsx`, `UsersPage.tsx`.

- **Contratos:** Contrato (imóvel + profissão·CPF) · Vigência · Aluguel (dir.) · Situação. Chips
  de status (Todos/Ativos/Expirados/Encerrados); avançados (UUID locatário/imóvel) recolhidos;
  "Novo contrato" primário. Linha → detalhe (`ContractDetailPage.tsx`; ID técnico em "Dados
  técnicos", ações de renovação inalteradas).
- **Locatários:** avatar (inicial) + profissão + `CPF •••` · Estado civil · Contato (e-mail/tel
  mascarados) · chevron. Busca + estado civil; "Novo locatário".
- **Imóveis:** ícone por tipo + Bairro + Unidade · Tipo · Cadastro. Busca + tipo; "Novo imóvel".
- **Usuários:** avatar + e-mail · Papel (ícone) · Estado (chip Ativo/Inativo) · "Alterar acesso"
  (abre o `UserAccessDialog` atual). "Novo usuário".

### 8. Formulário (ex.: Novo locatário) — `src/modules/tenants/NewTenantPage.tsx`

- Cartão (máx. ~960px) com **seções** ("Identificação", "Contato" — rótulos em maiúsculas teal),
  campos em grid de 2 colunas (auto-fit minmax 240px), helper "O RG não será exibido após o
  cadastro". Rodapé: Cancelar (texto) + "Cadastrar locatário" (primário). Mantenha o schema
  Zod/React Hook Form e o fluxo de mutação atuais. Aplique o mesmo padrão aos demais "Novo*".

---

## Interactions & Behavior

- **Nenhuma mudança de comportamento.** Navegação, permissões por papel, filtros remotos via
  querystring, paginação, `useQuery`/`useMutation`, submissão idempotente de pagamento,
  renovação de contrato, exportação CSV, notificações com polling de 30s e restauração de sessão
  **permanecem idênticos**. Somente a apresentação muda.
- Linha de tabela inteira clicável leva ao detalhe (hoje só o link/botão "Abrir").
- Chips de status = filtro de status em 1 clique (equivalente ao `Select` atual).
- "Filtros avançados" apenas recolhe controles que já existem (não remove funcionalidade).
- Hover de linha: fundo `#FBFAF6`. Foco visível: manter o outline de acessibilidade atual.

## State Management

Sem novos requisitos. Reutilize `useAuth`, `queryKeys`, os `*Api` por módulo e o padrão de
filtros em `useSearchParams`. Se as seções "Precisa de atenção"/"Atividade recente" do dashboard
não tiverem dados prontos, derive do summary/notificações ou omita — não invente endpoints.

## Design Tokens

Ver a seção "Sistema de Design" acima (cores, status, fontes, raios, sombras, espaçamento).
Recomendação: centralizar no `theme.ts` (paleta + tipografia + `components` overrides) e usar
`sx`/`styled` — evite CSS avulso. Os `color-mix` do protótipo podem virar hex fixos (listados).

## Assets

- **Ícones:** usar `@mui/icons-material` (já no projeto). Mapa protótipo → sugestão MUI:
  `grid_view`→`GridViewOutlined` (Visão geral); `receipt_long`→`ReceiptLongOutlined` (Faturas);
  `fact_check`→`FactCheckOutlined` (Revisão); `description`→`DescriptionOutlined` (Contratos);
  `group`→`PeopleAltOutlined` (Locatários); `home_work`→`HomeWorkOutlined` (Imóveis);
  `manage_accounts`→`ManageAccountsOutlined` (Usuários); `apartment`→`ApartmentOutlined` (logo);
  `notifications`→`NotificationsOutlined`; `qr_code_2`→`QrCode2Outlined` (PIX);
  `account_balance`→`AccountBalanceOutlined` (transferência); `payments`→`PaymentsOutlined`
  (dinheiro). Para o toggle "PIX", note que o glifo `pix` não existe no Material Symbols padrão —
  use `QrCode2` (ou a marca oficial do PIX como SVG, se desejarem).
- **Fontes:** Newsreader, Hanken Grotesk, IBM Plex Mono (Google Fonts). Respeite a CSP do
  `index.html` — hoje `font-src 'self' data:`; se hospedar as fontes localmente, mantenha assim,
  ou ajuste a CSP conscientemente.
- Sem imagens; avatares são iniciais em círculo. Nenhuma marca de terceiros.

## Files

Neste pacote:

- `tenancy-ledger.dc.html` — **protótipo hi-fi da proposta** (todas as telas, navegável).
- `atual-tenancy-ledger.dc.html` — recriação do estado **atual** (referência "antes").

No codebase (arquivos a atualizar, camada de apresentação):

- `src/app/theme/theme.ts` (tema claro fixo, nova paleta/tipografia) — e remover
  `src/app/theme/ThemePreferenceContext.tsx`, `src/components/settings/ThemePreferenceMenu.tsx`.
- `src/layouts/AppShell.tsx`, `src/layouts/AuthLayout.tsx`.
- `src/components/data-display/*` (PageHeader, StatusChip, PaginationBar), `feedback/*`.
- `src/modules/{auth,dashboard,invoices,contracts,tenants,properties,users,notifications}/*`.

## Observações

- É hi-fi: recrie fiel, mas usando MUI/`sx`, não copiando o HTML.
- Acessibilidade: preserve labels, foco visível, alvos ≥44px e navegação por teclado atuais.
- O protótipo tem 2 "tweaks" (cor de destaque e títulos serifados/sem serifa) só para
  exploração — não precisam ir para produção; escolha um valor final (teal + serifada).
