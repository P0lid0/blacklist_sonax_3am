// sonax.js
// Automação da SONAX: login, navegar até o nó da blacklist e adicionar número.

const puppeteer = require('puppeteer');
const fs = require('fs');

const URL_BASE = (process.env.SONAX_URL || 'https://omni.sonax.net.br').replace(/\/+$/, '');
const COOKIES_PATH = './sessao.json';

// --- Seletores de LOGIN ---
const SEL_USUARIO     = 'input[placeholder="Informe seu usuário"]';
const SEL_SENHA       = 'input[type="password"]';
const SEL_BOTAO_LOGIN = 'button::-p-text(Entrar)';

// --- Seletores do NÓ / modal ---
const SEL_CONDICIONAL  = 'input[placeholder="Condicional"]';
const SEL_BOTAO_MAIS   = process.env.SEL_MAIS   || 'a.btn-outline-success';
const SEL_BOTAO_SALVAR = process.env.SEL_SALVAR || 'button::-p-text(Salvar)';

// --- Identificadores específicos do bot/nó ---
const NOME_BOT = process.env.BOT_NOME || 'Bot Recrutamento IA V3 (Receptivo)';
const NODE_ID  = process.env.NODE_ID  || 'ZpzeWvsfIF';   // nó Condicional BLACKLIST
const TAG_ACAO = process.env.TAG_ACAO || 'G04dF8alHd';   // nó seguinte que toda linha aponta

let browser = null;
let page = null;

async function garantirNavegador() {
  if (browser && page && !page.isClosed()) return;
  browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'false' ? false : true,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
  });
  const paginas = await browser.pages();
  page = paginas[0] || await browser.newPage();
  browser.on('disconnected', () => { browser = null; page = null; });
}

async function estaLogado() {
  return !(await page.$(SEL_SENHA));
}

async function login() {
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
  }
  await page.goto(URL_BASE + '/login', { waitUntil: 'networkidle2' });
  if (await estaLogado()) return;

  await page.waitForSelector(SEL_USUARIO);
  await page.click(SEL_USUARIO, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(SEL_USUARIO, process.env.SONAX_USUARIO);
  await page.type(SEL_SENHA, process.env.SONAX_SENHA);
  await page.click(SEL_BOTAO_LOGIN);
  await page.waitForSelector(SEL_SENHA, { hidden: true, timeout: 60000 });

  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
}

async function clicarXpath(xp) {
  await page.waitForSelector(`xpath/${xp}`, { timeout: 20000 });
  await page.click(`xpath/${xp}`);
}

async function fecharPopup() {
  try {
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));
  } catch {}
  const SELETORES_FECHAR = [
    'button::-p-text(Fechar)', 'button::-p-text(Entendi)', 'button::-p-text(OK)',
    '.modal button.close', '[aria-label="Close"]',
  ];
  for (const sel of SELETORES_FECHAR) {
    try {
      const botao = await page.$(sel);
      if (botao) { await botao.click(); await new Promise(r => setTimeout(r, 400)); break; }
    } catch {}
  }
}

async function irAteONo() {
  console.log('  → passo 1: abrir menu e clicar em Bots');
  await clicarXpath('/html/body/app-root/app-layout-omnichannel/div/div/div/div/app-sidebar/div[1]/nav/div[2]/div');
  await page.waitForSelector('::-p-text(Bots)', { timeout: 20000 });
  await page.click('::-p-text(Bots)');

  await new Promise(r => setTimeout(r, 1000));
  await fecharPopup();

  console.log('  → passo 2: buscar o bot pelo nome');
  await page.waitForSelector('app-flows input', { timeout: 20000 });
  const campoBusca = await page.$('app-flows input');
  await campoBusca.click({ clickCount: 3 });
  await campoBusca.press('Backspace');
  await campoBusca.type(NOME_BOT);
  await new Promise(r => setTimeout(r, 1500));

  console.log('  → passo 3: clicar em Configurar do bot');
  const xpathConfig = `//tr[contains(., "${NOME_BOT}")]//button[contains(., "Configurar")]`;
  const botaoConfig = await page.waitForSelector(`xpath/${xpathConfig}`, { timeout: 20000 });
  await botaoConfig.evaluate(el => el.click());

  console.log('  → passo 4: abrir o fluxo Principal (força o grafo a carregar)');
  await page.waitForSelector('::-p-text(Principal)', { timeout: 20000 });
  await page.click('::-p-text(Principal)');
  await new Promise(r => setTimeout(r, 2500));

  console.log('  → passo 5: rolar até o nó e clicar nele de verdade');
  await page.waitForSelector(`#${NODE_ID}`, { timeout: 60000 });
  await page.evaluate((id) => {
    document.querySelector('#' + id).scrollIntoView({ block: 'center', inline: 'center' });
  }, NODE_ID);
  await new Promise(r => setTimeout(r, 1000));
  const box = await (await page.$(`#${NODE_ID}`)).boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await new Promise(r => setTimeout(r, 1200));

  console.log('  → passo 6: aguardar o painel do nó e clicar no lápis');
  await page.waitForSelector('a.item-node-action-button i.fa-pencil', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const lapis = document.querySelector('a.item-node-action-button');
    if (lapis) lapis.click();
  });

  await page.waitForSelector(SEL_CONDICIONAL, { timeout: 30000 });
  console.log('  ✓ modal do nó aberto');
}

