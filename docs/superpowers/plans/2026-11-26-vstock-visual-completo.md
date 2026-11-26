# VStock Visual Completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovar a aparência e a organização das 24 páginas do VStock, sem alterar seus fluxos.

**Architecture:** A sessão principal cuida de navegação, tokens e componentes em `css/visual-completo.css` e `js/principal.js`. Um agente Sol 6.2 High (`ninerouter/codex#high`) por HTML, com CSS local isolado apenas se necessário; integração, validação e commits centralizados.

**Tech Stack:** HTML estático, CSS, JavaScript, Bootstrap 5.3.2, ambiente de demonstração com dados mockados, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-11-26-vstock-visual-completo-design.md`

## Global Constraints

- Trabalhar em `redesign/visual-completo`, no diretório original; sem worktree, sem merge na `main`.
- Marfim `#F7F4EC` no fundo, branco `#FFFFFF` nas superfícies, tinta `#21353A`, petróleo `#0F6A73` e azul `#74AED6`. Manter `--brand-*` e logotipo por empresa. Estados críticos com texto e cores próprias; não usar azul claro como texto em branco.
- Títulos em `Bahnschrift, 'Segoe UI', system-ui, sans-serif`, texto em `'Segoe UI', system-ui, sans-serif`; números tabulares. Sem fonte externa ou dependências novas. Assinatura: etiquetas de prateleira, com texto e borda curta em estados de estoque/processo; não decorar toda seção com etiqueta.
- Preservar IDs, atributos `data-*`, classes utilizadas por JS, formulários, modais, vínculos, navegação, dados, autorizações, APIs, impressão e persistência. Não usar botões falsos. Nomes de módulos e marca continuam.
- Colocar `css/visual-completo.css?v=1` depois dos CSS existentes, antes do eventual CSS local novo; adicionar `vstock-refresh` ao `body`, sem remover classes existentes. Em login e empresa também adicionar `vstock-access`. As classes de estilo comuns são opt-in: `vs-heading`, `vs-kicker` (somente quando informa o módulo), `vs-panel`, `vs-actions`, `vs-data-region`, `vs-tag`. Cada rota só altera seu HTML e, se necessário, um CSS exclusivo; nenhum agente escreve JS compartilhado, testa em armazenamento de outro agente, cria branch/worktree ou usa staging/commit/push.
- Não publicar ou alterar configurações de Pages sem confirmar destino separado. Branch deve ser a fonte única da prévia; não trocar a fonte da URL atual. URLs internas continuam relativas, inclusive os recursos carregados pelo mock.

## Review Focus

- Celular com preferências desktop recolhidas: menu inicia fechado; abrir/fechar não altera `vstockSidebarCollapsed`; foco volta ao gatilho após Escape. Teste da base.
- Empresa com tema longo e operador com módulos restritos: topo não transborda e não expõe atalhos sem permissão. Teste integrado em Início, Estoque e Administração.
- Tabela com descrição longa: só a região de tabela rola horizontalmente e filtros/ações continuam na tela. Teste de Estoque e as demais listas.
- PDV com pagamento dividido ou código de barras: valores vêm do mesmo DOM/controladores; o atalho móvel não esconde a confirmação. Teste do PDV e Caixa.
- Comprovante e ordem de serviço no modo de impressão: conteúdo atual aparece e elementos novos de tela não imprimem. Testes dos históricos e OS.

## Base compartilhada e verificação

### Tarefa 0: Navegação e linguagem visual

**Arquivos:** criar `css/visual-completo.css` e `tests/visual-completo.pw.js`; modificar `js/principal.js` só na interface de navegação/tema. A página piloto consome o CSS quando seu agente adiciona a referência. Não tocar nos HTMLs de outros agentes.

