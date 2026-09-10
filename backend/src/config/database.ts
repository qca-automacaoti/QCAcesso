/**
 * Configuração de Conexão com o Banco de Dados (database.ts)
 * Descrição: Inicializa e exporta a instância singleton do Prisma Client
 * para realização de operações de leitura e escrita no banco de dados.
 */

import { PrismaClient } from '@prisma/client';
import env from './env';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;