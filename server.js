// server.js
// Servidor do painel: autentica o time, comanda a automação e grava a auditoria.
// Rodar: node server.js

const express = require('express');
const session = require('express-session');
require('dotenv').config();

const sonax = require('./sonax');
const auditoria = require('./auditoria');

const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-este-segredo',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }, // sessão de 8h
}));

// --- Autenticação do PAINEL (não confundir com o login da SONAX) ---
// Usuários do time ficam no .env como JSON: PAINEL_USUARIOS={"pedro":"senha123","joao":"outra"}
function usuariosDoTime() {
  try { return JSON.parse(process.env.PAINEL_USUARIOS || '{}'); }
  catch { return {}; }
}

function exigirLogin(req, res, next) {
  if (req.session.usuario) return next();
  res.status(401).json({ erro: 'Faça login primeiro.' });
}

app.post('/painel/login', (req, res) => {
  const { usuario, senha } = req.body;
  const time = usuariosDoTime();
  if (time[usuario] && time[usuario] === senha) {
    req.session.usuario = usuario;
    return res.json({ ok: true, usuario });
  }
  res.status(401).json({ ok: false, erro: 'Usuário ou senha inválidos.' });
});

app.post('/painel/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/painel/eu', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

// --- Adicionar número (protegido) ---
app.post('/adicionar', exigirLogin, async (req, res) => {
  let resultado;
  try {
    resultado = await sonax.adicionarNumero(req.body.numero);
  } catch (e) {
    resultado = { status: 'erro', mensagem: e.message };
  }
  auditoria.registrar(req.session.usuario, req.body.numero, resultado);
  const codigo = resultado.status === 'erro' ? 500 : 200;
  res.status(codigo).json(resultado);
});

// --- Ver auditoria (protegido) ---
app.get('/auditoria', exigirLogin, (req, res) => {
  res.json(auditoria.listar(100));
});

// Arquivos estáticos por último
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Painel no ar: http://localhost:${PORT}\n`);
});