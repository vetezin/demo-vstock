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

      await page.goto(`${origin}/empresa.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#empresaForm');

      // Baseline funcional: busca do e-mail demo renderiza #empresaResultado
      await page.fill('#emailEmpresa', 'contato@demovstock.com.br');
      await page.click('#empresaForm button[type="submit"]');
      await page.waitForFunction(() => {
        const r = document.getElementById('empresaResultado');
        const e = document.getElementById('error');
        return (r && getComputedStyle(r).display !== 'none') || (e && e.textContent.trim().length > 0);
      }, { timeout: 10000 });

      const resultadoVisible = await page.locator('#empresaResultado').isVisible();
      const errorText = (await page.locator('#error').textContent() || '').trim();
      // Aceitação: renderiza #empresaResultado OU mantém erro original da demo
      assert(resultadoVisible || errorText.length > 0, `Busca demo não renderizou resultado nem erro em ${width}px`);
      if (resultadoVisible) {
        const dados = (await page.locator('#dadosEmpresa').textContent() || '');
        assert(dados.includes('VStock Demo'), `Resultado não contém dados da empresa demo em ${width}px`);
      }
      evidence.push({ width, baseline: resultadoVisible ? 'resultado-renderizado' : `erro:${errorText}` });

      // Recarrega para validar layout/estado inicial
      await page.goto(`${origin}/empresa.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#empresaForm');

      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVstockAccess = body.classList.contains('vstock-access');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        const brand = document.querySelector('img[src*="logo"], img[alt*="VStock"], .vstock-brand, [data-brand]');
        const brandVisible = !!(brand && brand.getBoundingClientRect().height > 0);

        const form = document.getElementById('empresaForm');
        const resultado = document.getElementById('empresaResultado');
        const error = document.getElementById('error');
        const email = document.getElementById('emailEmpresa');

        // Busca primeiro: form visível e antes do resultado no fluxo
        const formRect = form?.getBoundingClientRect();
        const resRect = resultado?.getBoundingClientRect();
        const formVisible = !!(form && formRect.height > 0);
        const searchFirst = Boolean(
          form && resultado &&
          (form.compareDocumentPosition(resultado) & Node.DOCUMENT_POSITION_FOLLOWING)
        );

        // Erro perto do campo: #error aparece antes do resultado e próximo ao campo de busca/form
        const errorNearField = Boolean(
          error && email && resultado &&
          (email.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          (error.compareDocumentPosition(resultado) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
        const emailRect = email?.getBoundingClientRect();
        const errorRect = error?.getBoundingClientRect();
        const errorVisible = !!(error && error.textContent.trim() && errorRect && errorRect.height > 0);
        const errorInFieldGroup = Boolean(email && error && email.closest('.mb-3, .vstock-field-group')?.contains(error));
        const errorClose = errorVisible
          ? Math.abs(errorRect.top - emailRect.bottom) < 180
          : Boolean(errorInFieldGroup || errorNearField);

        // Resultado como ficha
        const ficha = resultado?.classList.contains('vs-panel') || resultado?.classList.contains('vstock-ficha') || resultado?.dataset.ficha === 'true';

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return {
          hasVstockRefresh,
          hasVstockAccess,
          hasVisualCompletoCss,
          brandVisible,
          formVisible,
          searchFirst,
          errorNearField,
          errorClose,
          ficha,
          overflow,
        };
      });

      const failures = [];
      if (!layout.hasVstockRefresh) failures.push('sem vstock-refresh');
      if (!layout.hasVstockAccess) failures.push('sem vstock-access');
      if (!layout.hasVisualCompletoCss) failures.push('sem visual-completo.css');
      if (!layout.brandVisible) failures.push('marca não clara/visível');
      if (!layout.formVisible) failures.push('form de busca não visível');
      if (!layout.searchFirst) failures.push('busca não vem antes do resultado');
      if (!layout.errorNearField) failures.push('erro não está perto do campo (ordem DOM)');
      if (!layout.errorClose) failures.push('erro não está próximo visualmente do campo');
      if (!layout.ficha) failures.push('resultado não apresentado como ficha');
      if (layout.overflow > 1) failures.push(`overflow horizontal ${layout.overflow}px`);

      if (failures.length) visualFailures.push(`${width}px: ${failures.join(', ')} | ${JSON.stringify(layout)}`);
      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual empresa.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}