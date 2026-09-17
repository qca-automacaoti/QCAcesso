import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import type { Database } from '../../config/database.types';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;

export interface UploadErroLinha {
  linha: number;
  motivo: string;
}

export interface UploadResultado {
  upload: {
    id: string;
    nomeArquivo: string;
    totalLinhas: number;
    linhasProcessadas: number;
    linhasComErro: number;
    status: 'CONCLUIDO' | 'ERRO';
  };
  erros: UploadErroLinha[];
}

export interface UploadResumo {
  id: string;
  nomeArquivo: string;
  dataUpload: string;
  totalLinhas: number;
  linhasProcessadas: number;
  linhasComErro: number;
  status: string;
}

interface UploadedFile {
  filename: string;
  buffer: Buffer;
}

interface LinhaImportada {
  linha: number;
  empresa: string;
  cadastro: string;
  nome: string;
  email: string | null;
  dataInicio: string;
  dataFim: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

function normalizarTexto(value: unknown) {
  return String(value ?? '').trim();
}

function normalizarCabecalho(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function coluna(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizarCabecalho));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizarCabecalho(key))) return value;
  }
  return '';
}

function excelSerialToIsoDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return '';
  return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
}

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) return excelSerialToIsoDate(value);
  const text = normalizarTexto(value);
  if (!text) return '';
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validarLinha(row: Record<string, unknown>, index: number): { linha?: LinhaImportada; erro?: UploadErroLinha } {
  const linhaNumero = index + 2;
  const empresa = normalizarTexto(coluna(row, ['empresa', 'filial', 'unidade']));
  const cadastro = normalizarTexto(coluna(row, ['cadastro', 'matricula', 'matrícula']));
  const nome = normalizarTexto(coluna(row, ['nome', 'funcionario', 'funcionário', 'colaborador']));
  const email = normalizarTexto(coluna(row, ['email', 'e-mail']));
  const dataInicio = parseDate(coluna(row, ['data_inicio', 'data inicio', 'inicio', 'início', 'inicio ferias', 'início férias']));
  const dataFim = parseDate(coluna(row, ['data_fim', 'data fim', 'fim', 'fimFerias', 'fim ferias', 'fim férias']));

  if (!empresa || !cadastro || !nome || !dataInicio || !dataFim) {
    return { erro: { linha: linhaNumero, motivo: 'Campos obrigatórios ausentes: empresa, cadastro, nome, início e fim.' } };
  }
  if (!isValidIsoDate(dataInicio) || !isValidIsoDate(dataFim)) {
    return { erro: { linha: linhaNumero, motivo: 'Data de início ou fim inválida.' } };
  }
  if (dataFim < dataInicio) {
    return { erro: { linha: linhaNumero, motivo: 'Data final anterior à data inicial.' } };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: { linha: linhaNumero, motivo: 'E-mail inválido.' } };
  }
  return { linha: { linha: linhaNumero, empresa, cadastro, nome, email: email || null, dataInicio, dataFim } };
}

export function parseMultipartFile(contentType: string | undefined, body: Buffer): UploadedFile {
  if (!contentType?.includes('multipart/form-data')) {
    throw new AuthError(415, 'FORMATO_INVALIDO', 'Envie a planilha como multipart/form-data.');
  }
  if (body.length > MAX_FILE_BYTES) {
    throw new AuthError(413, 'ARQUIVO_GRANDE', 'Envie um arquivo de até 5 MB.');
  }
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) throw new AuthError(400, 'UPLOAD_INVALIDO', 'Não foi possível identificar o arquivo enviado.');

  const marker = Buffer.from(`--${boundary}`);
  let position = body.indexOf(marker);
  while (position !== -1) {
    const next = body.indexOf(marker, position + marker.length);
    if (next === -1) break;
    const part = body.subarray(position + marker.length + 2, next - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const filename = /filename="([^"]+)"/i.exec(headers)?.[1];
      if (filename) return { filename, buffer: part.subarray(headerEnd + 4) };
    }
    position = next;
  }
  throw new AuthError(400, 'ARQUIVO_AUSENTE', 'Selecione uma planilha para importação.');
}

function parseSpreadsheet(file: UploadedFile) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.filename)) {
    throw new AuthError(400, 'EXTENSAO_INVALIDA', 'Envie um arquivo .xlsx, .xls ou .csv.');
  }
  const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new AuthError(400, 'PLANILHA_VAZIA', 'A planilha não possui abas para importação.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: '', raw: true });
  if (rows.length === 0) throw new AuthError(400, 'PLANILHA_VAZIA', 'A planilha não possui linhas de dados.');
  if (rows.length > MAX_ROWS) throw new AuthError(400, 'MUITAS_LINHAS', `Envie no máximo ${MAX_ROWS} linhas por importação.`);
  return rows;
}

