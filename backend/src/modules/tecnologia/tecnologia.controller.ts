/**
 * Controller de Férias da Tecnologia (tecnologia.controller.ts)
 * Descrição: Recebe as requisições do calendário de férias da equipe de TI,
 * do cadastro de novos períodos e do cancelamento de períodos já agendados.
 */
import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';
import { cancelarFeriasTi, mesAtual, mesValido, montarCalendarioTi, registrarFeriasTi } from './tecnologia.service';

const PERFIS_CADASTRO = ['ADMIN', 'SUPERVISOR'];

export function tecnologiaController(auth: AuthService, config: EnvConfig, cookieName: string) {
  async function db(req: Parameters<RequestHandler>[0]) {
    return createDatabase(config, await auth.accessToken(req.cookies?.[cookieName]));
  }

  const listar: RequestHandler = (req, res, next) => { void (async () => {
    const solicitado = typeof req.query.mes === 'string' ? req.query.mes : '';
    if (solicitado && !mesValido(solicitado)) {
      throw new AuthError(400, 'MES_INVALIDO', 'Informe o mês no formato AAAA-MM.');
    }
    const usuario = res.locals.usuario as UsuarioAutenticado;
    const calendario = await montarCalendarioTi(await db(req), solicitado || mesAtual(), PERFIS_CADASTRO.includes(usuario.perfil));
    res.json({ ...calendario, podeCadastrar: PERFIS_CADASTRO.includes(usuario.perfil) });
  })().catch(next); };

  const cadastrar: RequestHandler = (req, res, next) => { void (async () => {
    const item = await registrarFeriasTi(await db(req), {
      colaboradorId: String(req.body?.colaboradorId ?? ''),
      dataInicio: String(req.body?.dataInicio ?? ''),
      dataFim: String(req.body?.dataFim ?? ''),
      supervisorId: String(req.body?.supervisorId ?? ''),
    });
    res.status(201).json({ item });
  })().catch(next); };

  const cancelar: RequestHandler = (req, res, next) => { void (async () => {
    const item = await cancelarFeriasTi(await db(req), String(req.params.id ?? ''));
    res.json({ item });
  })().catch(next); };

  return { listar, cadastrar, cancelar };
}
