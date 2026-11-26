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
      await page.goto(`${origin}/cadastro-categoria.html`);
      await page.waitForSelector('#tabelaCategorias tbody tr');

      // 1. Interação e dados iniciais
      const initialRowCount = await page.locator('#tabelaCategorias tbody tr').count();
      assert(initialRowCount > 0, `Nenhuma categoria carregada em ${width}px`);

      // Obter texto da primeira categoria
      const firstRowText = (await page.locator('#tabelaCategorias tbody tr td:first-child').first().textContent() || '').trim();
      assert(firstRowText.length > 0, 'Primeira categoria não possui descrição');

      // 2. Interação com formulário e botão limpar
      await page.fill('#categoriaDescricao', 'Categoria Temporária Teste');
      assert((await page.inputValue('#categoriaDescricao')) === 'Categoria Temporária Teste', 'Campo de descrição não foi preenchido');
      await page.click('#btnLimpar');
      assert((await page.inputValue('#categoriaDescricao')) === '', 'Botão #btnLimpar não esvaziou #categoriaDescricao');

      // 2.1 Testar modo edição e cancelamento
      await page.locator('#tabelaCategorias tbody tr [data-acao="editar"]').first().click();
      assert((await page.inputValue('#categoriaDescricao')).length > 0, 'Modo edição não preencheu #categoriaDescricao');
      const tituloEditando = await page.locator('#tituloFormularioCategoria').textContent();
      assert(tituloEditando.includes('Editar Categoria'), 'Título do formulário não mudou para Editar Categoria');
      await page.click('#btnCancelarEdicao');
      assert((await page.inputValue('#categoriaDescricao')) === '', 'Cancelar edição não limpou o formulário');

      // 3. Filtrar categoria e limpar recupera resultados
      await page.fill('#filtroNomeCategoria', firstRowText);
      await page.dispatchEvent('#filtroNomeCategoria', 'input');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const filteredCount = await page.locator('#tabelaCategorias tbody tr').count();
      assert(filteredCount > 0 && filteredCount <= initialRowCount, 'Filtro por nome de categoria não filtrou corretamente');

      // Limpar filtro via botão limpar se existir ou limpando input
      const btnLimparFiltro = page.locator('#btnLimparFiltroCategoria');
      if (await btnLimparFiltro.count() > 0 && await btnLimparFiltro.isVisible()) {
        await btnLimparFiltro.click();
      } else {
        await page.fill('#filtroNomeCategoria', '');
        await page.dispatchEvent('#filtroNomeCategoria', 'input');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const restoredCount = await page.locator('#tabelaCategorias tbody tr').count();
      assert(restoredCount === initialRowCount, `Limpar filtro não restaurou listagem original (esperado ${initialRowCount}, obtido ${restoredCount})`);

      // 4. Critérios visuais e estruturais
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

        const formCard = document.querySelector('#categoriaForm')?.closest('.card, .vs-panel, section');
        const listCard = document.querySelector('#tabelaCategorias')?.closest('.card, .vs-panel, section');

        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
        const formTop = top(formCard);
        const listTop = top(listCard);
        const formBeforeList = Boolean(formCard && listCard && formTop < listTop);

        const formDescricao = document.querySelector('#categoriaDescricao');
        const btnSalvar = document.querySelector('#btnSalvarCategoria');
        const filtro = document.querySelector('#filtroNomeCategoria');

        const isVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const formAndFilterAccessible = isVisible(formDescricao) && isVisible(btnSalvar) && isVisible(filtro);

        const computedBody = window.getComputedStyle(body);
        const bgVal = computedBody.backgroundColor;
        const colorVal = computedBody.color;

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          formBeforeList,
          formAndFilterAccessible,
          overflow,
          bgVal,
          colorVal
        };
      });

      if (!layout.hasVstockRefresh ||
          !layout.hasVisualCompletoCss ||
          !layout.hasTopbarNavbarContract ||
          !layout.singleH1InContent ||
          !layout.formBeforeList ||
          !layout.formAndFilterAccessible ||
          layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros no console em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, rowCount: initialRowCount });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-categoria.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
