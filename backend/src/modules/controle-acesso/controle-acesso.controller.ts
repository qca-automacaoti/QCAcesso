import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { StatusControle, TipoAcao } from '../../config/database.types';
import type { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';
import { confirmarControleAcesso, listarControleAcesso } from './controle-acesso.service';

const statusPermitidos: StatusControle[] = ['PENDENTE', 'ATRASADO', 'CONFIRMADO', 'CANCELADO'];
const tiposPermitidos: TipoAcao[] = ['BLOQUEIO', 'DESBLOQUEIO'];

export function controleAcessoController(auth: AuthService, config: EnvConfig, cookieName: string) {
  async function db(req: Parameters<RequestHandler>[0]) {
    const accessToken = await auth.accessToken(req.cookies?.[cookieName]);
    return createDatabase(config, accessToken);
  }

  const listar: RequestHandler = (req, res, next) => {
    void (async () => {
      const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
      const tipo = typeof req.query.tipo === 'string' ? req.query.tipo.toUpperCase() : undefined;
      if (status && !statusPermitidos.includes(status as StatusControle)) {
        throw new AuthError(400, 'STATUS_INVALIDO', 'Status de controle inválido.');
      }
      if (tipo && !tiposPermitidos.includes(tipo as TipoAcao)) {
        throw new AuthError(400, 'TIPO_INVALIDO', 'Tipo de ação inválido.');
      }
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) {
        throw new AuthError(400, 'PAGINACAO_INVALIDA', 'Número de página inválido.');
      }
      const usuario = res.locals.usuario as UsuarioAutenticado;
      res.json(await listarControleAcesso(await db(req), usuario, {
        status: status as StatusControle | undefined,
        tipo: tipo as TipoAcao | undefined,
        offset,
      }));
    })().catch(next);
  };

  const confirmar: RequestHandler = (req, res, next) => {
    void (async () => {
      const id = String(req.params.id ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new AuthError(400, 'ID_INVALIDO', 'Identificador de ação inválido.');
      }
      const controle = await confirmarControleAcesso(await db(req), id);
      res.json({ item: controle });
    })().catch(next);
  };

  return { listar, confirmar };
}
