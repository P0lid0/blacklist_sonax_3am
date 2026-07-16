# Blacklist SONAX

Painel interno para adicionar números à condicional de um nó da SONAX, com login do time e auditoria.

## O que ainda falta preencher

1. **Caminho até o nó** — em `sonax.js`, função `irAteONo()`. Cole o resultado do Chrome Recorder.
2. **Dois seletores** — no `.env`: `SEL_MAIS` (o "+" verde) e `SEL_SALVAR` (botão salvar).

## Passo 1 — Rodar na sua máquina (recomendado antes do VPS)

```bash
npm install
cp .env.exemplo .env      # depois edite o .env com os dados reais
node server.js
```

Abra http://localhost:3000 → faça login com um usuário do `PAINEL_USUARIOS` →
digite um número e Enter. Com `HEADLESS=false` no `.env`, você vê o navegador trabalhando.

## Passo 2 — Subir no VPS (só depois de funcionar local)

1. Suba os arquivos pro servidor (sem `node_modules`, sem `.env`).
2. No VPS: instale Node 18+ e as bibliotecas de sistema do Chromium.
3. Crie o `.env` no servidor com `HEADLESS=true` (ou apague essa linha).
4. `npm install`
5. Rode com um gerenciador de processo (ex.: `pm2`) pra reiniciar sozinho:
   ```bash
   npm install -g pm2
   pm2 start server.js --name blacklist-sonax
   pm2 save
   ```
6. Coloque atrás de um proxy com **HTTPS** (Nginx + Certbot) antes de liberar pro time.

## Segurança (importante)

- `.env` e `sessao.json` nunca vão pro Git.
- Troque `SESSION_SECRET` por uma string aleatória longa.
- O painel altera produção: a aba "Histórico" mostra quem fez o quê e quando.