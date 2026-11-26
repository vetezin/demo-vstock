async (initialPage) => {
  const browser = initialPage.context().browser();
  const origin = 'http://127.0.0.1:8765';
  const normalizeSpace = (str) => (str || '').replace(/\s+/g, ' ').trim();
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
      page.on('dialog', (dialog) => dialog.accept());

      await page.goto(`${origin}/caixa.html`);
      await page.waitForFunction(() => document.querySelector('#cashLoadingState')?.hidden === true, { timeout: 10000 });

      // Contexto isolado: garantir que não exista caixa aberto para testar a abertura.
      await page.evaluate(() => {
        const key = 'vstock_demo_db_v2';
        const raw = localStorage.getItem(key);
        if (raw) {
          const db = JSON.parse(raw);
          db.caixaSessoes = (db.caixaSessoes || []).map((sessao) => ({ ...sessao, status: false }));
          localStorage.setItem(key, JSON.stringify(db));
        }
      });
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#cashLoadingState')?.hidden === true, { timeout: 10000 });
      await page.waitForFunction(() => !document.querySelector('#cashOpeningSection')?.hidden, { timeout: 10000 });

      // Abrir caixa
      await page.fill('#cashOpeningAmount', '100,00');
      await page.fill('#cashOpeningNote', 'Teste de abertura');
      await page.click('#cashOpenButton');
      await page.waitForFunction(() => !document.querySelector('#cashCurrentSession')?.hidden, { timeout: 10000 });
      await page.waitForFunction(() => (document.querySelector('.app-topbar-title')?.textContent || '').includes('Caixa'), { timeout: 10000 });

      const initialBalance = normalizeSpace(await page.locator('#cashExpectedBalance').textContent());
      assert(initialBalance === 'R$ 100,00', `Saldo inicial após abertura divergente em ${width}px: ${initialBalance}`);

      const topTitle = normalizeSpace(await page.locator('.app-topbar-title').textContent());
      assert(topTitle.includes('Caixa'), `Topo não refletiu o módulo em ${width}px: "${topTitle}"`);

      // Registrar movimento (entrada)
      await page.fill('#cashMovementAmount', '10,00');
      await page.fill('#cashMovementReason', 'Reforço teste');
      await page.click('#cashMovementButton');
      await page.waitForTimeout(400);

      const updatedBalance = normalizeSpace(await page.locator('#cashExpectedBalance').textContent());
      assert(updatedBalance === 'R$ 110,00', `Saldo não atualizou após movimento em ${width}px: ${updatedBalance}`);

      const movementRows = await page.locator('#cashMovementTableBody tr').count();
      assert(movementRows >= 1, `Movimento não apareceu na tabela em ${width}px`);

      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasRefresh = body.classList.contains('vstock-refresh') && body.classList.contains('app-shell');
        const hasVisualCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some((link) => (link.getAttribute('href') || '').includes('visual-completo.css'));

        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const pageWrapper = document.querySelector('.page-wrapper, .page-content, main');
        const singleH1InContent = h1Count === 1 &&
          Boolean(pageWrapper && headingsH1[0] && pageWrapper.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarContract = Boolean(topbarMain && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span');

        const expectedEl = document.querySelector('#cashExpectedBalance');
        const expectedStyle = expectedEl ? window.getComputedStyle(expectedEl) : null;
        const isTabular = expectedStyle ? (
          expectedStyle.fontVariantNumeric.includes('tabular-nums') ||
          window.getComputedStyle(document.body).fontFeatureSettings.includes('tnum') ||
          expectedStyle.fontFeatureSettings.includes('tnum')
        ) : false;

        const sessionSection = document.querySelector('#cashCurrentSession');
        const movementTable = document.querySelector('#cashMovementTableBody');
        const priorityOrder = Boolean(sessionSection && movementTable &&
          (sessionSection.compareDocumentPosition(movementTable) & Node.DOCUMENT_POSITION_FOLLOWING));

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasRefresh,
          hasVisualCss,
          h1Count,
          singleH1InContent,
          hasTopbarContract,
          isTabular,
          priorityOrder,
          overflow,
        };
      });

      if (!layout.hasRefresh) visualFailures.push(`${width}px: body sem vstock-refresh/app-shell`);
      if (!layout.hasVisualCss) visualFailures.push(`${width}px: visual-completo.css ausente`);
      if (!layout.singleH1InContent) visualFailures.push(`${width}px: esperava 1 h1 no conteúdo, encontrou ${layout.h1Count}`);
      if (!layout.hasTopbarContract) visualFailures.push(`${width}px: topbar sem contrato span.app-topbar-title`);
      if (!layout.isTabular) visualFailures.push(`${width}px: saldo esperado sem tabular-nums`);
      if (!layout.priorityOrder) visualFailures.push(`${width}px: estado da sessão não priorizado`);
      if (layout.overflow > 1) visualFailures.push(`${width}px: overflow horizontal de ${layout.overflow}px`);

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, initialBalance, updatedBalance });
    });
  }

  assert(!visualFailures.length, `Aceitação visual caixa.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}