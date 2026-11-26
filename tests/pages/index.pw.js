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
      await page.goto(`${origin}/index.html`);
      const account = page.locator('.dashboard-topbar .topbar-account-slot #navbarAccountToggle');
      const dropdown = page.locator('#navbarAccountDropdown');
      await account.click();
      await dropdown.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await dropdown.waitFor({ state: 'hidden' });

      const quick = page.getByRole('region', { name: 'Acessos rápidos' });
      const alerts = page.locator('#avisoAlertasDashboard');
      await alerts.waitFor({ state: 'visible' });
      assert(await alerts.getByRole('link', { name: 'Ver todos os alertas' }).getAttribute('href') === 'alertas.html', 'Link dos alertas mudou');
      assert(await alerts.locator('.alert-item').count() === 2, 'Alertas da demonstração não renderizaram');
      assert(await quick.getByRole('link').count() === 6, 'Atalhos do administrador mestre não estão completos');
      assert(await page.locator('#kpiProdutosCadastrados').textContent() === '17', 'KPI de produtos não atualizou com os dados da demonstração');
      assert((await page.locator('#salesChartLinePath').getAttribute('d')).includes('L600,') &&
        (await page.locator('#salesChartAreaFill').getAttribute('d')).endsWith('L600,260 L0,260 Z'), 'SVG de vendas não renderizou');
      assert(await page.locator('#categoriaBar0').evaluate((bar) => bar.style.width) === '100%', 'Barras de estoque não renderizaram');
      await page.locator('#dashboardMovementsList .movement-item').first().waitFor({ state: 'visible' });

      const layout = await page.evaluate(() => {
        const priorities = ['[aria-label="Acessos rápidos"]', '#avisoAlertasDashboard'].map((selector) => document.querySelector(selector));
        const analytics = ['[aria-label="Indicadores principais"]', '[aria-label="Gráficos principais"]'].map((selector) => document.querySelector(selector));
        const top = (element) => Math.round(element.getBoundingClientRect().top + window.scrollY);
        const heading = document.querySelector('h1');
        return {
          domOrder: priorities.every((priority) => analytics.every((section) =>
            Boolean(priority.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING))),
          priorityTops: priorities.map(top),
          analyticsTops: analytics.map(top),
          contentTitle: document.querySelectorAll('h1').length === 1 &&
            Boolean(heading.closest('.dashboard-content')) && heading.getBoundingClientRect().height > 0,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const visualOrder = Math.max(...layout.priorityTops) < Math.min(...layout.analyticsTops);
      if (!layout.domOrder || !visualOrder || !layout.contentTitle || layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      await quick.getByRole('link', { name: /Entrada Registrar compra ou reposição/ }).click();
      await page.waitForURL(`${origin}/entrada-compra.html`);
      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, account: 'abriu/fechou com Escape', shortcut: '/entrada-compra.html' });
    });
  }

  await withPage({ width: 390, height: 844 }, async (page) => {
    await page.addInitScript(() => localStorage.setItem('funcionarioLogado', JSON.stringify({
      funcNome: 'Operadora de teste', cargo: 'Operadora', tipoAcesso: 1,
    })));
    // A demo sempre habilita os módulos. Varie só a resposta de configuração nesse contexto.
    await page.route('**/js/mock-api.js?*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}
        (() => {
          const demoFetch = window.fetch;
          window.fetch = async (input, init) => {
            const result = await demoFetch(input, init);
            if (!String(input).endsWith('/api/modulos/unica')) return result;
            return Response.json({ ...await result.json(), moduloEstoque: false, moduloAlertas: false });
          };
        })();` });
    });
    await page.goto(`${origin}/index.html`);
    await page.waitForFunction(() => document.querySelector('.sidebar a[href="index.html"]'));
    assert(await page.locator('.quick-access-grid a').count() === 0, 'Operadora com estoque desativado recebeu atalhos indisponíveis');
    assert(await page.locator('#avisoAlertasDashboard').count() === 0, 'Módulo Alertas desativado não removeu o painel de alertas');
    assert((await page.locator('#usuario-logado').textContent()) === 'Operadora de teste', 'Conta não refletiu o perfil restrito');
    evidence.push({ restricted: '0 atalhos; painel de alertas removido; conta da operadora' });
  });

  assert(!visualFailures.length, `Composição do Início: ${visualFailures.join(' | ')}. Preservação OK: ${JSON.stringify(evidence)}`);
  return evidence;
}
