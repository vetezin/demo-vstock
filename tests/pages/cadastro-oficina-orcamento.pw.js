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
      await page.goto(`${origin}/cadastro-oficina-orcamento.html`);
      await page.waitForSelector('#orcamentoForm');
      await page.waitForSelector('#clienteNome');
      await page.waitForTimeout(300);

      // Ordem: cliente/veículo, diagnóstico, itens, valores
      const orderOk = await page.evaluate(() => {
        const cliente = document.querySelector('#clienteNome');
        const veiculo = document.querySelector('#veiculoDescricao');
        const diagnostico = document.querySelector('#diagnostico');
        const itens = document.querySelector('#btnAbrirItens, #tabelaItens, #areaTabelaItens');
        const valores = document.querySelector('#valorTotal, #valorSubtotal, #valorDesconto');
        const nodes = [cliente, veiculo, diagnostico, itens, valores];
        if (nodes.some((n) => !n)) return { ok: false, missing: nodes.map(Boolean) };
        const pos = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        return {
          ok: pos(cliente, diagnostico) && pos(veiculo, diagnostico) && pos(diagnostico, itens) && pos(itens, valores),
          missing: nodes.map(Boolean)
        };
      });
      assert(orderOk.ok, `Ordem cliente/veículo -> diagnóstico -> itens -> valores inválida em ${width}px: ${JSON.stringify(orderOk)}`);

      // Abrir catálogo, incluir item e conferir total
      await page.click('#btnAbrirItens');
      await page.waitForSelector('#modalAdicionarItem.show', { state: 'visible', timeout: 5000 });
      await page.waitForSelector('#resultadosItens .list-group-item', { timeout: 5000 });
      const addBtn = page.locator('#resultadosItens [data-adicionar-item], #resultadosItens [data-aumentar-produto]').first();
      assert(await addBtn.count() > 0, `Nenhum item no catálogo em ${width}px`);
      await addBtn.click();
      await page.waitForTimeout(250);

      const itemCount = await page.locator('#tabelaItens tbody tr').count();
      assert(itemCount > 0, `Item não incluído no orçamento em ${width}px`);

      const totalText = (await page.locator('#valorTotal').textContent() || '').trim();
      assert(totalText !== 'R$ 0,00' && /R\$\s?\d/.test(totalText), `Total não atualizado após incluir item em ${width}px: "${totalText}"`);

      // Fechar modal catálogo
      await page.locator('#modalAdicionarItem [data-bs-dismiss="modal"]').first().click();
      await page.locator('#modalAdicionarItem').waitFor({ state: 'hidden', timeout: 5000 });

      // Manter formulário de orçamento
      const formOk = await page.evaluate(() => {
        const form = document.querySelector('#orcamentoForm');
        const fields = ['#clienteNome', '#clienteId', '#veiculoDescricao', '#veiculoId', '#funcionarioNome', '#funcionarioId', '#diagnostico', '#observacao', '#valorDesconto', '#btnSalvar', '#btnLimpar'];
        return Boolean(form) && fields.every((s) => document.querySelector(s));
      });
      assert(formOk, `Formulário de orçamento não preservado em ${width}px`);

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

        const totalStyle = window.getComputedStyle(document.querySelector('#valorTotal'));
        const bodyStyle = window.getComputedStyle(body);
        const isTabular = [totalStyle.fontVariantNumeric, totalStyle.fontFeatureSettings, bodyStyle.fontVariantNumeric, bodyStyle.fontFeatureSettings]
          .some((v) => String(v || '').includes('tabular-nums') || String(v || '').includes('tnum'));

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return { hasVstockRefresh, hasVisualCompletoCss, hasTopbarNavbarContract, h1Count, singleH1InContent, isTabular, overflow };
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
      evidence.push({ width, layout, itemCount, totalText, orderOk });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-oficina-orcamento.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
