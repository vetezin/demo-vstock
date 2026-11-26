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
      await page.goto(`${origin}/cadastro-oficina-servicos.html`);
      await page.waitForSelector('#tabelaServicos tbody tr', { timeout: 10000 });

      const initialRowCount = await page.locator('#tabelaServicos tbody tr').count();
      assert(initialRowCount > 0, `Nenhum serviço carregado em ${width}px`);

      const firstRowServico = (await page.locator('#tabelaServicos tbody tr td:nth-child(1)').first().textContent() || '').trim();
      const firstRowCategoria = (await page.locator('#tabelaServicos tbody tr td:nth-child(2)').first().textContent() || '').trim();
      const firstRowValor = (await page.locator('#tabelaServicos tbody tr td:nth-child(4)').first().textContent() || '').trim();

      assert(firstRowServico.length > 0 && firstRowServico !== '-', 'Serviço não identificado na primeira linha');
      assert(firstRowCategoria.length > 0 && firstRowCategoria !== '-', 'Categoria não vinculada na primeira linha');
      assert(firstRowValor.length > 0 && firstRowValor !== '-', 'Valor não identificado na primeira linha');

      // Busca na lista
      await page.fill('#filtroDescricao', firstRowServico);
      await page.dispatchEvent('#filtroDescricao', 'input');
      await page.waitForTimeout(150);
      const filteredCount = await page.locator('#tabelaServicos tbody tr').count();
      assert(filteredCount > 0 && filteredCount <= initialRowCount, `Busca na lista não funcionou em ${width}px`);

      // Restaurar listagem
      await page.fill('#filtroDescricao', '');
      await page.dispatchEvent('#filtroDescricao', 'input');
      await page.waitForTimeout(150);
      const restoredCount = await page.locator('#tabelaServicos tbody tr').count();
      assert(restoredCount === initialRowCount, `Limpar busca não restaurou serviços (${restoredCount} vs ${initialRowCount})`);

      // Disparar cadastro rápido de categoria e fechar sem salvar
      await page.click('#btnNovaCategoriaRapida');
      await page.waitForSelector('#modalCadastroRapido', { state: 'visible', timeout: 5000 });
      const modalVisible = await page.locator('#modalCadastroRapido').isVisible();
      assert(modalVisible, `Modal de cadastro rápido não abriu em ${width}px`);
      await page.keyboard.press('Escape');
      await page.locator('#modalCadastroRapido').waitFor({ state: 'hidden', timeout: 5000 });
      const modalHidden = !(await page.locator('#modalCadastroRapido').isVisible());
      assert(modalHidden, `Modal de cadastro rápido não fechou em ${width}px`);

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

        const formCard = document.querySelector('#servicoForm')?.closest('.card, .vs-panel, section');
        const listCard = document.querySelector('#tabelaServicos')?.closest('.card, .vs-panel, section');
        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
        const formTop = top(formCard);
        const listTop = top(listCard);
        const formBeforeList = Boolean(formCard && listCard && formTop < listTop);

        const descricaoInput = document.querySelector('#descricao');
        const categoriaInput = document.querySelector('#categoriaDescricao');
        const valorInput = document.querySelector('#valorServico');
        const isVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const fichaCurta = Boolean(isVisible(descricaoInput) && isVisible(categoriaInput) && isVisible(valorInput));

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          formBeforeList,
          fichaCurta,
          overflow,
        };
      });

      if (
        !layout.hasVstockRefresh ||
        !layout.hasVisualCompletoCss ||
        !layout.hasTopbarNavbarContract ||
        !layout.singleH1InContent ||
        !layout.formBeforeList ||
        !layout.fichaCurta ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, rowCount: initialRowCount, filteredCount, restoredCount });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-oficina-servicos.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}