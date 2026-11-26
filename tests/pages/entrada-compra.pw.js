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
      await page.goto(`${origin}/entrada-compra.html`);
      await page.waitForFunction(() => document.querySelectorAll('#fornecedorDireto option:not([disabled])').length > 0);
      await page.waitForSelector('#tabelaCompras tbody');

      // 1. Botão de novo fornecedor abre o modal
      await page.click('#btnNovoFornecedor');
      await page.waitForSelector('#modalNovoFornecedor.show', { state: 'visible', timeout: 5000 });
      const modalAberto = await page.locator('#modalNovoFornecedor').isVisible();
      assert(modalAberto, `Modal novo fornecedor não abriu em ${width}px`);
      await page.locator('#modalNovoFornecedor [data-bs-dismiss="modal"]').first().click();
      await page.locator('#modalNovoFornecedor').waitFor({ state: 'hidden', timeout: 5000 });

      // 2. Digitar código de barras com Enter localiza produto, preenche dados e conserva adição + totais
      await page.fill('#codigoBarrasCompra', '78910000000001');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);

      const produtoNome = await page.inputValue('#buscaProdutoCompra');
      assert(produtoNome.includes('Produto 01'), `Produto não identificado pelo código de barras em ${width}px: "${produtoNome}"`);
      const qtdInicial = await page.inputValue('#quantidade');
      assert(qtdInicial === '1', `Quantidade após leitura de código deveria ser 1, obteve "${qtdInicial}"`);

      await page.fill('#valorTotalItem', '12,20');
      await page.click('#btnAddItem');
      await page.waitForTimeout(150);

      const itensCount = await page.locator('#tabelaItens tbody tr').count();
      assert(itensCount === 1, `Esperava 1 item na tabela após adição em ${width}px, obteve ${itensCount}`);

      const totalGeral = (await page.locator('#totalGeralCompra').textContent() || '').trim();
      assert(totalGeral === 'R$ 12,20', `Total geral divergente em ${width}px: esperado "R$ 12,20", obteve "${totalGeral}"`);

      const resumoQtd = (await page.locator('#resumoEntradaQuantidade').textContent() || '').trim();
      assert(resumoQtd === '1', `Quantidade total no resumo divergente em ${width}px: esperado "1", obteve "${resumoQtd}"`);

      const resumoValor = (await page.locator('#resumoEntradaValor').textContent() || '').trim();
      assert(resumoValor === 'R$ 12,20', `Valor total no resumo divergente em ${width}px: esperado "R$ 12,20", obteve "${resumoValor}"`);

      // 3. Histórico de entradas registradas em área própria (seção com filtros e tabela)
      const historicoArea = await page.evaluate(() => {
        const card = document.querySelector('#tabelaCompras')?.closest('.card');
        return Boolean(
          card &&
          card.querySelector('#filtroCompraProduto') &&
          card.querySelector('#paginacaoCompras') &&
          card.querySelector('#tabelaCompras')
        );
      });
      assert(historicoArea, `Área de histórico incompleta em ${width}px`);

      // 4. Verificação Estrutural e Visual
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        // Topbar contract
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(topbarMain && topbarPageIntro && topbarTitle);

        // h1 único no conteúdo
        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const singleH1InContent = h1Count === 1 &&
          Boolean(headingsH1[0].closest('main, .content, .page-content')) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        // Histórico em área própria abaixo da área de registro
        const formArea = document.querySelector('.card-entrada-unificada, .entrada-layout-grid');
        const historicoArea = document.querySelector('#tabelaCompras')?.closest('.card, .vs-panel, section');
        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
        const formTop = top(formArea);
        const historicoTop = top(historicoArea);
        const historicoEmAreaPropria = Boolean(formArea && historicoArea && formTop < historicoTop);

        // Números tabulares
        const totalCell = document.querySelector('#totalGeralCompra, #resumoEntradaValor');
        const totalStyle = totalCell ? window.getComputedStyle(totalCell) : null;
        const isTabular = totalStyle ? (
          totalStyle.fontVariantNumeric.includes('tabular-nums') ||
          window.getComputedStyle(document.body).fontFeatureSettings.includes('tnum') ||
          window.getComputedStyle(document.body).fontVariantNumeric.includes('tabular-nums') ||
          totalStyle.fontFeatureSettings.includes('tnum')
        ) : false;

        // Sem overflow horizontal
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          historicoEmAreaPropria,
          isTabular,
          overflow,
        };
      });

      if (!layout.hasVstockRefresh ||
          !layout.hasVisualCompletoCss ||
          !layout.hasTopbarNavbarContract ||
          !layout.singleH1InContent ||
          !layout.historicoEmAreaPropria ||
          !layout.isTabular ||
          layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros no console em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, totalGeral, resumoQtd });
    });
  }

  assert(!visualFailures.length, `Aceitação visual entrada-compra.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
