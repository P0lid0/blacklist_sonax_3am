// automacao.js
// Automação da plataforma com Puppeteer
// Rodar: node automacao.js

const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

// ===== CONFIGURAÇÃO (ajuste com os dados da sua plataforma) =====
const URL_LOGIN = 'https://omni.sonax.net.br/login';
const URL_ALVO  = 'https://omni.sonax.net.br/omnichannel-chat/bots/68488940f50ece5e46b0ff4f';
const COOKIES_PATH = './sessao.json';

// Seletores da tela de login (pegue via Inspecionar → Copy selector)
const SEL_USUARIO     = 'input[placeholder="Informe seu usuário"]';
const SEL_SENHA       = 'input[type="password"]';
const SEL_BOTAO_LOGIN = 'button::-p-text(Entrar)';
// Um seletor que SÓ existe quando você JÁ está logado (ex: menu, avatar).
// Serve pra detectar se a sessão salva ainda vale.
const SEL_LOGADO  = '#menu-usuario';
// ================================================================

async function main() {
  const browser = await puppeteer.launch({
    headless: false,       // deixe false até tudo funcionar; depois pode pôr true
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();

  try {
    await garantirLogin(page);

    // A partir daqui você está logado. Faça o que precisar:
    await page.goto(URL_ALVO, { waitUntil: 'networkidle2' });

    await preencherFormulario(page);
    await clicarAcoes(page);
    const dados = await extrairDados(page);

    salvarResultado(dados);
    console.log(`\n✅ Pronto! ${dados.length} registros salvos em resultado.json`);

  } catch (erro) {
    console.error('\n❌ Deu ruim:', erro.message);
    // tira um print pra você ver onde travou
    await page.screenshot({ path: 'erro.png', fullPage: true });
    console.log('📸 Screenshot do momento do erro salvo em erro.png');
  } finally {
    await browser.close();
  }
}

// ---- LOGIN COM REUSO DE SESSÃO ----
async function garantirLogin(page) {
  // 1) Tenta reaproveitar cookies salvos
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    await page.goto(URL_ALVO, { waitUntil: 'networkidle2' });

    // Se NÃO apareceu campo de senha, é porque já estou logado
    const precisaLogar = await page.$(SEL_SENHA);
    if (!precisaLogar) {
      console.log('🍪 Sessão reaproveitada, login pulado.');
      return;
    }
    console.log('Sessão expirou, vou logar de novo...');
  }

  // 2) Login
  await page.goto(URL_LOGIN, { waitUntil: 'networkidle2' });
  await page.waitForSelector(SEL_USUARIO);
  await page.type(SEL_USUARIO, process.env.PLATAFORMA_USUARIO);
  await page.type(SEL_SENHA, process.env.PLATAFORMA_SENHA);
  await page.click(SEL_BOTAO_LOGIN);

  // Login OK = o campo de senha some (saímos da tela de login).
  // Se tiver 2FA/captcha, resolva na mão agora — o script espera aqui.
  await page.waitForSelector(SEL_SENHA, { hidden: true, timeout: 60000 });

  // 3) Salva cookies pra próxima vez
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('🔐 Login feito e sessão salva.');
}
// ---- PREENCHER FORMULÁRIO ----
async function preencherFormulario(page) {
  // Exemplo — troque os seletores pelos da sua tela
  // await page.waitForSelector('#campo-data');
  // await page.type('#campo-data', '2026-07-15');
  // await page.select('#dropdown-tipo', 'opcao-desejada'); // pra <select>
  // await page.click('#checkbox-x');
  // await page.click('#botao-buscar');
  // await page.waitForNavigation({ waitUntil: 'networkidle2' });
}

// ---- CLICAR EM COISAS (inclusive repetidas) ----
async function clicarAcoes(page) {
  // Exemplo de loop clicando em vários itens de uma lista:
  // const botoes = await page.$$('.linha-tabela .botao-abrir');
  // for (const botao of botoes) {
  //   await botao.click();
  //   await page.waitForSelector('.detalhe-carregado');
  //   // ... faz algo com o detalhe ...
  //   await page.goBack({ waitUntil: 'networkidle2' });
  // }
}

// ---- EXTRAIR DADOS ----
async function extrairDados(page) {
  await page.waitForSelector('.tabela'); // espere a tabela existir antes de ler

  // Tudo dentro de evaluate roda no navegador (tem acesso ao document)
  const dados = await page.evaluate(() => {
    const linhas = document.querySelectorAll('.tabela tbody tr');
    return Array.from(linhas).map(tr => {
      const celulas = tr.querySelectorAll('td');
      return {
        coluna1: celulas[0]?.innerText.trim(),
        coluna2: celulas[1]?.innerText.trim(),
        coluna3: celulas[2]?.innerText.trim(),
      };
    });
  });

  return dados;
}

// ---- SALVAR RESULTADO ----
function salvarResultado(dados) {
  fs.writeFileSync('resultado.json', JSON.stringify(dados, null, 2));
  // Se preferir CSV, dá pra converter aqui também.
}

main();