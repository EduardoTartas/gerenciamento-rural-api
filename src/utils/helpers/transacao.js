// src/utils/helpers/transacao.js

/**
 * Executa `callback` dentro de uma transação — reaproveitando a que já estiver
 * aberta, em vez de abrir outra.
 *
 * O endpoint de lote (`POST /v1/sync`) abre uma transação por mutação e precisa
 * que a escrita de domínio e a lápide de idempotência entrem juntas (issue #34).
 * Os mesmos services também são chamados pelo REST, onde não há transação de
 * fora — daí `executor` ser opcional.
 *
 * Sem isto, quem já abria `$transaction` por conta própria (RebanhoService,
 * MovimentacaoRepository, ManejoRebanhoRepository) acabava com transação
 * interativa dentro de transação interativa quando chamado pelo lote. O Prisma
 * não compõe as duas: a de dentro pega **outra** conexão do pool, o que quebra a
 * atomicidade prometida e é a origem provável do `DeprecationWarning` do `pg`
 * (issue #35).
 *
 * @param {import('@prisma/client').PrismaClient} prisma Cliente para abrir a transação quando não houver uma.
 * @param {object|undefined} executor Transação recebida de fora, se houver.
 * @param {(tx: object) => Promise<any>} callback Recebe a transação em vigor.
 */
export function comTransacao(prisma, executor, callback) {
    if (executor) return callback(executor);
    return prisma.$transaction(callback);
}

/**
 * O executor a usar para uma escrita simples: a transação recebida, ou o
 * cliente do pool quando a chamada vem do REST.
 *
 * @param {object|undefined} executor Transação recebida de fora, se houver.
 * @param {import('@prisma/client').PrismaClient} prisma Cliente padrão.
 */
export function ondeEscrever(executor, prisma) {
    return executor ?? prisma;
}
