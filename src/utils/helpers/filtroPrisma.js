
export function contemInsensitive(valor) {
    return valor ? { contains: valor, mode: 'insensitive' } : undefined;
}

export function igualInsensitive(valor) {
    return valor ? { equals: valor, mode: 'insensitive' } : undefined;
}

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

export function intervaloData(inicio, fim) {
    if (!inicio && !fim) return undefined;
    const intervalo = {};
    if (inicio) intervalo.gte = inicio;
    if (fim) intervalo.lte = fim;
    return intervalo;
}
