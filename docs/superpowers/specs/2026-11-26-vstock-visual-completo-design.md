# VStock — design da refatoração visual completa

## Objetivo

Refazer a linguagem visual das 24 páginas do VStock para que o sistema pareça um produto renovado, claro e acolhedor, sem perder o reconhecimento da marca nem tornar a operação um painel analítico. Preservar logotipo, tema por empresa, nomenclatura dos módulos e fluxos existentes.

## Abordagens consideradas

- **Ajuste incremental da interface atual:** menor risco, mas não entrega a mudança de composição pedida.
- **Aplicar um tema pronto:** acelera a padronização, mas tende a trocar uma aparência genérica por outra e não resolve as diferenças entre PDV, estoque e oficina.
- **Identidade visual própria para o sistema inteiro:** criar uma linguagem compartilhada e organizar cada família de telas em torno do trabalho que ela atende. Manter HTML, CSS, JavaScript e Bootstrap atuais. O formato de balcão fica no PDV, não no sistema inteiro.

## Identidade e comportamento visual

- Marfim `#F7F4EC` no fundo, branco nas superfícies, tinta `#21353A`, petróleo VStock como destaque padrão (`#0F6A73`) e azul `#74AED6` em detalhes. Usar os tokens de marca existentes para a personalização por empresa; estados críticos têm cores próprias, contraste e texto.
- Usar etiquetas inspiradas em prateleiras para status, divisórias finas, contraste legível e menos molduras. Não impor a mesma grade ou a mesma densidade a todas as telas.
- Topo e navegação compartilhados, com conteúdo primeiro no celular e menu sob demanda. Manter acesso por teclado, foco visível, Escape no menu sobreposto, estados atuais dos grupos, regras de módulo/perfil e acesso à conta.

## Cobertura e propriedade

Um agente Sol 6.2 High por HTML, na mesma branch `redesign/visual-completo`. Cada agente só altera seu HTML e, se necessário, CSS exclusivo da rota. A sessão principal mantém o CSS compartilhado e o comportamento de navegação em `js/principal.js`, integra os resultados e valida. Sem worktrees adicionais e sem edição ou merge na `main`.

| Família | Páginas | Formato |
|---|---|---|
| Início | `index.html` | Central de operação: ações e pendências antes dos indicadores e gráficos; manter dados e gráficos existentes. |
| Cadastros | `cadastro-categoria.html`, `cadastro-cliente.html`, `cadastro-fornecedor.html`, `cadastro-funcionario.html`, `cadastro-produto.html` | Título e ação claros; formulário, filtros e listagem com hierarquia distinta. Preservar paginação, edição e ações de estado. |
| Estoque | `estoque.html`, `alertas.html`, `entrada-compra.html`, `saida-estoque.html`, `historico.html` | Consulta com busca, tabela e etiquetas; entrada e saída com etapas e totais claros; histórico como linha do tempo. Detalhe lateral apenas se possível com conteúdo e ações já existentes, sem criar regra ou API. |
| Vendas e caixa | `vendas.html`, `caixa.html`, `historico-caixa.html`, `historico-vendas.html` | PDV com catálogo e carrinho lado a lado onde houver espaço, total e ação final sempre à mão sem cobrir controles. No celular, atalho para o carrinho com total visível; finalizar dentro do carrinho. Manter Venda rápida e Mesas. Caixa e históricos com valores fáceis de conferir. |
| Oficina | `cadastro-oficina-veiculos.html`, `cadastro-oficina-servicos.html`, `cadastro-oficina-orcamento.html`, `visualizar-oficina-orcamentos.html`, `visualizar-oficina-ordens-servico.html` | Ficha de serviço: identificação e status primeiro; diagnóstico, itens e valores depois; evidenciar a próxima ação válida e manter impressão. |
| Sistema e acesso | `admin.html`, `parametrizacao.html`, `empresa.html`, `login.html` | Formulários e administração na nova linguagem; manter abas, dados e ações. Preservar redirecionamento do login na demo. |

## Restrições e verificação

- Não reescrever regras de negócio, dados de exemplo, APIs ou persistência. Preservar IDs, nomes de campos, seletores usados por JS, eventos Bootstrap, navegação, código de barras, pagamentos, comprovantes e impressão.
- Conferir as 24 rotas, consistência visual, navegação e excesso horizontal em desktop e celular. Validar interações representativas de estoque, venda, caixa, oficina, formulários e impressão com dados da demo isolados do site atual.
- Fazer revisão integrada antes do commit final. Não anunciar deploy ou link sem verificar que ele carrega o commit da branch.
- Publicação ainda a decidir: GitHub Pages fornece um site por repositório. A URL pública atual de `demo-vstock` vem da `main`. Não trocar essa origem; para um segundo link `github.io`, usar um repositório de prévia separado mediante autorização. Nenhuma publicação antes dessa definição.
