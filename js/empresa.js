document.addEventListener('DOMContentLoaded', () => {
  // pega nÃ­vel de acesso e email do funcionÃ¡rio logado da querystring
  const urlParams = new URLSearchParams(window.location.search);
  const nivel = urlParams.get('nivel');
  const funcEmail = urlParams.get('funcEmail');

  // pega elementos do DOM
  const form = document.getElementById('empresaForm');
  const msgEl = document.getElementById('msg');
  const errorEl = document.getElementById('error');

  const resultadoCard = document.getElementById('empresaResultado');
  const logoContainer = document.getElementById('logoEmpresa');
  const dadosContainer = document.getElementById('dadosEmpresa');

  // guarda empresa carregada pra usar nos botÃµes
  let empresaAtual = null;

  // Monta endereÃ§o humano com base nos campos da parametrizaÃ§Ã£o
  function montarEndereco(emp) {
    const rua    = emp.rua    || '';
    const bairro = emp.bairro || '';
    const cidade = emp.cidade || '';
    const uf     = emp.uf     || '';
    const cep    = emp.cep    || '';

    const partes = [];

    if (rua)    partes.push(rua);
    if (bairro) partes.push(bairro);

    let cidadeUf = '';
    if (cidade) cidadeUf += cidade;
    if (uf)     cidadeUf += (cidadeUf ? ' - ' : '') + uf;
    if (cidadeUf) partes.push(cidadeUf);

    if (cep) partes.push(`CEP ${cep}`);

    if (partes.length === 0) return 'NÃ£o informado';
    return partes.join(', ');
  }

  // Renderiza o resultado quando a empresa Ã‰ encontrada
  // Agora recebe tambÃ©m o email digitado pelo usuÃ¡rio no form,
  // pra corrigir caso o backend nÃ£o mande um email vÃ¡lido.
  function renderEmpresaEncontrada(emp, emailBuscadoPeloUsuario) {
    empresaAtual = emp; // guarda pra navegaÃ§Ã£o futura

    msgEl.textContent = '';
    errorEl.textContent = '';
    resultadoCard.style.display = 'block';

    // limpa Ã¡reas
    logoContainer.innerHTML = '';
    dadosContainer.innerHTML = '';

    // tenta usar logotipoBig > logotipoSmall
    const logoB64 = emp.logotipoBig || emp.logotipoSmall || '';
    if (logoB64) {
      const src = logoB64.startsWith('data:')
        ? logoB64
        : `data:image/png;base64,${logoB64}`;

      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Logo da Empresa';
      img.style.maxWidth = '140px';
      img.style.maxHeight = '140px';
      img.style.objectFit = 'contain';
      img.style.border = '1px solid #dee2e6';
      img.style.borderRadius = '.5rem';
      img.style.backgroundColor = '#fff';
      img.style.padding = '.5rem';
      logoContainer.appendChild(img);
    }

    // captura valores crus vindos do backend
    let razaoSocialRaw  = emp.razaoSocial  || '';
    let nomeFantasiaRaw = emp.nomeFantasia || emp.nomeEmpresa || '';
    let telefoneRaw     = emp.telefone     || '';
    let emailRaw        = emp.email        || '';
    const enderecoStr   = montarEndereco(emp); // usa rua/bairro/etc

    // --- CorreÃ§Ã£o de inconsistÃªncia backend ---
    // Se razaoSocial veio vazio e emailRaw NÃƒO parece e-mail (sem "@"),
    // Ã© muito provÃ¡vel que esse "emailRaw" seja na verdade a razÃ£o social.
    if (!razaoSocialRaw && emailRaw && !emailRaw.includes('@')) {
      razaoSocialRaw = emailRaw;
      // NÃƒO apagamos emailRaw aqui ainda; vamos corrigir ele abaixo.
    }

    // --- CorreÃ§Ã£o de e-mail de exibiÃ§Ã£o ---
    // Vamos garantir que vamos mostrar um e-mail vÃ¡lido.
    // 1. Se o backend mandou algo com "@", beleza.
    // 2. Se o backend NÃƒO mandou e-mail vÃ¡lido,
    //    usamos o que o usuÃ¡rio digitou no formulÃ¡rio.
    const pareceEmailBackend = emailRaw && emailRaw.includes('@');
    const pareceEmailBusca   = emailBuscadoPeloUsuario && emailBuscadoPeloUsuario.includes('@');

    if (!pareceEmailBackend) {
      if (pareceEmailBusca) {
        emailRaw = emailBuscadoPeloUsuario;
      } else {
        // nenhum e-mail confiÃ¡vel
        emailRaw = '';
      }
    }

    // aplica fallback de exibiÃ§Ã£o
    const razaoSocial  = razaoSocialRaw  || 'NÃ£o informado';
    const nomeFantasia = nomeFantasiaRaw || 'NÃ£o informado';
    const telefone     = telefoneRaw     || 'NÃ£o informado';
    const emailFinal   = emailRaw        || 'NÃ£o informado';
    const endereco     = enderecoStr     || 'NÃ£o informado';

    // atualiza empresaAtual.email com a versÃ£o corrigida,
    // pra usar nos botÃµes/redirects depois
    empresaAtual.email = emailRaw;

    // monta bloco de dados + botÃµes
    dadosContainer.innerHTML = `
      <strong>Empresa encontrada:</strong><br>
      <b>Nome Fantasia:</b> ${nomeFantasia}<br>
      <b>RazÃ£o Social:</b> ${razaoSocial}<br>
      <b>EndereÃ§o:</b> ${endereco}<br>
      <b>Telefone:</b> ${telefone}<br>
      <b>E-mail:</b> ${emailFinal}<br><br>

      <div class="d-flex gap-3 justify-content-center mt-3">
        <button id="btnIrSistema" class="btn btn-success">Ir para o Sistema</button>
        <button id="btnIrParam" class="btn btn-secondary">Ir para ParametrizaÃ§Ã£o</button>
      </div>
    `;

    // agora que os botÃµes existem no DOM, conectar os eventos
    const btnIrSistema = document.getElementById('btnIrSistema');
    const btnIrParam = document.getElementById('btnIrParam');

    if (btnIrSistema) {
      btnIrSistema.addEventListener('click', () => {
        const emailEmp = encodeURIComponent(empresaAtual.email || '');
        const funcE    = encodeURIComponent(funcEmail || '');
        window.location.href = `index.html?emailEmpresa=${emailEmp}&nivel=${nivel}&funcEmail=${funcE}`;
      });
    }

    if (btnIrParam) {
      btnIrParam.addEventListener('click', () => {
        const emailEmp = encodeURIComponent(empresaAtual.email || '');
        window.location.href = `parametrizacao.html?emailEmpresa=${emailEmp}&nivel=${nivel}`;
      });
    }

    // opcional: esconde o form de busca depois que achou
    form.style.display = 'none';
  }

  // Caso NÃƒO encontre a empresa
  async function tratarEmpresaNaoEncontrada(emailBuscado) {
    // pergunta: jÃ¡ existe alguma empresa cadastrada no sistema?
    const existeResp = await fetch('http://localhost:8080/api/parametrizacao/existeEmpresa', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const existeEmpresa = await existeResp.json();

    if (existeEmpresa) {
      // jÃ¡ tem empresa cadastrada, entÃ£o bloquear criaÃ§Ã£o de outra
      errorEl.textContent = 'JÃ¡ existe uma empresa cadastrada. VocÃª nÃ£o pode cadastrar outra.';
      return;
    }

    // nÃ£o existe empresa ainda -> esse usuÃ¡rio vai cadastrar a primeira
    window.location.href = `parametrizacao.html?emailEmpresa=${encodeURIComponent(emailBuscado)}&nivel=${nivel}`;
  }

  // Submit do form de busca
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    msgEl.textContent = '';
    errorEl.textContent = '';
    resultadoCard.style.display = 'none';
    logoContainer.innerHTML = '';
    dadosContainer.innerHTML = '';
    empresaAtual = null;

    const emailEmpresa = form.emailEmpresa.value.trim();
    if (!emailEmpresa) {
      errorEl.textContent = 'Informe o e-mail da empresa.';
      return;
    }

    try {
      const resp = await fetch(
        `http://localhost:8080/api/parametrizacao?email=${encodeURIComponent(emailEmpresa)}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (resp.status === 404) {
        // empresa nÃ£o existe com esse email
        await tratarEmpresaNaoEncontrada(emailEmpresa);
        return;
      }

      if (!resp.ok) {
        throw new Error('Erro ao buscar empresa.');
      }

      const empresa = await resp.json();
      renderEmpresaEncontrada(empresa, emailEmpresa);

    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'Erro inesperado ao buscar empresa.';
    }
  });
});


