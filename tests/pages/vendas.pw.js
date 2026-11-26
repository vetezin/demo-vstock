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
      await page.goto(`${origin}/vendas.html`);
      await page.waitForSelector('#pdvProductGrid .pdv-product-card', { timeout: 10000 });

      // 1. Estado inicial do carrinho
      const initialCartCount = normalizeSpace(await page.locator('#pdvCartCount').textContent());
      const initialTotal = normalizeSpace(await page.locator('#pdvTotal').textContent());
      assert(initialCartCount === '0', `Contagem inicial do carrinho deveria ser 0, obteve ${initialCartCount}`);
      assert(initialTotal === 'R$ 0,00', `Total inicial deveria ser R$ 0,00, obteve ${initialTotal}`);

      // 2. Busca e adição de produto ao carrinho
      const firstCard = page.locator('#pdvProductGrid .pdv-product-card:not(.is-out)').first();
      await firstCard.waitFor({ state: 'visible' });
      const productName = (await firstCard.locator('.pdv-product-name').textContent()) || '';
      assert(productName.trim().length > 0, 'Card de produto não possui descrição');

      // Filtrar na busca
      await page.fill('#buscaProdutoVenda', productName.trim());
      await page.waitForTimeout(150);

      // Clicar no primeiro card filtrado
      const targetCard = page.locator('#pdvProductGrid .pdv-product-card:not(.is-out)').first();
      await targetCard.click();
      await page.waitForTimeout(150);

      // 3. Verificar que #pdvCartCount e #pdvTotal mudaram
      const updatedCartCount = normalizeSpace(await page.locator('#pdvCartCount').textContent());
      const updatedTotal = normalizeSpace(await page.locator('#pdvTotal').textContent());
      assert(Number(updatedCartCount) >= 1, `Contagem do carrinho não atualizou após adicionar produto. Atual: ${updatedCartCount}`);
      assert(updatedTotal !== 'R$ 0,00', `Total do carrinho não atualizou após adicionar produto. Atual: ${updatedTotal}`);

      // 4. Testar alternância para Mesas
      await page.click('#btnModoMesas');
      await page.waitForTimeout(150);
      const isMesasVisible = await page.locator('#visaoMesas').isVisible();
      const isVendaRapidaVisible = await page.locator('#visaoVendaRapida').isVisible();
      assert(isMesasVisible, 'Visão de Mesas não ficou visível após clicar em Mesas');
      assert(!isVendaRapidaVisible, 'Visão de Venda Rápida não foi ocultada ao trocar para Mesas');

      // Em Mesas, atalho de carrinho NÃO pode estar visível (seja em 390 ou 1366)
      const shortcutInMesas = await page.locator('#pdvCartShortcut').isVisible().catch(() => false);
      assert(!shortcutInMesas, 'Atalho de carrinho da Venda rápida visível durante a visão de Mesas');

      // Voltar para Venda Rápida
      await page.click('#btnModoVendaRapida');
      await page.waitForTimeout(150);

      // 5. Verificações de Layout e Atalho de Carrinho por viewport
      const layoutCheck = await page.evaluate(({ testWidth, expectedTotal }) => {
        const body = document.body;
        const hasRefresh = body.classList.contains('vstock-refresh') && body.classList.contains('app-shell');
        const hasVisualCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some(link => link.getAttribute('href')?.includes('visual-completo.css'));

        // Validação de h1 único
        const h1List = Array.from(document.querySelectorAll('h1'));
        const h1Count = h1List.length;
        const pageWrapper = document.querySelector('.page-wrapper, .page-content, main');
        const singleH1InContent = h1Count === 1 && Boolean(pageWrapper && pageWrapper.contains(h1List[0]));

        // Topbar
        const topbarMain = document.querySelector('.navbar .app-topbar-main');
        const topbarTitleSpan = document.querySelector('.navbar .app-topbar-title');
        const hasProperTopbarIntro = Boolean(topbarMain && topbarTitleSpan && topbarTitleSpan.tagName.toLowerCase() === 'span');

        // Botão de finalizar dentro do carrinho
        const cartPanel = document.querySelector('.pdv-cart-panel');
        const submitBtn = document.querySelector('#btnSalvarVenda');
        const submitInsideCart = Boolean(cartPanel && submitBtn && cartPanel.contains(submitBtn));

        // Atalho de carrinho
        const shortcutEl = document.querySelector('#pdvCartShortcut');
        const shortcutStyle = shortcutEl ? window.getComputedStyle(shortcutEl) : null;
        const shortcutVisible = shortcutEl ? (shortcutStyle?.display !== 'none' && shortcutStyle?.visibility !== 'hidden' && shortcutEl.getBoundingClientRect().height > 0) : false;

        let shortcutPriceMatches = false;
        let shortcutHasHref = false;
        if (shortcutEl) {
          const shortcutTotalEl = shortcutEl.querySelector('#pdvCartShortcutTotal') || shortcutEl;
          const shortcutTotalText = (shortcutTotalEl.textContent || '').replace(/\s+/g, ' ').trim();
          const cleanExpectedTotal = (expectedTotal || '').replace(/\s+/g, ' ').trim();
          shortcutPriceMatches = shortcutTotalText.includes(cleanExpectedTotal);
          shortcutHasHref = shortcutEl.getAttribute('href') === '#pdvCartPanel' || shortcutEl.hasAttribute('data-target-cart');
        }

        // Números tabulares
        const totalEl = document.querySelector('#pdvTotal');
        const totalStyle = totalEl ? window.getComputedStyle(totalEl) : null;
        const isTabular = totalStyle ? (
          totalStyle.fontVariantNumeric.includes('tabular-nums') ||
          window.getComputedStyle(document.body).fontFeatureSettings.includes('tnum') ||
          totalStyle.fontFeatureSettings.includes('tnum')
        ) : false;

        // Overflow
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          testWidth,
          hasRefresh,
          hasVisualCss,
          h1Count,
          singleH1InContent,
          hasProperTopbarIntro,
          submitInsideCart,
          shortcutExists: Boolean(shortcutEl),
          shortcutVisible,
          shortcutPriceMatches,
          shortcutHasHref,
          isTabular,
          overflow,
        };
      }, { testWidth: width, expectedTotal: updatedTotal });

      if (width === 390) {
        if (!layoutCheck.shortcutExists || !layoutCheck.shortcutVisible) {
          visualFailures.push(`390px: atalho de carrinho não visível no mobile`);
        }
        if (!layoutCheck.shortcutPriceMatches) {
          visualFailures.push(`390px: atalho de carrinho não mostra o total existente ${updatedTotal}`);
        }
        if (!layoutCheck.shortcutHasHref) {
          visualFailures.push(`390px: atalho de carrinho não referencia o carrinho`);
        }
      }

      if (width === 1366) {
        if (layoutCheck.shortcutVisible) {
          visualFailures.push(`1366px: atalho de carrinho não deveria estar visível em desktop`);
        }
      }

      if (!layoutCheck.hasRefresh) {
        visualFailures.push(`${width}px: body sem classes 'vstock-refresh' e 'app-shell'`);
      }
      if (!layoutCheck.hasVisualCss) {
        visualFailures.push(`${width}px: link para visual-completo.css ausente`);
      }
      if (!layoutCheck.singleH1InContent) {
        visualFailures.push(`${width}px: esperava 1 h1 no conteúdo, encontrou ${layoutCheck.h1Count}`);
      }
      if (!layoutCheck.hasProperTopbarIntro) {
        visualFailures.push(`${width}px: topbar sem .app-topbar-main com span.app-topbar-title`);
      }
      if (!layoutCheck.submitInsideCart) {
        visualFailures.push(`${width}px: #btnSalvarVenda não está dentro de .pdv-cart-panel`);
      }
      if (!layoutCheck.isTabular) {
        visualFailures.push(`${width}px: total sem font-variant-numeric: tabular-nums`);
      }
      if (layoutCheck.overflow > 1) {
        visualFailures.push(`${width}px: overflow horizontal de ${layoutCheck.overflow}px`);
      }

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layoutCheck });
    });
  }

  assert(!visualFailures.length, `Aceitação visual vendas.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
