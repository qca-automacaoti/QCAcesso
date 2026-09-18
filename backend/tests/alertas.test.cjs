const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderizarAlerta } = require('../dist/modules/alertas/email.templates');

test('template de alerta escapa conteúdo importado antes de renderizar HTML', () => {
  const email = renderizarAlerta({
    tipoAlerta: 'LEMBRETE_BLOQUEIO',
    tipoAcao: 'BLOQUEIO',
    nome: '<img src=x onerror=alert(1)>\r\nEquipe',
    empresa: 'QCA & Associados',
    cadastro: 'A-12',
    dataProgramada: '2026-09-19',
    dataInicio: '2026-09-19',
    dataFim: '2026-10-02',
    urlControle: 'https://qca.example/app/controle-acesso',
  });

  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(email.html, /QCA &amp; Associados/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.match(email.text, /bloqueio de acesso previsto para amanhã/);
});

test('template de escalonamento identifica a ação atrasada', () => {
  const email = renderizarAlerta({
    tipoAlerta: 'ESCALONAMENTO_ATRASO',
    tipoAcao: 'DESBLOQUEIO',
    nome: 'Colaborador',
    empresa: 'Recife',
    cadastro: '123',
    dataProgramada: '2026-09-17',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-17',
    urlControle: 'https://qca.example/app/controle-acesso',
  });

  assert.match(email.subject, /Ação atrasada: desbloqueio de acesso/);
  assert.match(email.text, /está atrasada/);
});
