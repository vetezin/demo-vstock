async (initialPage) => {
  const browser = initialPage.context().browser();
  const origin = 'http://127.0.0.1:8765';
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const evidence = [];
  const visualFailures = [];

  async function withPage(viewport, run) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await run(page);
    } finally {
      await context.close();
    }
  }

  for (const width of [390, 1366]) {
    await withPage({ width, height: 844 }, async (page) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/cadastro-cliente.html`);
      await page.waitForSelector('#tabelaClientes tbody tr');

      // 1. Funcionalidade: dados carregam na tabela
      const initialRowCount = await page.locator('#tabelaClientes tbody tr').count();
      assert(initialRowCount > 0, 'Tabela de clientes não renderizou linhas iniciais');

      // 2. Identificação com nome e contato na linha da tabela
      const firstRowName = (await page.locator('#tabelaClientes tbody tr td:nth-child(1)').first().textContent()).trim();
      const firstRowDoc = (await page.locator('#tabelaClientes tbody tr td:nth-child(2)').first().textContent()).trim();
      const firstRowPhone = (await page.locator('#tabelaClientes tbody tr td:nth-child(3)').first().textContent()).trim();
      assert(firstRowName.length > 0 && firstRowName !== '-', 'Nome do cliente não identificado na primeira linha');
      assert(firstRowDoc.length > 0 && firstRowPhone.length > 0, 'Colunas de contato (documento/telefone) ausentes na linha');

      // Ações na linha existem
      const editBtn = page.locator('#tabelaClientes tbody tr button[data-acao="editar"]').first();
      const statusBtn = page.locator('#tabelaClientes tbody tr button[data-acao="status"]').first();
      assert(await editBtn.count() > 0, 'Botão de editar cliente não encontrado na linha');
      assert(await statusBtn.count() > 0, 'Botão de status cliente não encontrado na linha');

      // 3. Busca por nome em faixa própria preserva paginação e ações
      await page.fill('#filtroNomeCliente', firstRowName);
      await page.waitForTimeout(100);
      const filteredByNameCount = await page.locator('#tabelaClientes tbody tr').count();
      assert(filteredByNameCount > 0 && filteredByNameCount <= initialRowCount, 'Filtro por nome não filtrou a tabela');
      assert(await page.locator('#tabelaClientes tbody tr button[data-acao="editar"]').first().isVisible(), 'Ação de editar não preservada após filtro');
      assert(await page.locator('#paginacaoClientes').isVisible(), 'Paginação não preservada após filtro');

      // Limpar filtro por nome
      await page.fill('#filtroNomeCliente', '');
      await page.waitForTimeout(100);
      assert(await page.locator('#tabelaClientes tbody tr').count() === initialRowCount, 'Limpar filtro de nome não restaurou listagem');

      // 4. Busca por documento
      const docToFilter = firstRowDoc !== '-' ? firstRowDoc.replace(/\D/g, '') : '12345678909';
      await page.fill('#filtroCpfCliente', docToFilter);
      await page.waitForTimeout(100);
      const filteredByDocCount = await page.locator('#tabelaClientes tbody tr').count();
      assert(filteredByDocCount <= initialRowCount, 'Filtro por CPF não funcionou');
      await page.fill('#filtroCpfCliente', '');
      await page.waitForTimeout(100);
      assert(await page.locator('#tabelaClientes tbody tr').count() === initialRowCount, 'Limpar filtro de CPF não restaurou listagem');

      // 5. Testar interação de ação: abrir edição popula formulário
      await editBtn.click();
      await page.waitForTimeout(100);
      const nomeInputVal = await page.inputValue('#nome');
      assert(nomeInputVal === firstRowName, `Edição não preencheu campo nome: esperado "${firstRowName}", obtido "${nomeInputVal}"`);

      // Limpar/cancelar edição
      await page.click('#btnCancelarEdicao, #btnLimpar');
      await page.waitForTimeout(50);

      // 6. Aceitação Visual e Composição
      const layout = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const bgColor = bodyStyle.backgroundColor;
        const hasRefreshClass = document.body.classList.contains('vstock-refresh');

        // Busca em faixa própria (card/section de busca dedicada)
        const searchStrip = document.querySelector('.cliente-busca-faixa, [aria-label="Busca de clientes"], section.card:has(#filtroNomeCliente)');
        const tableSection = document.querySelector('.vs-data-region, [aria-label="Clientes cadastrados"], .card:has(#tabelaClientes)');
        const formSection = document.querySelector('[aria-label="Formulário de cliente"], .card:has(#clienteForm)');
        const heading = document.querySelector('h1');
        const content = document.querySelector('.content, main, .page-content');
        const h1Elements = Array.from(document.querySelectorAll('h1'));

        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
        const searchTop = top(searchStrip);
        const tableTop = top(tableSection);

        // Busca em faixa própria deve ser elemento separado da tabela e visualmente/DOM antes da tabela
        const dedicatedSearchStrip = Boolean(searchStrip && tableSection && searchStrip !== tableSection);
        const searchPrecedesTable = Boolean(searchStrip && tableSection && (searchStrip.compareDocumentPosition(tableSection) & Node.DOCUMENT_POSITION_FOLLOWING));
        const searchVisuallyAbove = Boolean(searchTop !== null && tableTop !== null && searchTop < tableTop);

        // Validação h1 único no conteúdo
        const h1Count = h1Elements.length;
        const singleH1InContent = h1Count === 1 && Boolean(heading && content && content.contains(heading) && heading.getBoundingClientRect().height > 0);

        // Sem overflow horizontal
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasRefreshClass,
          bgColor,
          dedicatedSearchStrip,
          searchPrecedesTable,
          searchVisuallyAbove,
          h1Count,
          singleH1InContent,
          overflow,
        };
      });

      if (
        !layout.hasRefreshClass ||
        !layout.dedicatedSearchStrip ||
        !layout.searchPrecedesTable ||
        !layout.searchVisuallyAbove ||
        !layout.singleH1InContent ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, rowCount: initialRowCount, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-cliente.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