- [ ] Teste red: no Playwright, Estoque em `390×844` e `768×900`, após renderização: título no primeiro viewport (topo < 260 px), documento com no máximo 1 px de transbordo, menu invisível na inicialização, botão acessível; Enter abre o menu e move foco para o conteúdo do menu, Escape fecha e devolve foco, clique fora fecha, ausência de escrita de preferência desktop no modo móvel.
- [ ] Implementar a folha de estilos de opt-in. Desktop: superfícies e navegação claras, logo atual e item ativo em destaque, preservar recolhimento existente. Celular (≤768): levar a navegação a painel sobreposto com rolagem própria, topo em uma fileira (logo, menu e conta), sem ocultar a conta. Modal Bootstrap e impressão continuam independentes. Respeitar `prefers-reduced-motion`.
- [ ] Testar desktop (1280/1366 px): recolhimento persiste entre rotas e controles/links continuam acessíveis; alternar largura com menu aberto não prende rolagem ou foco. Isolar cada teste via `browser.newContext()`.

### Tarefas 1–24: uma página por agente

Para **cada** tarefa:

1. [ ] Registrar em `tests/pages/<nome>.pw.js` uma asserção observável da coluna aceitação e executar contra `http://127.0.0.1:8765/<rota>`. Confirmar red do objetivo visual; a parte de preservação da interação deve manter o comportamento de referência. Arquivos são funções Playwright executáveis via `browser_run_code_unsafe({ filename: ... })`.
2. [ ] Implementar o arranjo da linha em `<rota>`; apenas se necessário, editar CSS comprovadamente exclusivo ou criar `css/<nome>-visual.css` (não editar `caixa.css`, `cadastro-base.css`, `estoque-geral.css`, `entrada-compra.css` ou `estoque-paginas.css`, pois são compartilhados). Conferir `git diff --check -- <arquivos próprios>`.
3. [ ] Reexecutar Playwright em 390 e 1366 px. A rota mostra a ação/identificação da linha, sem transbordo da página ou quebra da interação de referência. Entregar arquivos, evidência red/green e qualquer limitação. O controlador revisa cada diff, integra e commita; não há `git add` pelos agentes.

