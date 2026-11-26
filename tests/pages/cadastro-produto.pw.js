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
      await page.goto(`${origin}/cadastro-produto.html`);
      await page.waitForSelector('#tabelaProdutos tbody tr');

      // 1. Funcionalidade: dados carregam na tabela
      const initialRowCount = await page.locator('#tabelaProdutos tbody tr').count();
      assert(initialRowCount > 0, `Nenhum produto carregado na tabela em ${width}px`);

      // Obter dados da primeira linha para verificação de preservação
      const firstRowDesc = (await page.locator('#tabelaProdutos tbody tr td:nth-child(1)').first().textContent() || '').trim();
      const firstRowCat = (await page.locator('#tabelaProdutos tbody tr td:nth-child(2)').first().textContent() || '').trim();
      const firstRowMin = (await page.locator('#tabelaProdutos tbody tr td:nth-child(3)').first().textContent() || '').trim();
      const firstRowValor = (await page.locator('#tabelaProdutos tbody tr td:nth-child(4)').first().textContent() || '').trim();
      const firstRowCodBarras = (await page.locator('#tabelaProdutos tbody tr td:nth-child(5)').first().textContent() || '').trim();

      assert(firstRowDesc.length > 0 && firstRowDesc !== '-', 'Primeira linha não possui descrição de produto válida');
      assert(firstRowMin.length > 0, 'Primeira linha não possui quantidade mínima');
      assert(firstRowValor.length > 0, 'Primeira linha não possui valor unitário');

      // 2. Filtrar produto por nome
      await page.fill('#filtroNomeProduto', firstRowDesc);
      await page.dispatchEvent('#filtroNomeProduto', 'input');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const filteredCount = await page.locator('#tabelaProdutos tbody tr').count();
      assert(filteredCount > 0 && filteredCount <= initialRowCount, 'Filtro por nome não filtrou o catálogo de produtos');

      // 3. Iniciar edição preserva valor, mínimo e código de barras, sem persistir alteração
      const editBtn = page.locator('#tabelaProdutos tbody tr [data-acao="editar"]').first();
      assert(await editBtn.count() > 0, 'Botão de editar não encontrado na linha filtrada');
      await editBtn.click();
      await page.waitForTimeout(150);

      const formDesc = await page.inputValue('#produtoDescricao');
      const formMin = await page.inputValue('#produtoQtdMin');
      const formValor = await page.inputValue('#produtoValorUnitario');
      const formCodBarras = await page.inputValue('#produtoCodigoBarras');
      const tituloForm = (await page.locator('#tituloFormularioProduto').textContent() || '');

      assert(formDesc === firstRowDesc, `Edição alterou ou não preencheu descrição: esperado "${firstRowDesc}", obtido "${formDesc}"`);
      assert(formMin === firstRowMin, `Edição alterou ou não preencheu quantidade mínima: esperado "${firstRowMin}", obtido "${formMin}"`);
      // O valor unitário na tabela pode ser formatado como "R$ 10,00" e no formulário como "10,00"
      const valorNumericoTabela = firstRowValor.replace(/[^\d]/g, '');
      const valorNumericoForm = formValor.replace(/[^\d]/g, '');
      assert(valorNumericoForm === valorNumericoTabela, `Edição alterou valor unitário: esperado dígitos "${valorNumericoTabela}", obtido "${valorNumericoForm}"`);
      if (firstRowCodBarras !== '-') {
        assert(formCodBarras === firstRowCodBarras, `Edição alterou código de barras: esperado "${firstRowCodBarras}", obtido "${formCodBarras}"`);
      }
      assert(tituloForm.includes('Editar Produto'), 'Título do formulário não indicou modo de edição');

      // Cancelar edição sem persistir
      await page.click('#btnCancelarEdicao');
      await page.waitForTimeout(100);
      assert((await page.inputValue('#produtoDescricao')) === '', 'Cancelar edição não limpou o formulário de produto');

      // 4. Restaurar listagem limpando filtro
      await page.fill('#filtroNomeProduto', '');
      await page.dispatchEvent('#filtroNomeProduto', 'input');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const restoredCount = await page.locator('#tabelaProdutos tbody tr').count();
      assert(restoredCount === initialRowCount, `Limpar filtro não restaurou produtos originais (${restoredCount} vs ${initialRowCount})`);

      // 5. Critérios visuais e estruturais
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(topbarMain && topbarPageIntro && topbarTitle);

        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const singleH1InContent = h1Count === 1 &&
          Boolean(headingsH1[0].closest('main, .content, .page-content')) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        const formCard = document.querySelector('#produtoForm')?.closest('.card, .vs-panel, section');
        const listCard = document.querySelector('#tabelaProdutos')?.closest('.card, .vs-panel, section');

        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
        const formTop = top(formCard);
        const listTop = top(listCard);
        const formBeforeList = Boolean(formCard && listCard && formTop < listTop);

        const formDescricao = document.querySelector('#produtoDescricao');
        const formCategoria = document.querySelector('#categoriaProduto');
        const formQtdMin = document.querySelector('#produtoQtdMin');
        const formValor = document.querySelector('#produtoValorUnitario');
        const formBarras = document.querySelector('#produtoCodigoBarras');
        const btnSalvar = document.querySelector('#btnSalvarProduto');
        const btnLimpar = document.querySelector('#btnLimpar');

        const isVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const fichaProdutoCompleta = Boolean(
          isVisible(formDescricao) &&
          isVisible(formCategoria) &&
          isVisible(formQtdMin) &&
          isVisible(formValor) &&
          isVisible(formBarras) &&
          isVisible(btnSalvar) &&
          isVisible(btnLimpar)
        );

        const filtroNome = document.querySelector('#filtroNomeProduto');
        const filtroCategoria = document.querySelector('#filtroCategoriaProduto');
        const filtroStatus = document.querySelector('#filtroStatusProduto');
        const catalogoBuscaAcessivel = Boolean(
          isVisible(filtroNome) &&
          isVisible(filtroCategoria) &&
          isVisible(filtroStatus)
        );

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          formBeforeList,
          fichaProdutoCompleta,
          catalogoBuscaAcessivel,
          overflow
        };
      });

      if (!layout.hasVstockRefresh ||
          !layout.hasVisualCompletoCss ||
          !layout.hasTopbarNavbarContract ||
          !layout.singleH1InContent ||
          !layout.formBeforeList ||
          !layout.fichaProdutoCompleta ||
          !layout.catalogoBuscaAcessivel ||
          layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros no console em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, rowCount: initialRowCount });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-produto.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
