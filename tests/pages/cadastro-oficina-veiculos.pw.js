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
      await page.goto(`${origin}/cadastro-oficina-veiculos.html`);
      await page.waitForSelector('#tabelaVeiculos tbody tr', { timeout: 10000 });

      const initialRowCount = await page.locator('#tabelaVeiculos tbody tr').count();
      assert(initialRowCount > 0, `Nenhum veículo carregado em ${width}px`);

      const firstRowPlaca = (await page.locator('#tabelaVeiculos tbody tr td:nth-child(1)').first().textContent() || '').trim();
      const firstRowVeiculo = (await page.locator('#tabelaVeiculos tbody tr td:nth-child(2)').first().textContent() || '').trim();
      const firstRowCliente = (await page.locator('#tabelaVeiculos tbody tr td:nth-child(3)').first().textContent() || '').trim();

      assert(firstRowPlaca.length > 0 && firstRowPlaca !== '-', 'Placa não identificada na primeira linha');
      assert(firstRowVeiculo.length > 0 && firstRowVeiculo !== '-', 'Modelo/veículo não identificado na primeira linha');
      assert(firstRowCliente.length > 0 && firstRowCliente !== '-', 'Cliente não vinculado na primeira linha');

      const historyBtn = page.locator('#tabelaVeiculos tbody tr button[data-acao="historico"]').first();
      assert(await historyBtn.count() > 0, 'Atalho para histórico não encontrado na linha');

      // Filtrar por placa preserva ação de histórico
      await page.fill('#filtroVeiculo', firstRowPlaca);
      await page.dispatchEvent('#filtroVeiculo', 'input');
      await page.waitForTimeout(150);
      const filteredCount = await page.locator('#tabelaVeiculos tbody tr').count();
      assert(filteredCount > 0 && filteredCount <= initialRowCount, `Filtro por placa não funcionou em ${width}px`);

      const filteredHistoryBtn = page.locator('#tabelaVeiculos tbody tr button[data-acao="historico"]').first();
      assert(await filteredHistoryBtn.isVisible(), 'Atalho de histórico não preservado após filtro');

      // Abrir histórico preserva identificação do veículo
      await page.evaluate(() => {
        const btn = document.querySelector('#tabelaVeiculos tbody tr button[data-acao="historico"]');
        if (btn) btn.click();
      });
      await page.waitForSelector('#modalHistoricoVeiculo.show', { state: 'visible', timeout: 5000 });
      const modalVisible = await page.locator('#modalHistoricoVeiculo').isVisible();
      assert(modalVisible, `Modal de histórico não abriu em ${width}px`);

      const identificacao = (await page.locator('#historicoVeiculoIdentificacao').textContent() || '').trim();
      assert(
        identificacao.includes(firstRowPlaca) || identificacao.includes(firstRowVeiculo),
        `Identificação do veículo não preservada no histórico: "${identificacao}"`
      );

      // Fechamento por Escape
      await page.keyboard.press('Escape');
      await page.locator('#modalHistoricoVeiculo').waitFor({ state: 'hidden', timeout: 5000 });
      const modalHidden = !(await page.locator('#modalHistoricoVeiculo').isVisible());
      assert(modalHidden, `Modal de histórico não fechou com Escape em ${width}px`);

      // Restaurar listagem
      await page.fill('#filtroVeiculo', '');
      await page.dispatchEvent('#filtroVeiculo', 'input');
      await page.waitForTimeout(150);
      const restoredCount = await page.locator('#tabelaVeiculos tbody tr').count();
      assert(restoredCount === initialRowCount, `Limpar filtro não restaurou veículos (${restoredCount} vs ${initialRowCount})`);

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
        const mainContent = document.querySelector('main, .content, .page-content');
        const singleH1InContent = h1Count === 1 &&
          Boolean(mainContent && headingsH1[0] && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        const formCard = document.querySelector('#veiculoForm')?.closest('.card, .vs-panel, section');
        const listCard = document.querySelector('#tabelaVeiculos')?.closest('.card, .vs-panel, section');
        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
        const formTop = top(formCard);
        const listTop = top(listCard);
        const formBeforeList = Boolean(formCard && listCard && formTop < listTop);

        const placaInput = document.querySelector('#placa');
        const modeloInput = document.querySelector('#modelo');
        const clienteInput = document.querySelector('#clienteNome');
        const isVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const fichaCompleta = Boolean(isVisible(placaInput) && isVisible(modeloInput) && isVisible(clienteInput));

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          formBeforeList,
          fichaCompleta,
          overflow,
        };
      });

      if (
        !layout.hasVstockRefresh ||
        !layout.hasVisualCompletoCss ||
        !layout.hasTopbarNavbarContract ||
        !layout.singleH1InContent ||
        !layout.formBeforeList ||
        !layout.fichaCompleta ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, rowCount: initialRowCount, filteredCount, restoredCount });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-oficina-veiculos.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}