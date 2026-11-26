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
      await page.goto(`${origin}/saida-estoque.html`);

      // Aguarda carregamento inicial dos produtos e saídas
      await page.locator('#listaProdutos option:not([disabled])').first().waitFor({ state: 'attached', timeout: 10000 });
      await page.waitForSelector('#dataSaida');

      // 1. Dados da saída (Passo 1)
      const dataSaidaVal = await page.inputValue('#dataSaida');
      const funcionarioNomeVal = await page.inputValue('#funcionarioNome');
      assert(dataSaidaVal.length > 0, `Data da saída não preenchida em ${width}px`);
      assert(funcionarioNomeVal.length > 0, `Funcionário logado não preenchido em ${width}px`);

      // 2. Estado inicial dos contadores
      const initialCount = (await page.locator('#resumoSaidaItens').textContent() || '').trim();
      const initialTotal = (await page.locator('#totalItensSaida').textContent() || '').trim();
      assert(initialCount === '0', `Contagem inicial deveria ser 0, obteve "${initialCount}"`);
      assert(initialTotal === '0', `Total inicial de itens deveria ser 0, obteve "${initialTotal}"`);

      // 3. Selecionar produto via dropdown/busca
      await page.click('#buscaProdutoSaida');
      await page.waitForSelector('#dropdownProdutosSaida button.produto-dropdown-item:not(.vazio)', { timeout: 5000 });
      const firstItem = page.locator('#dropdownProdutosSaida button.produto-dropdown-item:not(.vazio)').first();
      await firstItem.click();
      await page.waitForTimeout(100);

      const saldoVal = await page.inputValue('#saldoProduto');
      assert(Number(saldoVal) > 0, `Saldo do produto selecionado não carregou (> 0): ${saldoVal}`);

      // 4. Testar modal de observação
      await page.click('#btnAbrirObservacao');
      await page.waitForSelector('#modalObservacao.show', { timeout: 5000 });
      await page.fill('#observacaoItem', 'Saída para teste TDD');
      await page.click('#btnSalvarObservacao');
      await page.waitForSelector('#modalObservacao', { state: 'hidden', timeout: 5000 });

      const observacaoResumoVal = await page.inputValue('#observacaoResumo');
      assert(observacaoResumoVal === 'Saída para teste TDD', `Observação não refletida no resumo: "${observacaoResumoVal}"`);

      // 5. Preencher quantidade e adicionar item
      await page.fill('#quantidade', '2');
      await page.click('#btnAddItem');
      await page.waitForTimeout(150);

      // Verificar que contadores mudaram
      const updatedCount = (await page.locator('#resumoSaidaItens').textContent() || '').trim();
      const updatedTotal = (await page.locator('#totalItensSaida').textContent() || '').trim();
      assert(updatedCount === '1', `Contador de itens não atualizou para 1: "${updatedCount}"`);
      assert(updatedTotal === '2', `Quantidade total de itens não atualizou para 2: "${updatedTotal}"`);

      // Verificar linha na tabela de itens
      const rowCount = await page.locator('#tabelaItens tbody tr').count();
      assert(rowCount === 1, `Tabela de itens deveria ter 1 linha, obteve ${rowCount}`);
      const rowText = await page.locator('#tabelaItens tbody tr').first().textContent() || '';
      assert(rowText.includes('Saída para teste TDD'), `Linha da tabela não contém a observação informada: ${rowText}`);
      assert(rowText.includes('Uso interno'), `Linha da tabela não contém o motivo padrão: ${rowText}`);

      // 6. Verificações de Layout e Requisitos Visuais
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        // Topbar e H1 único
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(
          topbarMain && topbarPageIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span'
        );

        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const mainContent = document.querySelector('main, .content, .page-content');
        const singleH1InContent = h1Count === 1 &&
          Boolean(headingsH1[0] && mainContent && mainContent.contains(headingsH1[0])) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        // Saldo disponível ao lado da quantidade
        const saldoContainer = document.querySelector('#saldoProduto')?.closest('.col-xl-2, .col-lg-2, .col-md-3, .col-md-4, .col-6, [class*="col-"]');
        const qtdContainer = document.querySelector('#quantidade')?.closest('.col-xl-2, .col-lg-2, .col-md-3, .col-md-4, .col-6, [class*="col-"]');
        let saldoAoLadoQtd = false;
        if (saldoContainer && qtdContainer) {
          const rectSaldo = saldoContainer.getBoundingClientRect();
          const rectQtd = qtdContainer.getBoundingClientRect();
          // Devem estar alinhados horizontalmente (mesmo topo aproximadamente e saldo à esquerda de quantidade)
          const mesmoNivelVertical = Math.abs(rectSaldo.top - rectQtd.top) < 16;
          const saldoAntesDeQtd = rectSaldo.left < rectQtd.left;
          saldoAoLadoQtd = mesmoNivelVertical && saldoAntesDeQtd;
        }

        // Números tabulares
        const resumoItensEl = document.querySelector('#resumoSaidaItens');
        const tableQtyEl = document.querySelector('#tabelaItens tbody td.text-end');
        const styleResumo = resumoItensEl ? window.getComputedStyle(resumoItensEl) : null;
        const styleTable = tableQtyEl ? window.getComputedStyle(tableQtyEl) : null;
        const bodyStyle = window.getComputedStyle(document.body);

        const isTabular = Boolean(
          (styleResumo && (styleResumo.fontVariantNumeric.includes('tabular-nums') || styleResumo.fontFeatureSettings.includes('tnum'))) ||
          (styleTable && (styleTable.fontVariantNumeric.includes('tabular-nums') || styleTable.fontFeatureSettings.includes('tnum'))) ||
          bodyStyle.fontFeatureSettings.includes('tnum') ||
          bodyStyle.fontVariantNumeric.includes('tabular-nums')
        );

        // Ações de conferir e registrar
        const btnSalvar = document.querySelector('#btnSalvar');
        const btnLimparTudo = document.querySelector('#btnLimparTudo');
        const hasAcoesRegistro = Boolean(btnSalvar && btnLimparTudo);

        // Sem overflow horizontal
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          saldoAoLadoQtd,
          isTabular,
          hasAcoesRegistro,
          overflow
        };
      });

      if (!layout.hasVstockRefresh ||
          !layout.hasVisualCompletoCss ||
          !layout.hasTopbarNavbarContract ||
          !layout.singleH1InContent ||
          !layout.saldoAoLadoQtd ||
          !layout.isTabular ||
          !layout.hasAcoesRegistro ||
          layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros no console em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual saida-estoque.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