| Tarefa | Rota / proprietário exclusivo | Composição e aceitação específica |
|---|---|---|
| 1 | `index.html` | Central de operação: `Acessos rápidos` e alertas (quando presentes) têm precedência visual e no DOM sobre `Indicadores principais` e `Gráficos principais`. Mover atalhos existentes e respeitar disponibilidade de módulo; manter todos os dados e SVGs. Título no conteúdo e topo comum, preservando `dashboard-topbar` e slot de conta. |
| 2 | `estoque.html` | Busca e filtros antes do resumo numérico; saldo tabular, etiquetas com texto. Aplicar/limpar filtro muda/restaura a listagem e link de produto preserva `historico.html?produto=`. |
| 3 | `vendas.html` | Venda rápida com catálogo/carrinho; em 390 px, atalho de carrinho leva ao carrinho e mostra o total existente, sem dois estados de preço. Finalizar dentro do carrinho; Mesas preservado. Buscar e adicionar um produto muda `#pdvCartCount` e `#pdvTotal`; trocar para Mesas não mostra o atalho de Venda rápida. |
| 4 | `cadastro-categoria.html` | Formulário compacto e listagem separada, formulário e filtro acessíveis em 390 px. Filtrar categoria e limpar recupera resultados. |
| 5 | `cadastro-cliente.html` | Identificação com nome e contato; busca por nome ou documento em faixa própria. Filtrar cliente preserva paginação e ações da linha. |
| 6 | `cadastro-fornecedor.html` | Identidade e contato em grupos; lista abaixo com nome e contato legíveis. Aplicar e limpar filtro de nome. |
| 7 | `cadastro-funcionario.html` | Identidade antes de acesso e senha, opções e ajuda mantidas. Salvar fica ligado ao mesmo formulário; filtro e acesso admin não mudam. |
| 8 | `cadastro-produto.html` | Ficha de produto com identificação, controle de estoque e preço; catálogo e busca próprios. Filtrar e iniciar edição preserva valor, mínimo e código, sem persistir alteração no teste. |
| 9 | `alertas.html` | Ocorrências primeiro: texto de severidade e faixas de filtros. Situação filtrada e estado vazio/limpar testados sem mudança de classificação. |
| 10 | `entrada-compra.html` | Dados da entrada, incluir item, conferir e registrar; histórico em área própria. Digitar código com Enter conserva adição e totais; botão de novo fornecedor continua abrindo o modal. |
| 11 | `saida-estoque.html` | Dados da saída, incluir item, conferir e registrar; saldo disponível ao lado da quantidade; motivo e observação mantidos. Ao adicionar item, a contagem muda; observação abre modal. |
| 12 | `historico.html` | Linha do tempo, filtros e paginação. Abrir com `?produto=` preenche o filtro; alterar tipo preserva continuidade da consulta. |
| 13 | `caixa.html` | Prioridade ao estado da sessão e à ação válida, com saldo esperado legível. Abrir caixa e registrar movimento em contexto isolado, e verificar atualização do saldo e topo; não mudar cálculo. |
| 14 | `historico-caixa.html` | Busca, sessões e estado de conferência; detalhe como comprovante. Abrir detalhe e conferir valores/ação de impressão; nova moldura não aparece em print. |
| 15 | `historico-vendas.html` | Acompanhamento por período/estado; detalhe com itens e totais. Aplicar filtro e abrir venda; cancelamento continua com seus passos originais. |
| 16 | `cadastro-oficina-veiculos.html` | Ficha com placa/modelo em destaque e vínculo ao cliente; atalho para histórico existente. Filtrar e abrir histórico preserva identificação do veículo e fechamento por Escape. |
| 17 | `cadastro-oficina-servicos.html` | Serviço, categoria e valor em ficha curta; busca na lista. Disparar cadastro rápido de categoria e fechar sem salvar. |
| 18 | `cadastro-oficina-orcamento.html` | Identificar cliente/veículo, diagnóstico, itens e valores nessa ordem. Abrir catálogo, incluir item e conferir total; manter formulário de orçamento. |
| 19 | `visualizar-oficina-orcamentos.html` | Lista legível por situação; detalhe como proposta, valor e próxima ação válida. Abrir modal e verificar diagnóstico e total na mesma ordem lógica. |
| 20 | `visualizar-oficina-ordens-servico.html` | Identificação, etapa e ação nas fichas; diagnóstico, execução, itens, valores e impressão mantidos. Abrir ordem, conferir ação/estado e `#osDocumentoImpressao` em modo print. |
| 21 | `admin.html` | Backup separado visualmente da consulta de logs; filtros e tabela de auditoria em região própria. Filtrar logs sem iniciar download nem limpeza; acesso continua limitado. |
| 22 | `parametrizacao.html` | Empresa e módulos claramente separados; abas com rótulos legíveis, indicadores de estado e ações existentes. Alternar abas e verificar vínculo painel/aba sem salvar. |
| 23 | `empresa.html` | Acesso claro com marca, busca primeiro, resultado como ficha e erro perto do campo. Busca do e-mail da empresa de demonstração renderiza `#empresaResultado` ou mantém o erro original da demo (registrar baseline). |
| 24 | `login.html` | Marca e formulário claros; licença e mensagens preservadas. Validar composição em contexto que bloqueia só `js/login.js` e redirecionamento de `login.html` para `index.html` no fluxo real sem bloqueio. |

### Tarefa 25: Integração da branch

- [ ] Conferir 24 páginas: código válido, títulos/foco, links, acessibilidade dos formulários, saída de impressão, Chrome nos quatro tamanhos e regressões da demo. Comparar erros de console com baseline antes de chamar algo de regressão.
- [ ] Revisão por tarefa (contratos e qualidade) e revisão do diff completo. Corrigir problemas da mudança antes do commit local; verificar `git diff --check`, diferença com `main`, inventário de rotas e estado de git; `main` deve permanecer no SHA inicial.
- [ ] Publicação: depois de confirmação inequívoca de destino e autorização de push, publicar apenas o snapshot da branch. Validar o HTML servido e um marcador verificável da revisão; enviar somente o link da prévia, sem substituir a demo. Nunca inventar o link ou apresentar localhost como Pages.