async function garantirNoNo() {
  await garantirNavegador();
  const naSonax = page.url().includes('sonax.net.br');
  if (!naSonax || !(await estaLogado())) {
    console.log('→ fazendo login na SONAX...');
    await login();
    console.log('✓ logado');
  }
  const noAberto = await page.$(SEL_CONDICIONAL);
  if (!noAberto) {
    console.log('→ navegando até o nó da blacklist...');
    await irAteONo();
  }
}

async function adicionarNumero(numeroBruto) {
  const numero = String(numeroBruto).replace(/\D/g, '');
  if (numero.length < 10) {
    return { status: 'invalido', mensagem: `"${numeroBruto}" tem poucos dígitos, ignorado.` };
  }
  if (!process.env.SONAX_USUARIO || !process.env.SONAX_SENHA) {
    return { status: 'erro', mensagem: 'Faltam SONAX_USUARIO e SONAX_SENHA no .env.' };
  }

  try {
    await garantirNoNo();
  } catch (e) {
    console.error('❌ Travou ao ir até o nó:', e.message);
    return { status: 'erro', mensagem: `Travou ao ir até o nó: ${e.message}` };
  }

  // Duplicado?
  const existentes = await page.$$eval(SEL_CONDICIONAL, els => els.map(e => e.value));
  if (existentes.map(v => v.replace(/\D/g, '')).includes(numero)) {
    return { status: 'duplicado', mensagem: `${numero} já está na lista.` };
  }

  // Cria a condição nova
  await page.click(SEL_BOTAO_MAIS);
  await new Promise(r => setTimeout(r, 800)); // espera a linha nova surgir

  // Preenche a PRIMEIRA linha vazia: texto + dropdown (nó seguinte) na MESMA linha
  const resultado = await page.evaluate((numero, tagValor) => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder="Condicional"]'));
    const vazio = inputs.find(i => !i.value.trim());
    if (!vazio) return { ok: false, motivo: 'sem linha vazia' };

    // 1) escreve o texto forçando o Angular a reconhecer
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(vazio, 'contact.celular == ' + numero);
    vazio.dispatchEvent(new Event('input', { bubbles: true }));
    vazio.dispatchEvent(new Event('change', { bubbles: true }));

    // 2) sobe no DOM até achar a linha inteira e pegar o <select> dela
    let container = vazio.parentElement;
    let select = null;
    for (let i = 0; i < 6 && container; i++) {
      const s = container.querySelector('select');
      if (s) { select = s; break; }
      container = container.parentElement;
    }
    if (!select) return { ok: true, tag: false, motivo: 'texto ok, select não encontrado' };

    // 3) escolhe a opção que contém o nó desejado (formato pode ser "5: G04...")
    const opt = Array.from(select.options).find(o =>
      o.value.includes(tagValor) || o.textContent.includes(tagValor)
    );
    if (!opt) return { ok: true, tag: false, motivo: 'opção do nó não encontrada' };

    // seleção via setter nativo + evento change (Angular)
    const selSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    selSetter.call(select, opt.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, tag: true };
  }, numero, TAG_ACAO);

  if (!resultado.ok) {
    return { status: 'erro', mensagem: `Não preencheu a linha: ${resultado.motivo}` };
  }
  if (!resultado.tag) {
    console.warn('  ⚠️ texto preenchido, mas o dropdown do nó não:', resultado.motivo);
  }
  await new Promise(r => setTimeout(r, 500));

  // Salva
  await page.click(SEL_BOTAO_SALVAR);

  return { status: 'ok', mensagem: `${numero} adicionado.` };
}

module.exports = { adicionarNumero };