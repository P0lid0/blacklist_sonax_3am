// sonax.js
const puppeteer = require('puppeteer');
const fs = require('fs');

const URL_BASE = (process.env.SONAX_URL || 'https://omni.sonax.net.br').replace(/\/+$/, '');
const COOKIES_PATH = './sessao.json';

// --- LOGIN ---
const SEL_USUARIO     = 'input[placeholder="Informe seu usuário"]';
const SEL_SENHA       = 'input[type="password"]';
const SEL_BOTAO_LOGIN = 'button::-p-text(Entrar)';

// --- NÓ / modal ---
const SEL_CONDICIONAL  = 'input[placeholder="Condicional"]';
const SEL_BOTAO_MAIS   = process.env.SEL_MAIS   || 'a.btn-outline-success';
const SEL_BOTAO_SALVAR = process.env.SEL_SALVAR || 'button::-p-text(Salvar)';

// --- Caminho DIRETO pro bot (sem menu, sem busca) ---
const BOT_PATH = process.env.BOT_PATH || '/omnichannel-chat/bots/68488940f50ece5e46b0ff4f';
const NODE_ID  = process.env.NODE_ID  || 'ZpzeWvsfIF';
const TAG_ACAO = process.env.TAG_ACAO || 'G04dF8alHd';

let browser = null;
let page = null;

async function garantirNavegador() {
  if (browser && page && !page.isClosed()) return;
  browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'false' ? false : true,
    // viewport FIXO: em headless o padrão é pequeno e o layout da SONAX muda
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });
  const paginas = await browser.pages();
  page = paginas[0] || await browser.newPage();
  browser.on('disconnected', () => { browser = null; page = null; });
}

// Fecha tudo e recomeça do zero (usado quando algo trava)
async function resetarNavegador() {
  try { if (browser) await browser.close(); } catch {}
  browser = null; page = null;
  await garantirNavegador();
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

async function tirarPrint() {
  try {
    await page.screenshot({ path: './erro.png' });
    console.log('  📸 print do erro salvo em erro.png');
  } catch {}
}

async function irAteONo() {
  console.log('  → passo 1: abrir o bot direto pela URL');
  await page.goto(URL_BASE + BOT_PATH, { waitUntil: 'networkidle2' });

  // Se caiu na tela de login, loga e volta pro bot
  if (await page.$(SEL_SENHA)) {
    console.log('    (sessão caiu, refazendo login)');
    await login();
    await page.goto(URL_BASE + BOT_PATH, { waitUntil: 'networkidle2' });
  }

  await fecharPopup();

  console.log('  → passo 2: abrir o fluxo Principal');
  await page.waitForSelector('::-p-text(Principal)', { timeout: 30000 });
  await page.click('::-p-text(Principal)');
  await new Promise(r => setTimeout(r, 2500));

  console.log('  → passo 3: clicar no nó da blacklist');
  await page.waitForSelector(`#${NODE_ID}`, { timeout: 60000 });
  await page.evaluate((id) => {
    document.querySelector('#' + id).scrollIntoView({ block: 'center', inline: 'center' });
  }, NODE_ID);
  await new Promise(r => setTimeout(r, 1000));

  const el = await page.$(`#${NODE_ID}`);
  const box = await el.boundingBox();
  const naTela = box && box.x >= 0 && box.y >= 0 && box.x < 1920 && box.y < 1080;
  if (naTela) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    // fallback: se o nó ficou fora da área visível, dispara o clique direto
    await page.evaluate((id) => {
      const no = document.querySelector('#' + id);
      const alvo = no.querySelector('.node') || no;
      alvo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, view: window }));
      alvo.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window }));
      alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }, NODE_ID);
  }
  await new Promise(r => setTimeout(r, 1200));

  console.log('  → passo 4: abrir a edição do nó (lápis)');
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

  // 1ª tentativa; se falhar, reseta o navegador e tenta de novo do zero
  try {
    await garantirNoNo();
  } catch (e) {
    console.warn('⚠️ falhou, recomeçando do zero:', e.message);
    await tirarPrint();
    try {
      await resetarNavegador();
      await garantirNoNo();
    } catch (e2) {
      await tirarPrint();
      console.error('❌ Travou ao ir até o nó:', e2.message);
      return { status: 'erro', mensagem: `Travou ao ir até o nó: ${e2.message}` };
    }
  }

  // Duplicado?
  const existentes = await page.$$eval(SEL_CONDICIONAL, els => els.map(e => e.value));
  if (existentes.map(v => v.replace(/\D/g, '')).includes(numero)) {
    return { status: 'duplicado', mensagem: `${numero} já está na lista.` };
  }

  // Cria a condição nova
  await page.click(SEL_BOTAO_MAIS);
  await new Promise(r => setTimeout(r, 800));

  const resultado = await page.evaluate((numero, tagValor) => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder="Condicional"]'));
    const vazio = inputs.find(i => !i.value.trim());
    if (!vazio) return { ok: false, motivo: 'sem linha vazia' };

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(vazio, 'contact.celular == ' + numero);
    vazio.dispatchEvent(new Event('input', { bubbles: true }));
    vazio.dispatchEvent(new Event('change', { bubbles: true }));

    let container = vazio.parentElement;
    let select = null;
    for (let i = 0; i < 6 && container; i++) {
      const s = container.querySelector('select');
      if (s) { select = s; break; }
      container = container.parentElement;
    }
    if (!select) return { ok: true, tag: false, motivo: 'texto ok, select não encontrado' };

    const opt = Array.from(select.options).find(o =>
      o.value.includes(tagValor) || o.textContent.includes(tagValor)
    );
    if (!opt) return { ok: true, tag: false, motivo: 'opção do nó não encontrada' };

    const selSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    selSetter.call(select, opt.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, tag: true };
  }, numero, TAG_ACAO);

  if (!resultado.ok) {
    await tirarPrint();
    return { status: 'erro', mensagem: `Não preencheu a linha: ${resultado.motivo}` };
  }
  if (!resultado.tag) {
    console.warn('  ⚠️ texto preenchido, mas o dropdown do nó não:', resultado.motivo);
  }
  await new Promise(r => setTimeout(r, 500));

  await page.click(SEL_BOTAO_SALVAR);
  return { status: 'ok', mensagem: `${numero} adicionado.` };
}

module.exports = { adicionarNumero };