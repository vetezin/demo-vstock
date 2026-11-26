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
      await page.goto(`${origin}/visualizar-oficina-orcamentos.html`);
      await page.waitForSelector('#tabelaOrcamentosBody tr', { timeout: 10000 });

      const initialRows = await page.locator('#tabelaOrcamentosBody tr').count();
      assert(initialRows > 0, `Nenhum orçamento carregado em ${width}px`);

      // Lista legível por situação: cada linha tem número, data, cliente/veículo e status legível
      const firstRowNumero = (await page.locator('#tabelaOrcamentosBody tr td:nth-child(1)').first().textContent() || '').trim();
      const firstRowData = (await page.locator('#tabelaOrcamentosBody tr td:nth-child(2)').first().textContent() || '').trim();
      const firstRowCliente = (await page.locator('#tabelaOrcamentosBody tr td:nth-child(3)').first().textContent() || '').trim();
      const firstRowStatus = (await page.locator('#tabelaOrcamentosBody tr .orcamento-status').first().textContent() || '').trim();
      assert(firstRowNumero.length > 0, `Número do orçamento ausente em ${width}px`);
      assert(firstRowData.length > 0, `Data de criação ausente em ${width}px`);
      assert(firstRowCliente.length > 0, `Cliente/veículo ausente em ${width}px`);
      assert(firstRowStatus.length > 0 && firstRowStatus !== '-', `Status ilegível na lista em ${width}px: "${firstRowStatus}"`);

      // Filtro por situação (usa um status válido existente nos dados)
      const statusFiltro = 'APROVADO';
      await page.selectOption('#filtroOrcamentoStatus', statusFiltro);
      await page.waitForTimeout(200);
      const filteredRows = await page.locator('#tabelaOrcamentosBody tr').count();
      assert(filteredRows > 0, `Filtro por situação não retornou linhas em ${width}px`);
      const filteredStatuses = await page.locator('#tabelaOrcamentosBody .orcamento-status').allTextContents();
      assert(filteredStatuses.every((s) => s.trim().toLowerCase() === 'aprovado'), `Filtro por situação inconsistente em ${width}px`);

      // Limpar filtro
      await page.click('#btnLimparFiltrosOrcamento');
      await page.waitForTimeout(200);
      const restoredRows = await page.locator('#tabelaOrcamentosBody tr').count();
      assert(restoredRows === initialRows, `Limpar filtro não restaurou orçamentos (${restoredRows} vs ${initialRows}) em ${width}px`);

      // Abrir modal do primeiro orçamento
      const firstVerBtn = page.locator('#tabelaOrcamentosBody button[data-ver-orcamento]').first();
      const firstId = await firstVerBtn.getAttribute('data-ver-orcamento');
      await firstVerBtn.click();
      await page.waitForSelector('#modalDetalheOrcamento.show', { state: 'visible', timeout: 5000 });
      const modalVisible = await page.locator('#modalDetalheOrcamento').isVisible();
      assert(modalVisible, `Modal de detalhe não abriu em ${width}px`);

      const diagnostico = (await page.locator('#detalheOrcamentoDiagnostico').textContent() || '').trim();
      const total = (await page.locator('#detalheOrcamentoTotal').textContent() || '').trim();
      assert(diagnostico.length > 0 && diagnostico !== '-', `Diagnóstico ausente no modal em ${width}px`);
      assert(total.length > 0 && total !== 'R$ 0,00', `Total inválido no modal em ${width}px: ${total}`);

      // Ordem lógica: diagnóstico antes do total no DOM
      const ordemOk = await page.evaluate(() => {
        const diag = document.querySelector('#detalheOrcamentoDiagnostico');
        const tot = document.querySelector('#detalheOrcamentoTotal');
        if (!diag || !tot) return false;
        return (diag.compareDocumentPosition(tot) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });
      assert(ordemOk, `Diagnóstico não precede total na ordem lógica em ${width}px`);

      // Próxima ação válida: pendente tem ações; demais não
      const statusModal = (await page.locator('#detalheOrcamentoStatus').textContent() || '').trim().toLowerCase();
      const acoesCount = await page.locator('#acoesOrcamento button').count();
      if (statusModal.includes('pendente')) {
        assert(acoesCount >= 1, `Orçamento pendente sem próxima ação em ${width}px`);
      } else {
        assert(acoesCount === 0, `Orçamento não pendente não deve ter ações em ${width}px`);
      }

      await page.locator('#modalDetalheOrcamento [data-bs-dismiss="modal"]').first().click();
      await page.locator('#modalDetalheOrcamento').waitFor({ state: 'hidden', timeout: 5000 });

      // Layout
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(topbarMain && topbarPageIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span');

        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const mainContent = document.querySelector('main, .page-content, .content');
        const singleH1InContent = h1Count === 1 &&
          Boolean(mainContent && headingsH1[0] && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        const valueEl = document.querySelector('#detalheOrcamentoTotal');
        const valueStyle = valueEl ? window.getComputedStyle(valueEl) : null;
        const isTabular = Boolean(
          valueStyle && (
            valueStyle.fontVariantNumeric.includes('tabular-nums') ||
            valueStyle.fontFeatureSettings.includes('tnum') ||
            window.getComputedStyle(document.body).fontVariantNumeric.includes('tabular-nums') ||
            window.getComputedStyle(document.body).fontFeatureSettings.includes('tnum')
          )
        );

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          isTabular,
          overflow,
        };
      });

      if (
        !layout.hasVstockRefresh ||
        !layout.hasVisualCompletoCss ||
        !layout.hasTopbarNavbarContract ||
        !layout.singleH1InContent ||
        !layout.isTabular ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, initialRows, filteredRows, restoredRows, diagnostico, total });
    });
  }

  assert(!visualFailures.length, `Aceitação visual visualizar-oficina-orcamentos.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}