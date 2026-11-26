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
      await page.goto(`${origin}/cadastro-fornecedor.html`);
      await page.waitForSelector('#tabelaFornecedores tbody tr');

      // 1. Dados iniciais carregados na tabela
      const initialRowCount = await page.locator('#tabelaFornecedores tbody tr').count();
      assert(initialRowCount > 0, `Nenhum fornecedor carregado em ${width}px`);

      // 2. Nome e contato legíveis na linha
      const firstRowName = (await page.locator('#tabelaFornecedores tbody tr td:nth-child(1)').first().textContent() || '').trim();
      const firstRowDoc = (await page.locator('#tabelaFornecedores tbody tr td:nth-child(2)').first().textContent() || '').trim();
      const firstRowPhone = (await page.locator('#tabelaFornecedores tbody tr td:nth-child(3)').first().textContent() || '').trim();
      const firstRowEmail = (await page.locator('#tabelaFornecedores tbody tr td:nth-child(4)').first().textContent() || '').trim();
      const firstRowContact = (await page.locator('#tabelaFornecedores tbody tr td:nth-child(5)').first().textContent() || '').trim();

      assert(firstRowName.length > 0 && firstRowName !== '-', 'Nome do fornecedor vazio na primeira linha');
      assert(firstRowContact.length > 0 && firstRowContact !== '-', 'Contato do fornecedor vazio na primeira linha');
      assert(firstRowPhone.length > 0, 'Telefone ausente na primeira linha');
      assert(firstRowEmail.length > 0, 'Email ausente na primeira linha');

      // 3. Ações na linha: editar carrega dados no formulário
      const editBtn = page.locator('#tabelaFornecedores tbody tr button[data-acao="editar"]').first();
      assert(await editBtn.count() > 0, 'Botão de editar fornecedor ausente na tabela');
      await editBtn.click();
      await page.waitForTimeout(100);

      const nomeInputVal = await page.inputValue('#nome');
      const contatoInputVal = await page.inputValue('#contato');
      assert(nomeInputVal === firstRowName, `Edição não preencheu campo nome: esperado "${firstRowName}", obtido "${nomeInputVal}"`);
      assert(contatoInputVal === firstRowContact, `Edição não preencheu campo contato: esperado "${firstRowContact}", obtido "${contatoInputVal}"`);

      const tituloEditando = (await page.locator('#tituloFormularioFornecedor').textContent() || '').trim();
      assert(tituloEditando.includes('Editar Fornecedor'), 'Título do formulário não mudou para Editar Fornecedor');
      assert(await page.locator('#btnCancelarEdicao').isVisible(), 'Botão cancelar edição não está visível durante edição');

      // Cancelar edição
      await page.click('#btnCancelarEdicao');
      await page.waitForTimeout(50);
      assert((await page.inputValue('#nome')) === '', 'Cancelar edição não limpou campo #nome');
      const tituloNovo = (await page.locator('#tituloFormularioFornecedor').textContent() || '').trim();
      assert(tituloNovo.includes('Novo Fornecedor'), 'Título não retornou para Novo Fornecedor');

      // 4. Filtro por nome: aplicar e limpar restaura dados
      await page.fill('#filtroNomeFornecedor', firstRowName);
      await page.dispatchEvent('#filtroNomeFornecedor', 'input');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const filteredCount = await page.locator('#tabelaFornecedores tbody tr').count();
      assert(filteredCount > 0 && filteredCount <= initialRowCount, 'Filtro por nome não filtrou a tabela');

      // Limpar filtro de nome (usando botão limpar filtro se houver ou limpando input)
      const btnLimparFiltro = page.locator('#btnLimparFiltroFornecedor');
      if (await btnLimparFiltro.count() > 0 && await btnLimparFiltro.isVisible()) {
        await btnLimparFiltro.click();
      } else {
        await page.fill('#filtroNomeFornecedor', '');
        await page.dispatchEvent('#filtroNomeFornecedor', 'input');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);

      const restoredCount = await page.locator('#tabelaFornecedores tbody tr').count();
      assert(restoredCount === initialRowCount, `Limpar filtro não restaurou listagem (esperado ${initialRowCount}, obtido ${restoredCount})`);

      // 5. Aceitação Visual e Estrutural
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        // Topbar contract
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(topbarMain && topbarPageIntro && topbarTitle);

        // h1 único no conteúdo
        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const singleH1InContent = h1Count === 1 &&
          Boolean(headingsH1[0].closest('main, .content, .page-content')) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        // Grupos no formulário: Identidade e Contato
        const form = document.querySelector('#fornecedorForm');
        const grupoIdentidade = form?.querySelector('[data-grupo="identidade"], .fornecedor-grupo-identidade');
        const grupoContato = form?.querySelector('[data-grupo="contato"], .fornecedor-grupo-contato');

        const hasInputsInIdentidade = Boolean(
          grupoIdentidade &&
          grupoIdentidade.querySelector('#nome') &&
          grupoIdentidade.querySelector('#cpfCnpj') &&
          grupoIdentidade.querySelector('#descricao')
        );

        const hasInputsInContato = Boolean(
          grupoContato &&
          grupoContato.querySelector('#contato') &&
          grupoContato.querySelector('#telefone') &&
          grupoContato.querySelector('#email')
        );

        const hasGruposFormulario = Boolean(grupoIdentidade && grupoContato && hasInputsInIdentidade && hasInputsInContato);

        // Lista de fornecedores abaixo do formulário
        const formCard = form?.closest('.card, .vs-panel, section');
        const listCard = document.querySelector('#tabelaFornecedores')?.closest('.card, .vs-panel, section');
        const top = (el) => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
        const formTop = top(formCard);
        const listTop = top(listCard);
        const formBeforeList = Boolean(formCard && listCard && formTop < listTop);

        // Sem overflow horizontal
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          hasGruposFormulario,
          formBeforeList,
          overflow,
        };
      });

      if (!layout.hasVstockRefresh ||
          !layout.hasVisualCompletoCss ||
          !layout.hasTopbarNavbarContract ||
          !layout.singleH1InContent ||
          !layout.hasGruposFormulario ||
          !layout.formBeforeList ||
          layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros no console em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, layout, rowCount: initialRowCount });
    });
  }

  assert(!visualFailures.length, `Aceitação visual cadastro-fornecedor.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
