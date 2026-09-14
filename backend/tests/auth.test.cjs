// Testes da Fase 1 (auth) contra o build em dist/, com provedor de identidade falso (sem Supabase).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../dist/app');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { requirePerfil } = require('../dist/modules/auth/auth.middleware');
const { AuthError } = require('../dist/modules/auth/auth.types');

const config = {
  PORT: 0, NODE_ENV: 'test', FRONTEND_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: 'https://exemplo.supabase.co', SUPABASE_KEY: 'sb_publishable_teste', SESSION_TTL_MS: 60_000,
};
const usuario = (email, perfil, ativo = true) => ({ id: email, nome: email.split('@')[0], email, perfil, ativo, created_at: '' });
const contas = {
  'admin@qca.com.br': { senha: 'senha-admin', usuario: usuario('admin@qca.com.br', 'ADMIN') },
  'inativo@qca.com.br': { senha: 'senha-inativo', usuario: usuario('inativo@qca.com.br', 'RH', false) },
};

function fakeProvider() {
  return {
    async health() {},
    createSession() {
      let atual = null;
      return {
        async signIn(email, senha) {
          if (contas[email]?.senha !== senha) throw new AuthError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.');
          return (atual = contas[email].usuario);
        },
        async currentUser() {
          if (!atual) throw new AuthError(401, 'SESSAO_EXPIRADA', 'Sua sessão expirou. Entre novamente.');
          return atual;
        },
        async signOut() { atual = null; },
      };
    },
  };
}

async function withApi(fn) {
  const auth = new AuthService(fakeProvider(), config.SESSION_TTL_MS);
  const server = createApp(config, auth).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (path, { body, cookie, headers = {} } = {}) => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-QCA-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try { await fn(call); } finally { auth.close(); server.close(); }
}
const sessionCookie = (res) => res.headers.getSetCookie().find((c) => c.startsWith('qca_session=') && !c.startsWith('qca_session=;'));

test('health responde ok', () => withApi(async (call) => {
  const res = await call('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', database: 'connected' });
}));

test('/auth/me sem sessão retorna 401', () => withApi(async (call) => {
  const res = await call('/auth/me');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'SESSAO_EXPIRADA');
}));

test('senha errada retorna 401 e não cria sessão', () => withApi(async (call) => {
  const res = await call('/auth/login', { body: { email: 'admin@qca.com.br', senha: 'errada' } });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'CREDENCIAIS_INVALIDAS');
  assert.equal(sessionCookie(res), undefined);
}));

test('login → me → logout → me revogado', () => withApi(async (call) => {
  const login = await call('/auth/login', { body: { email: ' Admin@QCA.com.br ', senha: 'senha-admin' } });
  assert.equal(login.status, 200);
  assert.deepEqual((await login.json()).usuario, { id: 'admin@qca.com.br', nome: 'admin', email: 'admin@qca.com.br', perfil: 'ADMIN' });
  const setCookie = sessionCookie(login);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const me = await call('/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).usuario.perfil, 'ADMIN');

  assert.equal((await call('/auth/logout', { body: {}, cookie })).status, 204);
  assert.equal((await call('/auth/me', { cookie })).status, 401);
}));

test('usuário inativo é recusado com 403', () => withApi(async (call) => {
  const res = await call('/auth/login', { body: { email: 'inativo@qca.com.br', senha: 'senha-inativo' } });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'ACESSO_NEGADO');
}));

test('POST sem cabeçalho X-QCA-Request ou de outra origem é recusado', () => withApi(async (call) => {
  const body = { email: 'admin@qca.com.br', senha: 'senha-admin' };
  assert.equal((await call('/auth/login', { body, headers: { 'X-QCA-Request': '0' } })).status, 403);
  assert.equal((await call('/auth/login', { body, headers: { Origin: 'https://malicioso.example' } })).status, 403);
}));

test('requirePerfil bloqueia perfis não autorizados', () => {
  const run = (perfil) => {
    let result;
    requirePerfil('ADMIN', 'RH')({}, { locals: perfil ? { usuario: { perfil } } : {} }, (err) => { result = err; });
    return result;
  };
  assert.equal(run('ADMIN'), undefined);
  assert.equal(run('SUPERVISOR').status, 403);
  assert.equal(run(undefined).status, 401);
});
