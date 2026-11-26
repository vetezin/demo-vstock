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

  // Composição: bloquear só js/login.js
  for (const width of [390, 1366]) {
    await withPage({ width, height: 844 }, async (page) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/js/login.js', (route) => route.abort());

      await page.goto(`${origin}/login.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#loginForm', { timeout: 10000 });

      // Preservação: IDs, campos, mensagens, licença, navegação
      const preservation = await page.evaluate(() => {
        const ids = ['loginForm', 'acesso', 'senha', 'licenca', 'licencaFieldWrapper', 'licencaHelper', 'msg', 'error'];
        const missing = ids.filter((id) => !document.getElementById(id));
        const form = document.getElementById('loginForm');
        const acesso = document.getElementById('acesso');
        const senha = document.getElementById('senha');
        const licenca = document.getElementById('licenca');
        const submit = form?.querySelector('button[type="submit"]');
        return {
          missing,
          hasForm: Boolean(form),
          acessoType: acesso?.getAttribute('type') || '',
          acessoName: acesso?.getAttribute('name') || '',
          senhaType: senha?.getAttribute('type') || '',
          senhaName: senha?.getAttribute('name') || '',
          licencaName: licenca?.getAttribute('name') || '',
          licencaWrapperExists: Boolean(document.getElementById('licencaFieldWrapper')),
          licencaHelperExists: Boolean(document.getElementById('licencaHelper')),
          msgExists: Boolean(document.getElementById('msg')),
          errorExists: Boolean(document.getElementById('error')),
          submitText: (submit?.textContent || '').trim(),
        };
      });

      assert(!preservation.missing.length, `${width}px: IDs ausentes: ${preservation.missing.join(', ')}`);
      assert(preservation.acessoName === 'acesso', `${width}px: campo acesso sem name esperado`);
      assert(preservation.senhaType === 'password', `${width}px: campo senha não é password`);
      assert(preservation.licencaName === 'licenca', `${width}px: campo licença sem name esperado`);
      assert(preservation.submitText.length > 0, `${width}px: botão submit sem texto`);

      // Composição visual
      const layout = await page.evaluate(() => {
        const body = document.body;
        const hasVstockRefresh = body.classList.contains('vstock-refresh');
        const hasVstockAccess = body.classList.contains('vstock-access');
        const hasVisualCompletoCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .some((l) => (l.getAttribute('href') || '').includes('visual-completo.css'));
        const form = document.getElementById('loginForm');
        const h1 = document.querySelector('h1');
        const brandOrBadge = document.querySelector('.login-badge, .login-overline, .brand-navbar, .navbar-brand, .login-brand');
        const overline = document.querySelector('.login-overline');
        const msg = document.getElementById('msg');
        const error = document.getElementById('error');
        const licencaWrapper = document.getElementById('licencaFieldWrapper');
        const licencaHelper = document.getElementById('licencaHelper');
        const visible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const s = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return {
          hasVstockRefresh,
          hasVstockAccess,
          hasVisualCompletoCss,
          formVisible: visible(form),
          h1Visible: visible(h1),
          h1Text: (h1?.textContent || '').trim(),
          brandVisible: visible(brandOrBadge) || visible(overline),
          msgExists: Boolean(msg),
          errorExists: Boolean(error),
          licencaWrapperExists: Boolean(licencaWrapper),
          licencaHelperExists: Boolean(licencaHelper),
          overflow,
        };
      });

      if (!layout.hasVstockRefresh) visualFailures.push(`${width}px: body sem vstock-refresh`);
      if (!layout.hasVstockAccess) visualFailures.push(`${width}px: body sem vstock-access`);
      if (!layout.hasVisualCompletoCss) visualFailures.push(`${width}px: visual-completo.css ausente`);
      if (!layout.formVisible) visualFailures.push(`${width}px: formulário não visível`);
      if (!layout.h1Visible) visualFailures.push(`${width}px: h1/marca não visível`);
      if (!layout.brandVisible) visualFailures.push(`${width}px: marca/badge/overline não visível`);
      if (!layout.msgExists || !layout.errorExists) visualFailures.push(`${width}px: mensagens #msg/#error ausentes`);
      if (!layout.licencaWrapperExists || !layout.licencaHelperExists) visualFailures.push(`${width}px: elementos de licença ausentes`);
      if (layout.overflow > 1) visualFailures.push(`${width}px: overflow horizontal ${layout.overflow}px`);

      assert(!errors.length, `${width}px: pageerror: ${errors.join('; ')}`);
      evidence.push({ width, preservation, layout });
    });
  }

  // Fluxo real sem bloqueio: redireciona para index.html
  await withPage({ width: 1366, height: 844 }, async (page) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/login.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname.endsWith('/index.html'), { timeout: 10000 });
    const path = new URL(page.url()).pathname;
    assert(path.endsWith('/index.html'), `Fluxo real não redirecionou para index.html: ${path}`);
    // pageerror no destino é fora do escopo do login; não falhar por erros da index
    evidence.push({ realFlow: path });
  });

  assert(!visualFailures.length, `Aceitação visual login.html falhou: ${visualFailures.join(' | ')}. Evidência: ${JSON.stringify(evidence)}`);
  return evidence;
}
