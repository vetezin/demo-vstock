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
      await page.goto(`${origin}/cadastro-funcionario.html`);
      await page.waitForSelector('#tabelaFuncionarios tbody tr');

      // 1. Dados iniciais carregam na tabela
      const initialRowCount = await page.locator('#tabelaFuncionarios tbody tr').count();
      assert(initialRowCount > 0, `Nenhum funcionário carregado em ${width}px`);

      // Obter nome do primeiro funcionário da tabela
      const firstRowName = (await page.locator('#tabelaFuncionarios tbody tr td:first-child').first().textContent() || '').trim();
      assert(firstRowName.length > 0, 'Primeiro funcionário não possui nome');

      // 2. Filtro por nome e restauração
      await page.fill('#filtroNomeFuncionario', firstRowName);
      await page.dispatchEvent('#filtroNomeFuncionario', 'input');
      await page.waitForTimeout(150);

      const filteredCount = await page.locator('#tabelaFuncionarios tbody tr').count();
      assert(filteredCount > 0 && filteredCount <= initialRowCount, 'Filtro por nome não filtrou a tabela');

      // Limpar filtro (botão da página) e verificar restauração
      await page.click('#btnLimparFiltroFuncionario');
      await page.waitForTimeout(150);
      assert((await page.inputValue('#filtroNomeFuncionario')) === '', 'Botão de limpar filtro não esvaziou o campo');
      const restoredCount = await page.locator('#tabelaFuncionarios tbody tr').count();
      assert(restoredCount === initialRowCount, `Limpar filtro não restaurou tabela (esperado ${initialRowCount}, obtido ${restoredCount})`);

      // 3. Interação básica com formulário: preencher e limpar
      await page.fill('#funcNome', 'Nome Teste Temp');
      assert((await page.inputValue('#funcNome')) === 'Nome Teste Temp', 'Campo #funcNome não foi preenchido');
      await page.click('#btnLimparFuncionario');
      assert((await page.inputValue('#funcNome')) === '', 'Botão #btnLimparFuncionario não limpou o formulário');

      // 4. Salvar permanece ligado ao handler do #funcionarioForm
      await page.click('#btnSalvarFuncionario');
      await page.waitForTimeout(150);
      const avisoValidacao = (await page.locator('#mensagens').textContent() || '').trim();
      assert(
        avisoValidacao.includes('Preencha os campos obrigatórios'),
        'Enviar o formulário vazio não acionou a validação do funcionário'
      );
      assert((await page.inputValue('#funcNome')) === '', 'Validação do formulário alterou os campos');

      // 5. Ações de linha continuam renderizadas pelo script da página
      const acoesLinha = await page.locator('#tabelaFuncionarios tbody tr button[data-acao]').count();
      assert(acoesLinha > 0, 'Tabela de funcionários não renderizou ações de linha');

      // 4. Critérios estruturais e visuais (layout e aceitação)
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVisualCompletoCss = Boolean(document.querySelector('link[href*="css/visual-completo.css"]'));

        // Contrato da navbar para evitar duplicação de h1
        const topbarMain = document.querySelector('.brand-navbar .app-topbar-main');
        const topbarPageIntro = document.querySelector('.brand-navbar .app-topbar-page-intro');
        const topbarTitle = document.querySelector('.brand-navbar .app-topbar-title');
        const hasTopbarNavbarContract = Boolean(topbarMain && topbarPageIntro && topbarTitle);

        // H1 único no conteúdo
        const headingsH1 = Array.from(document.querySelectorAll('h1'));
        const h1Count = headingsH1.length;
        const singleH1InContent = h1Count === 1 &&
          Boolean(headingsH1[0].closest('main, .content, .page-content')) &&
          headingsH1[0].getBoundingClientRect().height > 0;

        // Salvar ligado ao mesmo formulário
        const form = document.querySelector('#funcionarioForm');
        const btnSalvar = document.querySelector('#btnSalvarFuncionario');
        const saveLinkedToForm = Boolean(
          form && btnSalvar && (form.contains(btnSalvar) || btnSalvar.getAttribute('form') === 'funcionarioForm')
        );

        // Identidade antes de acesso e senha
        const elCpf = document.querySelector('#funcCpf');
        const elNome = document.querySelector('#funcNome');
        const elTelefone = document.querySelector('#funcTelefone');
        const elEmail = document.querySelector('#funcEmail');
        const elCargo = document.querySelector('#funcCargo');
        const elUser = document.querySelector('#funcUsername');
        const elPerfil = document.querySelector('#funcTipoAcesso');
        const elSenha = document.querySelector('#funcSenha');
        const elHelper = document.querySelector('#senhaHelperFuncionario');

        // Posição no DOM: elementos de identidade antes dos elementos de acesso
        const domIdentityBeforeAccess = Boolean(
          elNome && elCargo && elUser && elSenha &&
          (elNome.compareDocumentPosition(elUser) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          (elCargo.compareDocumentPosition(elUser) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          (elUser.compareDocumentPosition(elSenha) & Node.DOCUMENT_POSITION_FOLLOWING)
        );

        // Opções de perfil mantidas
        const optionsPerfil = elPerfil ? Array.from(elPerfil.options).map(o => ({ value: o.value, text: o.text.trim() })) : [];
        const hasPerfilOptions = optionsPerfil.some(o => o.value === '1' && o.text.includes('Operador')) &&
                                 optionsPerfil.some(o => o.value === '99' && o.text.includes('Administrador'));

        // Ajuda de senha mantida
        const hasSenhaHelper = Boolean(elHelper && elHelper.textContent.includes('Obrigatória no cadastro'));

        // Cores calculadas
        const computedBody = window.getComputedStyle(body);
        const bgVal = computedBody.backgroundColor;
        const colorVal = computedBody.color;

        // Sem overflow horizontal
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          hasVstockRefresh,
          hasVisualCompletoCss,
          hasTopbarNavbarContract,
          h1Count,
          singleH1InContent,
          saveLinkedToForm,
          domIdentityBeforeAccess,
          hasPerfilOptions,
          hasSenhaHelper,
          bgVal,
          colorVal,
          overflow
        };
      });

      if (!layout.hasVstockRefresh ||
          !layout.hasVisualCompletoCss ||
          !layout.hasTopbarNavbarContract ||
          !layout.singleH1InContent ||
          !layout.saveLinkedToForm ||
          !layout.domIdentityBeforeAccess ||
          !layout.hasPerfilOptions ||
          !layout.hasSenhaHelper ||
          layout.overflow > 1) {
        visualFailures.push(`${width}px: ${JSON.stringify(layout)}`);
      }

      assert(!errors.length, `Erros de console em ${width}px: ${errors.join('; ')}`);
      evidence.push({ width, rowCount: initialRowCount, layout });
    });
  }

  // 6. Testar controle de acesso de admin: operador (não-admin) redirecionado para index.html
  await withPage({ width: 1366, height: 844 }, async (page) => {
    await page.addInitScript(() => {
      localStorage.setItem('funcionarioLogado', JSON.stringify({
        funcNome: 'Operador Teste',
        tipoAcesso: 1,
        cargo: 'Operador'
      }));
    });
    await page.goto(`${origin}/cadastro-funcionario.html`);
    await page.waitForURL(`${origin}/index.html`);
    assert(page.url().includes('index.html'), 'Usuário operador não foi redirecionado para index.html');
  });

  assert(!visualFailures.length, `Aceitação visual cadastro-funcionario.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
