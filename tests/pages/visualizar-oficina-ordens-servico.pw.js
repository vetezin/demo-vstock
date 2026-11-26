async (initialPage) => {
  const browser = initialPage.context().browser();
  const origin = 'http://127.0.0.1:8765';
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
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
      page.on('dialog', (dialog) => dialog.accept().catch(() => {}));

      await page.goto(`${origin}/visualizar-oficina-ordens-servico.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#tabelaOsBody tr', { timeout: 15000 });

      const rows = page.locator('#tabelaOsBody tr');
      const rowCount = await rows.count();
      assert(rowCount > 0, `Nenhuma OS carregada em ${width}px`);

      // Fichas/lista: identificação, etapa/status e ação
      const first = rows.first();
      const numero = normalize(await first.locator('td:nth-child(1)').textContent());
      const clienteVeiculo = normalize(await first.locator('td:nth-child(2)').textContent());
      const status = normalize(await first.locator('.os-status').textContent());
      const acao = normalize(await first.locator('td:nth-child(6) button').textContent());
      assert(/OS\s*#?\d+/i.test(numero), `Identificação da OS ausente em ${width}px: "${numero}"`);
      assert(clienteVeiculo.length > 0, `Cliente/veículo ausente na ficha em ${width}px`);
      assert(/aberta|andamento|finalizada|cancelada/i.test(status), `Etapa/status ausente na ficha em ${width}px: "${status}"`);
      assert(/ver/i.test(acao), `Ação da ficha ausente em ${width}px: "${acao}"`);

      // Abrir ordem e conferir ação/estado
      await first.locator('button[data-ver-os]').click();
      const modalDetalhe = page.locator('#modalDetalheOs');
      const modalExecucao = page.locator('#modalEditarOs');
      await Promise.race([
        modalDetalhe.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        modalExecucao.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
      ]);

      const detalheVisivel = await modalDetalhe.isVisible().catch(() => false);
      const execucaoVisivel = await modalExecucao.isVisible().catch(() => false);
      assert(detalheVisivel || execucaoVisivel, `Nenhum modal abriu ao ver OS em ${width}px`);

      let estadoModal = '';
      let acoesModal = [];
      if (execucaoVisivel) {
        estadoModal = normalize(await page.locator('#modalEditarOs .os-status, #modalEditarOs .os-execucao-titulo-linha .os-status').first().textContent());
        acoesModal = await page.locator('#btnFinalizarExecucao, #btnCancelarExecucao, #formEditarOs button[type="submit"]').allTextContents();
        assert(/andamento/i.test(estadoModal), `Estado da OS em execução não refletido em ${width}px: "${estadoModal}"`);
        assert(acoesModal.some((t) => /finalizar|salvar|cancelar/i.test(t)), `Ações da OS em execução ausentes em ${width}px`);
        await page.locator('#modalEditarOs .btn-close').click();
        await modalExecucao.waitFor({ state: 'hidden', timeout: 5000 });
      } else {
        estadoModal = normalize(await page.locator('#detalheOsStatus').textContent());
        acoesModal = await page.locator('#acoesOs button').allTextContents();
        assert(/aberta|andamento|finalizada|cancelada/i.test(estadoModal), `Estado da OS no detalhe ausente em ${width}px: "${estadoModal}"`);
        if (/aberta/i.test(estadoModal)) {
          assert(acoesModal.some((t) => /iniciar/i.test(t)), `OS aberta sem ação Iniciar em ${width}px`);
        } else if (/finalizada/i.test(estadoModal)) {
          assert(acoesModal.some((t) => /emitir pdf|imprimir/i.test(t)), `OS finalizada sem ação de impressão em ${width}px`);
        }
        await page.locator('#modalDetalheOs .btn-close').click();
        await modalDetalhe.waitFor({ state: 'hidden', timeout: 5000 });
      }

      // Encontrar OS finalizada para validar #osDocumentoImpressao em modo print
      let finalizadaEncontrada = false;
      const total = await rows.count();
      for (let i = 0; i < total; i++) {
        const row = rows.nth(i);
        const rowStatus = normalize(await row.locator('.os-status').textContent());
        if (!/finalizada/i.test(rowStatus)) continue;
        await row.locator('button[data-ver-os]').click();
        await modalDetalhe.waitFor({ state: 'visible', timeout: 5000 });
        const detalheStatus = normalize(await page.locator('#detalheOsStatus').textContent());
        const detalheAcoes = await page.locator('#acoesOs button').allTextContents();
        assert(/finalizada/i.test(detalheStatus), `Detalhe da OS finalizada sem estado em ${width}px`);
        assert(detalheAcoes.some((t) => /emitir pdf|imprimir/i.test(t)), `OS finalizada sem ação de impressão em ${width}px`);

        await page.evaluate(() => document.body.classList.add('os-imprimindo'));
        await page.emulateMedia({ media: 'print' });
        const printInfo = await page.evaluate(() => {
          const el = document.querySelector('#osDocumentoImpressao');
          if (!el) return { exists: false };
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            exists: true,
            display: style.display,
            visibility: style.visibility,
            width: rect.width,
            height: rect.height,
            hasNumero: Boolean(document.querySelector('#documentoOsNumero')?.textContent?.trim()),
          };
        });
        assert(printInfo.exists, `#osDocumentoImpressao ausente em ${width}px`);
        assert(printInfo.display !== 'none', `#osDocumentoImpressao oculto em modo print em ${width}px`);
        assert(printInfo.visibility !== 'hidden', `#osDocumentoImpressao invisível em modo print em ${width}px`);
        assert(printInfo.height > 0, `#osDocumentoImpressao sem altura em modo print em ${width}px`);
        assert(printInfo.hasNumero, `#osDocumentoImpressao sem número da OS em modo print em ${width}px`);

        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => document.body.classList.remove('os-imprimindo'));
        await page.locator('#modalDetalheOs .btn-close').click();
        await modalDetalhe.waitFor({ state: 'hidden', timeout: 5000 });
        finalizadaEncontrada = true;
        break;
      }
      assert(finalizadaEncontrada, `Nenhuma OS finalizada encontrada para validar impressão em ${width}px`);

      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) =>
          (l.getAttribute('href') || '').includes('css/visual-completo.css')
        );
        const main = document.querySelector('main, .page-content, .content');
        const h1s = Array.from(document.querySelectorAll('h1'));
        const singleH1InContent = h1s.length === 1 && Boolean(main && h1s[0] && main.contains(h1s[0])) && h1s[0].getBoundingClientRect().height > 0;
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const topbarContract = Boolean(topbarMain && topbarIntro && topbarTitle && topbarTitle.tagName.toLowerCase() === 'span');
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const valueSample = document.querySelector('#finalizarOsTotal, #detalheOsTotal, .os-resumo-total strong, .os-status-card strong');
        const style = valueSample ? window.getComputedStyle(valueSample) : window.getComputedStyle(document.body);
        const tabular = /tabular-nums/.test(style.fontVariantNumeric || '') || /tnum/.test(style.fontFeatureSettings || '');
        return {
          hasRefresh,
          hasVisualCss,
          h1Count: h1s.length,
          singleH1InContent,
          topbarContract,
          overflow,
          tabular,
        };
      });

      if (!layout.hasRefresh) visualFailures.push(`${width}px: body sem vstock-refresh`);
      if (!layout.hasVisualCss) visualFailures.push(`${width}px: visual-completo.css ausente`);
      if (!layout.singleH1InContent) visualFailures.push(`${width}px: h1 único no conteúdo falhou (${layout.h1Count})`);
      if (!layout.topbarContract) visualFailures.push(`${width}px: contrato topbar ausente`);
      if (layout.overflow > 1) visualFailures.push(`${width}px: overflow horizontal ${layout.overflow}px`);
      if (!layout.tabular) visualFailures.push(`${width}px: números tabulares ausentes`);

      assert(!errors.length, `Erros de página em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, numero, clienteVeiculo, status, acao, estadoModal, acoesModal, layout });
    });
  }

  assert(!visualFailures.length, `Aceitação visual/funcional visualizar-oficina-ordens-servico.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}