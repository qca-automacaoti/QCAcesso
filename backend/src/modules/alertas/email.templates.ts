import type { TipoAcao, TipoAlerta } from '../../config/database.types';

export interface AlertaEmailData {
  tipoAlerta: TipoAlerta;
  tipoAcao: TipoAcao;
  nome: string;
  empresa: string;
  cadastro: string;
  dataProgramada: string;
  dataInicio: string;
  dataFim: string;
  urlControle: string;
}

export interface EmailTemplateConfig {
  assunto: string;
  mensagem: string;
}

export const EMAIL_TEMPLATE_VARIAVEIS = [
  'nome', 'empresa', 'cadastro', 'dataProgramada', 'dataInicio', 'dataFim',
  'tipoAcao', 'tipoAlerta', 'chamada', 'link',
] as const;

export interface EmailRenderizado { subject: string; text: string; html: string }

function escaparHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function formatarData(value: string) {
  const [ano, mes, dia] = value.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function renderizarAlerta(data: AlertaEmailData, template?: EmailTemplateConfig): EmailRenderizado {
  const bloqueio = data.tipoAcao === 'BLOQUEIO';
  const atrasado = data.tipoAlerta === 'ESCALONAMENTO_ATRASO';
  const assuntoAcao = bloqueio ? 'bloqueio de acesso' : 'desbloqueio de acesso';
  const chamada = atrasado ? `A ação de ${assuntoAcao} está atrasada.` : `Lembrete: ${assuntoAcao} previsto para amanhã.`;
  const nome = escaparHtml(data.nome);
  const empresa = escaparHtml(data.empresa);
  const cadastro = escaparHtml(data.cadastro);
  const url = escaparHtml(data.urlControle);
  const dataProgramada = formatarData(data.dataProgramada);
  const periodo = `${formatarData(data.dataInicio)} a ${formatarData(data.dataFim)}`;
  const assuntoNome = data.nome.replace(/[\r\n]+/g, ' ').trim();
  const subject = `${atrasado ? 'Ação atrasada' : 'Lembrete'}: ${assuntoAcao} — ${assuntoNome}`;
  const text = `${chamada}\n\nFuncionário: ${data.nome}\nEmpresa: ${data.empresa}\nCadastro: ${data.cadastro}\nAção programada: ${dataProgramada}\nPeríodo de férias: ${periodo}\n\nAcesse o QCAcesso para acompanhar e registrar a execução: ${data.urlControle}`;
  if (template) {
    const valores: Record<string, string> = {
      nome: data.nome, empresa: data.empresa, cadastro: data.cadastro,
      dataProgramada, dataInicio: formatarData(data.dataInicio), dataFim: formatarData(data.dataFim),
      tipoAcao: data.tipoAcao === 'BLOQUEIO' ? 'Bloqueio' : 'Desbloqueio',
      tipoAlerta: atrasado ? 'Escalonamento de atraso' : (data.tipoAcao === 'BLOQUEIO' ? 'Lembrete de bloqueio' : 'Lembrete de desbloqueio'),
      chamada, link: data.urlControle,
    };
    const renderizar = (value: string) => value.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_match, key: string) => valores[key] ?? '');
    const assuntoConfigurado = renderizar(template.assunto).replace(/[\r\n]+/g, ' ').trim();
    const mensagemConfigurada = renderizar(template.mensagem).trim();
    const textoFinal = mensagemConfigurada || text;
    const htmlFinal = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7f7;font-family:Arial,sans-serif;color:#17383d"><main style="max-width:600px;margin:32px auto;padding:28px;background:#fff;border:1px solid #dfe8ea;border-radius:10px"><p style="color:#087579;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">QCAcesso</p><div style="white-space:pre-line">${escaparHtml(textoFinal)}</div></main></body></html>`;
    return { subject: assuntoConfigurado || subject, text: textoFinal, html: htmlFinal };
  }
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7f7;font-family:Arial,sans-serif;color:#17383d"><main style="max-width:600px;margin:32px auto;padding:28px;background:#fff;border:1px solid #dfe8ea;border-radius:10px"><p style="color:#087579;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">QCAcesso</p><h1 style="font-size:22px">${escaparHtml(chamada)}</h1><p>Funcionário: <strong>${nome}</strong><br>Empresa: ${empresa}<br>Cadastro: ${cadastro}</p><p>Ação programada: <strong>${dataProgramada}</strong><br>Período de férias: ${periodo}</p><p>Após realizar a alteração no sistema responsável, registre a execução no QCAcesso.</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#087579;color:#fff;text-decoration:none;border-radius:6px">Abrir controle de acesso</a></p></main></body></html>`;
  return { subject, text, html };
}
