document.addEventListener('DOMContentLoaded', () => {
  // pega nível de acesso e email do funcionário logado da querystring
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

  // guarda empresa carregada pra usar nos botões
  let empresaAtual = null;

  // Monta endereço humano com base nos campos da parametrização
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

    if (partes.length === 0) return 'Não informado';
    return partes.join(', ');
  }

  // Renderiza o resultado quando a empresa �? encontrada
  // Agora recebe também o email digitado pelo usuário no form,
  // pra corrigir caso o backend não mande um email válido.
  function renderEmpresaEncontrada(emp, emailBuscadoPeloUsuario) {
    empresaAtual = emp; // guarda pra navegação futura

    msgEl.textContent = '';
    errorEl.textContent = '';
    resultadoCard.style.display = 'block';

    // limpa áreas
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

    // --- Correção de inconsistência backend ---
    // Se razaoSocial veio vazio e emailRaw N�fO parece e-mail (sem "@"),
    // é muito provável que esse "emailRaw" seja na verdade a razão social.
    if (!razaoSocialRaw && emailRaw && !emailRaw.includes('@')) {
      razaoSocialRaw = emailRaw;
      // N�fO apagamos emailRaw aqui ainda; vamos corrigir ele abaixo.
    }

    // --- Correção de e-mail de exibição ---
    // Vamos garantir que vamos mostrar um e-mail válido.
    // 1. Se o backend mandou algo com "@", beleza.
    // 2. Se o backend N�fO mandou e-mail válido,
    //    usamos o que o usuário digitou no formulário.
    const pareceEmailBackend = emailRaw && emailRaw.includes('@');
    const pareceEmailBusca   = emailBuscadoPeloUsuario && emailBuscadoPeloUsuario.includes('@');

    if (!pareceEmailBackend) {
      if (pareceEmailBusca) {
        emailRaw = emailBuscadoPeloUsuario;
      } else {
        // nenhum e-mail confiável
        emailRaw = '';
      }
    }

    // aplica fallback de exibição
    const razaoSocial  = razaoSocialRaw  || 'Não informado';
    const nomeFantasia = nomeFantasiaRaw || 'Não informado';
    const telefone     = telefoneRaw     || 'Não informado';
    const emailFinal   = emailRaw        || 'Não informado';
    const endereco     = enderecoStr     || 'Não informado';

    // atualiza empresaAtual.email com a versão corrigida,
    // pra usar nos botões/redirects depois
    empresaAtual.email = emailRaw;

    // monta bloco de dados + botões
    dadosContainer.innerHTML = `
      <strong>Empresa encontrada:</strong><br>
      <b>Nome Fantasia:</b> ${nomeFantasia}<br>
      <b>Razão Social:</b> ${razaoSocial}<br>
      <b>Endereço:</b> ${endereco}<br>
      <b>Telefone:</b> ${telefone}<br>
      <b>E-mail:</b> ${emailFinal}<br><br>

      <div class="d-flex gap-3 justify-content-center mt-3">
        <button id="btnIrSistema" class="btn btn-success">Ir para o Sistema</button>
        <button id="btnIrParam" class="btn btn-secondary">Ir para Parametrização</button>
      </div>
    `;

    // agora que os botões existem no DOM, conectar os eventos
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

  // Caso N�fO encontre a empresa
  async function tratarEmpresaNaoEncontrada(emailBuscado) {
    // pergunta: já existe alguma empresa cadastrada no sistema?
    const existeResp = await fetch('http://localhost:8080/api/parametrizacao/existeEmpresa', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const existeEmpresa = await existeResp.json();

    if (existeEmpresa) {
      // já tem empresa cadastrada, então bloquear criação de outra
      errorEl.textContent = 'Já existe uma empresa cadastrada. Você não pode cadastrar outra.';
      return;
    }

    // não existe empresa ainda -> esse usuário vai cadastrar a primeira
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
        // empresa não existe com esse email
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


