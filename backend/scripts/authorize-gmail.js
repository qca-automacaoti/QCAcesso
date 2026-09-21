const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { google } = require('googleapis');

const backendDir = path.resolve(__dirname, '..');
const clientPath = path.resolve(backendDir, process.env.GMAIL_OAUTH_CLIENT_FILE || 'credentials/gmail-oauth-client.json');
const tokenPath = path.resolve(backendDir, process.env.GMAIL_OAUTH_TOKEN_FILE || 'credentials/gmail-token.json');
const clientConfig = JSON.parse(fs.readFileSync(clientPath, 'utf8'));
const credentials = clientConfig.installed || clientConfig.web;

if (!credentials?.client_id || !credentials?.client_secret) {
  throw new Error('O arquivo OAuth não contém client_id e client_secret.');
}

const oauth2Client = new google.auth.OAuth2(credentials.client_id, credentials.client_secret);
const scopes = ['https://www.googleapis.com/auth/gmail.send'];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/') {
      res.writeHead(404);
      res.end('Rota inválida.');
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400);
      res.end('Código OAuth ausente.');
      return;
    }
    const { tokens } = await oauth2Client.getToken({ code, redirect_uri: oauth2Client.redirectUri });
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify({ refresh_token: tokens.refresh_token }, null, 2) + '\n', { mode: 0o600 });
    res.end('Autorização concluída. Você pode fechar esta janela.');
    console.log(`Token OAuth salvo em ${tokenPath}`);
    setTimeout(() => server.close(() => process.exit(0)), 100);
  } catch (error) {
    res.writeHead(500);
    res.end('Falha ao concluir a autorização.');
    console.error(error instanceof Error ? error.message : error);
    server.close(() => process.exit(1));
  }
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  if (!port) throw new Error('Não foi possível iniciar o callback OAuth.');
  const redirectUri = `http://localhost:${port}/`;
  oauth2Client.redirectUri = redirectUri;
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes });
  console.log(`Abra esta URL no navegador para autorizar o envio pelo Gmail:\n${authUrl}`);
});
