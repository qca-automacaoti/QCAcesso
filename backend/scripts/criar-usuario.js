// Cria (ou atualiza) um usuário do QCAcesso: Supabase Auth + public.usuarios.
// Uso (dentro de backend/): npm run criar-usuario
// A Secret key é pedida na hora e não é gravada; a API da aplicação continua usando só a chave pública.
const path = require('node:path');
const readline = require('node:readline');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const PERFIS = ['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR'];
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
let muted = false;
rl._writeToOutput = (text) => { if (!muted) rl.output.write(text); }; // oculta o que é digitado em senhas/chaves
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (hidden) { muted = false; rl.output.write('\n'); }
      resolve(hidden ? answer : answer.trim());
    });
    muted = hidden;
  });
}

function isSecretKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role === 'service_role'; }
  catch { return false; }
}

async function findUserByEmail(admin, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found || data.users.length < 1000) return found;
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !publicKey) throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY em backend/.env.');

  console.log('Criar usuário do QCAcesso em ' + url + '\n');
  console.log('A Secret key fica em Supabase > Project Settings > API Keys (sb_secret_... ou service_role).');
  console.log('Ela é usada só nesta execução e não é gravada. O texto digitado fica oculto.\n');
  const secretKey = (await ask('Secret key: ', true)).trim();
  if (!isSecretKey(secretKey)) throw new Error('Isso não é uma Secret key (sb_secret_...) nem uma chave service_role.');

  const nome = await ask('Nome: ');
  if (!nome) throw new Error('Informe o nome.');
  const email = (await ask('E-mail: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
  const senha = await ask('Senha (mínimo 8 caracteres, fica oculta): ', true);
  if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  if ((await ask('Confirme a senha: ', true)) !== senha) throw new Error('As senhas não conferem.');
  const perfil = (await ask('Perfil [' + PERFIS.join('/') + '] (Enter = ADMIN): ')).toUpperCase() || 'ADMIN';
  if (!PERFIS.includes(perfil)) throw new Error('Perfil inválido. Use ' + PERFIS.join(', ') + '.');

  const admin = createClient(url, secretKey, clientOptions);
  let userId;
  const existente = await findUserByEmail(admin, email);
  if (existente) {
    const resposta = (await ask('Já existe um usuário com ' + email + '. Atualizar senha, nome e perfil? (s/N): ')).toLowerCase();
    if (resposta !== 's') { console.log('Nada foi alterado.'); return; }
    const { error } = await admin.auth.admin.updateUserById(existente.id, { password: senha, email_confirm: true, user_metadata: { nome } });
    if (error) throw error;
    userId = existente.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
    if (error) throw error;
    userId = data.user.id;
  }

  // O gatilho handle_new_user cria a linha como SUPERVISOR; aqui ficam nome, perfil e ativo definitivos.
  const { error: perfilError } = await admin.from('usuarios').upsert({ id: userId, nome, email, perfil, ativo: true }, { onConflict: 'id' });
  if (perfilError) throw perfilError;

  // Confere o login do mesmo jeito que a API faz (chave pública).
  const publico = createClient(url, publicKey, clientOptions);
  const { error: loginError } = await publico.auth.signInWithPassword({ email, password: senha });
  if (loginError) throw new Error('Usuário salvo, mas o login de teste falhou: ' + loginError.message);
  await publico.auth.signOut({ scope: 'local' }).catch(() => undefined);

  console.log('\nPronto! ' + nome + ' <' + email + '> com perfil ' + perfil + (existente ? ' atualizado' : ' criado') + ' e login verificado.');
  console.log('Entre em http://localhost:5173 com esse e-mail e senha.');
}

main()
  .catch((error) => {
    console.error('\nErro: ' + (error && error.message ? error.message : 'falha inesperada.'));
    process.exitCode = 1;
  })
  .finally(() => rl.close());
