/**
 * Teste de Conexão com o Supabase PostgreSQL
 * Executa diagnósticos completos de conectividade, autenticação e permissões.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

async function testConnection() {
  console.log('='.repeat(60));
  console.log('🔍 INICIANDO DIAGNÓSTICO DE CONEXÃO COM SUPABASE');
  console.log('='.repeat(60));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERRO: DATABASE_URL não definida no arquivo .env');
    process.exit(1);
  }

  // Mascarar a senha para exibição segura nos logs
  const maskedUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log(`📌 Conectando a: ${maskedUrl}`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const startTime = Date.now();
    await client.connect();
    const duration = Date.now() - startTime;

    console.log(`✅ Conexão estabelecida com sucesso! (${duration}ms)`);

    // 1. Informações da Sessão
    const sessionRes = await client.query(`
      SELECT 
        current_database() AS database,
        current_user AS user,
        version() AS version,
        NOW() AS server_time
    `);
    const session = sessionRes.rows[0];

    console.log('\n📊 INFORMAÇÕES DA SESSÃO:');
    console.log(`   - Banco de Dados: ${session.database}`);
    console.log(`   - Usuário:        ${session.user}`);
    console.log(`   - Horário Servidor: ${session.server_time}`);
    console.log(`   - Versão PG:      ${session.version.split(',')[0]}`);

    // 2. Teste de Consulta de Tabelas no Schema 'public'
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📁 TABELAS NO SCHEMA PUBLIC:');
    if (tablesRes.rows.length === 0) {
      console.log('   (Nenhuma tabela criada ainda - pronto para migrations)');
    } else {
      tablesRes.rows.forEach(t => console.log(`   - ${t.table_name}`));
    }

    // 3. Teste de Operação de Leitura e Escrita (Criar e Deletar tabela temporária de teste)
    console.log('\n🧪 TESTANDO PERMISSÕES DDL E DML:');
    await client.query('CREATE TABLE IF NOT EXISTS _test_qcacesso_conn (id SERIAL PRIMARY KEY, test_val TEXT);');
    console.log('   - CREATE TABLE: Sucesso');

    await client.query("INSERT INTO _test_qcacesso_conn (test_val) VALUES ('teste_conexao_qcacesso');");
    console.log('   - INSERT:       Sucesso');

    const selectTest = await client.query('SELECT * FROM _test_qcacesso_conn;');
    console.log(`   - SELECT:       Sucesso (${selectTest.rows.length} registro(s))`);

    await client.query('DROP TABLE _test_qcacesso_conn;');
    console.log('   - DROP TABLE:   Sucesso (limpeza realizada)');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TODOS OS TESTES PASSARAM! BANCO SUPABASE TOTALMENTE ACESSÍVEL!');
    console.log('='.repeat(60));

    await client.end();
  } catch (error) {
    console.error('\n❌ FALHA NA CONEXÃO OU TESTE:');
    console.error(error.message);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

testConnection();
