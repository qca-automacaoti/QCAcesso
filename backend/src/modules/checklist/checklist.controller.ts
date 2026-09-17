import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { StatusRevisao } from '../../config/database.types';
import type { AuthService } from '../auth/auth.service';
import { AuthError } from '../auth/auth.types';
import { confirmarChecklist, editarChecklist, listarChecklist, rejeitarChecklist } from './checklist.service';

const statusPermitidos: StatusRevisao[] = ['PENDENTE', 'EDITADO', 'CONFIRMADO', 'REJEITADO'];

export function checklistController(auth: AuthService, config: EnvConfig, cookieName: string) {
  async function db(req: Parameters<RequestHandler>[0]) {
    const accessToken = await auth.accessToken(req.cookies?.[cookieName]);
    return createDatabase(config, accessToken);
  }

  const listar: RequestHandler = (req, res, next) => {
    void (async () => {
      const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
      if (status && !statusPermitidos.includes(status as StatusRevisao)) {
        throw new AuthError(400, 'STATUS_INVALIDO', 'Status de checklist inválido.');
      }
      const offsetValue = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      if (!Number.isSafeInteger(offsetValue) || offsetValue < 0 || offsetValue > 100_000) {
        throw new AuthError(400, 'PAGINACAO_INVALIDA', 'Número de página inválido.');
      }
      res.json(await listarChecklist(await db(req), status as StatusRevisao | undefined, offsetValue));
    })().catch(next);
  };

  const editar: RequestHandler = (req, res, next) => {
    void (async () => {
      const id = String(req.params.id ?? '');
      res.json({ item: await editarChecklist(await db(req), id, req.body) });
    })().catch(next);
  };

  const rejeitar: RequestHandler = (req, res, next) => {
    void (async () => {
      const id = String(req.params.id ?? '');
      res.json({ item: await rejeitarChecklist(await db(req), id) });
    })().catch(next);
  };

  const confirmar: RequestHandler = (req, res, next) => {
    void (async () => {
      const id = String(req.params.id ?? '');
      res.json({ item: await confirmarChecklist(await db(req), id) });
    })().catch(next);
  };

  return { listar, editar, rejeitar, confirmar };
}