function erroBanco(): never {
  throw new AuthError(503, 'IMPORTACAO_INDISPONIVEL', 'Não foi possível processar a importação. Tente novamente.');
}

export async function importarPlanilha(db: Db, usuario: UsuarioAutenticado, file: UploadedFile): Promise<UploadResultado> {
  const rows = parseSpreadsheet(file);
  const erros: UploadErroLinha[] = [];
  const linhas: LinhaImportada[] = [];

  rows.forEach((row, index) => {
    const result = validarLinha(row, index);
    if (result.erro) erros.push(result.erro);
    if (result.linha) linhas.push(result.linha);
  });

  const status = linhas.length > 0 && erros.length === 0 ? 'CONCLUIDO' : 'ERRO';
  const { data: uploadData, error: uploadError } = await (db.from('upload_planilhas') as any)
    .insert({
      nome_arquivo: file.filename.slice(0, 180),
      usuario_id: usuario.id,
      total_linhas: rows.length,
      linhas_processadas: linhas.length,
      linhas_com_erro: erros.length,
      status,
    })
    .select('id,nome_arquivo,total_linhas,linhas_processadas,linhas_com_erro,status')
    .single();
  const upload = uploadData as Database['public']['Tables']['upload_planilhas']['Row'] | null;
  if (uploadError || !upload) erroBanco();

  if (linhas.length > 0) {
    const funcionariosPayload = linhas.map((linha) => ({
      empresa: linha.empresa,
      cadastro: linha.cadastro,
      nome: linha.nome,
      email: linha.email,
    }));
    const { data: funcionariosData, error: funcionariosError } = await (db.from('funcionarios') as any)
      .upsert(funcionariosPayload, { onConflict: 'empresa,cadastro' })
      .select('id,empresa,cadastro');
    const funcionarios = funcionariosData as Pick<Database['public']['Tables']['funcionarios']['Row'], 'id' | 'empresa' | 'cadastro'>[] | null;
    if (funcionariosError || !funcionarios) erroBanco();

    const funcionariosPorChave = new Map(funcionarios.map((funcionario) => [`${funcionario.empresa}::${funcionario.cadastro}`, funcionario.id]));
    const checklistPayload = linhas.map((linha) => ({
      upload_id: upload.id,
      funcionario_id: funcionariosPorChave.get(`${linha.empresa}::${linha.cadastro}`) ?? null,
      empresa: linha.empresa,
      cadastro: linha.cadastro,
      nome: linha.nome,
      data_inicio: linha.dataInicio,
      data_fim: linha.dataFim,
      status_revisao: 'PENDENTE' as const,
    }));
    const { error: checklistError } = await (db.from('checklist_revisao') as any).insert(checklistPayload);
    if (checklistError) erroBanco();
  }

  await (db.from('logs_atividade') as any).insert({
    usuario_id: usuario.id,
    tipo_evento: 'UPLOAD',
    entidade_afetada: 'upload_planilhas',
    entidade_id: upload.id,
    descricao: `Importação de ${file.filename}: ${linhas.length} linha(s) processada(s), ${erros.length} erro(s).`,
  });

  return {
    upload: {
      id: upload.id,
      nomeArquivo: upload.nome_arquivo,
      totalLinhas: upload.total_linhas,
      linhasProcessadas: upload.linhas_processadas,
      linhasComErro: upload.linhas_com_erro,
      status,
    },
    erros,
  };
}

export async function listarUploads(db: Db): Promise<UploadResumo[]> {
  const { data, error } = await (db.from('upload_planilhas') as any)
    .select('id,nome_arquivo,data_upload,total_linhas,linhas_processadas,linhas_com_erro,status')
    .order('data_upload', { ascending: false })
    .limit(12);
  if (error) erroBanco();
  return ((data ?? []) as Database['public']['Tables']['upload_planilhas']['Row'][]).map((upload) => ({
    id: upload.id,
    nomeArquivo: upload.nome_arquivo,
    dataUpload: upload.data_upload,
    totalLinhas: upload.total_linhas,
    linhasProcessadas: upload.linhas_processadas,
    linhasComErro: upload.linhas_com_erro,
    status: upload.status,
  }));
}
