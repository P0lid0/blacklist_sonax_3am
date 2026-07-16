// auditoria.js
// Registro de tudo que passa pelo painel: quem, qual número, quando e o resultado.

const fs = require('fs');
const CAMINHO = './auditoria.log';

function registrar(usuario, numero, resultado) {
  const linha = JSON.stringify({
    quando: new Date().toISOString(),
    usuario: usuario || 'desconhecido',
    numero: String(numero).replace(/\D/g, ''),
    status: resultado.status,
    mensagem: resultado.mensagem,
  }) + '\n';
  fs.appendFileSync(CAMINHO, linha);
}

function listar(limite = 100) {
  if (!fs.existsSync(CAMINHO)) return [];
  return fs.readFileSync(CAMINHO, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(-limite)
    .map(l => JSON.parse(l))
    .reverse(); // mais recentes primeiro
}

module.exports = { registrar, listar };