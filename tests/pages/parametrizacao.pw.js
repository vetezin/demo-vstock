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

      await page.goto(`${origin}/parametrizacao.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-param-tab="empresa"]', { timeout: 10000 });
      await page.waitForSelector('#param-panel-empresa', { timeout: 10000 });

      // Ações existentes
      assert(await page.locator('#paramForm').count() === 1, `Formulário #paramForm ausente em ${width}px`);
      assert(await page.locator('#submitBtn').isVisible(), `Botão salvar ausente em ${width}px`);
      assert(await page.locator('#razao_social').count() === 1, 'Campo razão social ausente');
      assert(await page.locator('#modulo_estoque').count() === 1, 'Switch módulo estoque ausente');

      // Abas com rótulos legíveis
      const tabLabels = await page.locator('[data-param-tab]').evaluateAll((els) =>
        els.map((el) => ({
          id: el.dataset.paramTab,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
          ariaSelected: el.getAttribute('aria-selected'),
          ariaControls: el.getAttribute('aria-controls'),
          visible: el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().width > 0,
        }))
      );
      assert(tabLabels.length >= 3, `Esperado >=3 abas, obtido ${tabLabels.length}`);
      const byId = Object.fromEntries(tabLabels.map((t) => [t.id, t]));
      assert(byId.empresa?.text.includes('Empresa'), 'Rótulo aba Empresa ilegível/ausente');
      assert(byId.modulos?.text.includes('Módulos') || byId.modulos?.text.includes('Modulos'), 'Rótulo aba Módulos ilegível/ausente');
      assert(byId.futuro?.text.includes('Regras'), 'Rótulo aba Regras ilegível/ausente');
      tabLabels.forEach((t) => assert(t.visible, `Aba ${t.id} não visível em ${width}px`));

      // Estado inicial: empresa ativa, vínculo painel/aba
      const panelState = async () => page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[data-param-tab]')).map((el) => ({
          id: el.dataset.paramTab,
          active: el.classList.contains('is-active'),
          ariaSelected: el.getAttribute('aria-selected'),
          controls: el.getAttribute('aria-controls'),
        }));
        const panels = Array.from(document.querySelectorAll('[data-param-panel]')).map((el) => ({
          id: el.dataset.paramPanel,
          active: el.classList.contains('is-active'),
          hidden: el.hidden,
          labelledBy: el.getAttribute('aria-labelledby'),
          visible: el.getBoundingClientRect().height > 0,
        }));
        return { tabs, panels };
      });

      let state = await panelState();
      const empresaTab = state.tabs.find((t) => t.id === 'empresa');
      const empresaPanel = state.panels.find((p) => p.id === 'empresa');
      assert(empresaTab?.active && empresaTab.ariaSelected === 'true', 'Aba Empresa deve iniciar ativa');
      assert(empresaPanel?.active && !empresaPanel.hidden, 'Painel Empresa deve iniciar visível');
      assert(empresaTab?.controls === 'param-panel-empresa', 'Aba Empresa sem vínculo aria-controls correto');
      assert(empresaPanel?.labelledBy === 'param-tab-empresa', 'Painel Empresa sem aria-labelledby correto');

      // Alternar abas e verificar vínculo painel/aba sem salvar
      await page.click('[data-param-tab="modulos"]');
      await page.waitForTimeout(150);
      state = await panelState();
      const modTab = state.tabs.find((t) => t.id === 'modulos');
      const modPanel = state.panels.find((p) => p.id === 'modulos');
      const empPanelAfter = state.panels.find((p) => p.id === 'empresa');
      assert(modTab?.active && modTab.ariaSelected === 'true', 'Aba Módulos não ficou ativa após clique');
      assert(modPanel?.active && !modPanel.hidden && modPanel.visible, 'Painel Módulos não ficou visível após clique');
      assert(empPanelAfter?.hidden || !empPanelAfter?.active, 'Painel Empresa deveria estar oculto após trocar para Módulos');
      assert(modTab?.controls === 'param-panel-modulos', 'Vínculo aria-controls da aba Módulos incorreto');
      assert(modPanel?.labelledBy === 'param-tab-modulos', 'Vínculo aria-labelledby do painel Módulos incorreto');

      // Indicadores de estado em módulos (switches/estado)
      const moduleState = await page.evaluate(() => {
        const switches = Array.from(document.querySelectorAll('#param-panel-modulos input[type="checkbox"]'));
        return {
          count: switches.length,
          withId: switches.filter((s) => s.id).length,
          visible: switches.filter((s) => s.getBoundingClientRect().width > 0).length,
        };
      });
      assert(moduleState.count >= 7, `Esperado >=7 módulos, obtido ${moduleState.count}`);
      assert(moduleState.withId === moduleState.count, 'Módulos sem id preservado');
      assert(moduleState.visible >= 1, 'Indicadores de estado dos módulos não visíveis');

      await page.click('[data-param-tab="futuro"]');
      await page.waitForTimeout(150);
      state = await panelState();
      const futTab = state.tabs.find((t) => t.id === 'futuro');
      const futPanel = state.panels.find((p) => p.id === 'futuro');
      assert(futTab?.active && futTab.ariaSelected === 'true', 'Aba Regras não ficou ativa');
      assert(futPanel?.active && !futPanel.hidden && futPanel.visible, 'Painel Regras não ficou visível');
      assert(state.panels.find((p) => p.id === 'modulos')?.hidden, 'Painel Módulos deveria ocultar ao ir para Regras');

      // Voltar para Empresa sem salvar - vínculo preservado
      await page.click('[data-param-tab="empresa"]');
      await page.waitForTimeout(150);
      state = await panelState();
      assert(state.tabs.find((t) => t.id === 'empresa')?.active, 'Aba Empresa não reativou');
      assert(!state.panels.find((p) => p.id === 'empresa')?.hidden, 'Painel Empresa não reexibiu');

      // Layout/contrato visual
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(
          topbarMain && topbarPageIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span'
        );
        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const mainContent = document.querySelector('main, .page-content, .content');
        const singleH1InContent = headingsH1.length === 1 &&
          Boolean(mainContent && headingsH1[0] && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        const empresaPanel = document.querySelector('#param-panel-empresa');
        const modulosPanel = document.querySelector('#param-panel-modulos');
        const separated = Boolean(empresaPanel && modulosPanel && empresaPanel !== modulosPanel);

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count: headingsH1.length,
          singleH1InContent,
          separated,
          overflow,
        };
      });

      if (
        !layout.hasVstockRefresh ||
        !layout.hasVisualCompletoCss ||
        !layout.hasTopbarNavbarContract ||
        !layout.singleH1InContent ||
        !layout.separated ||
        layout.overflow > 1
      ) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, tabLabels, moduleState });
    });
  }

  assert(!visualFailures.length, `Aceitação visual parametrizacao.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
