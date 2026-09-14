// Diagnóstico somente leitura. Não cria nem altera tabelas.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });
const { Client } = require('pg');

function connectionOptions() {
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL em backend/.env.');
  // sslmode na URL sobrescreveria o objeto ssl abaixo no driver pg; a verificação é configurada aqui.
  const url = new URL(process.env.DATABASE_URL);
  for (const param of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(param);
  // O Supabase assina o certificado do banco com uma CA própria (Database Settings > SSL Configuration).
  const caPath = process.env.DATABASE_SSL_CA;
  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    ssl: caPath ? { ca: fs.readFileSync(path.resolve(__dirname, caPath), 'utf8') } : { rejectUnauthorized: true },
  };
}

async function main() {
  const client = new Client(connectionOptions());
  try {
    await client.connect();
    await client.query('SELECT 1');
    const { rows } = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usuarios' ORDER BY ordinal_position"
    );
    console.log('Conexão PostgreSQL confirmada.');
    console.log('Colunas de public.usuarios:', rows.map(row => row.column_name + ' (' + row.data_type + ')').join(', ') || 'tabela não encontrada');
  } finally {
    await client.end().catch(() => undefined);
  }
}
main().catch((error) => {
  // Somente o código do erro: a mensagem do driver pode conter dados da conexão.
  console.error('Falha no diagnóstico' + (error?.code ? ' (' + error.code + ')' : '') + '. Nenhuma alteração foi feita no banco.');
  if (error?.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    console.error('Baixe o certificado em Supabase > Database Settings > SSL Configuration e aponte DATABASE_SSL_CA para o arquivo.');
  } else if (error instanceof Error && !error.code) {
    console.error(error.message);
  }
  process.exitCode = 1;
});
