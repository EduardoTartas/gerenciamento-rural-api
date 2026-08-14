// src/utils/helpers/filtroPrisma.js

/**
 * Filtro de texto parcial case-insensitive. Retorna `undefined` (Prisma ignora
 * a chave) quando o valor não foi informado — permite usar direto em
 * `where.campo = contemInsensitive(filters.campo)` sem `if` antes.
 */
export function contemInsensitive(valor) {
    return valor ? { contains: valor, mode: 'insensitive' } : undefined;
}

/**
 * Igualdade de texto case-insensitive — usado nas checagens de nome único
 * (`findByNome`).
 */
export function igualInsensitive(valor) {
    return valor ? { equals: valor, mode: 'insensitive' } : undefined;
}

/**
 * Padrão de leitura por diferença usado nos recursos com soft-delete e sync
 * offline (propriedades, pastos, rebanhos, manejos, movimentações): se
 * `atualizadoDesde` foi informado, o app está pedindo o delta — os inativos
 * (excluídos) precisam vir junto, senão o cliente nunca fica sabendo da
 * exclusão. Sem `atualizadoDesde`, filtra só os ativos por padrão, a menos
 * que `ativo` já tenha sido informado explicitamente no filtro.
 */
export function aplicarAtivoOuDiferenca(where, filters) {
    if (filters.atualizadoDesde) {
        where.updatedAt = { gt: filters.atualizadoDesde };
    }
    if (filters.ativo !== undefined) {
        where.ativo = filters.ativo;
    } else if (!filters.atualizadoDesde) {
        where.ativo = true;
    }
}
