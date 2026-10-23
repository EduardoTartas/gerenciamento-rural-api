
export function comTransacao(prisma, executor, callback) {
    if (executor) return callback(executor);
    return prisma.$transaction(callback);
}

export function ondeEscrever(executor, prisma) {
    return executor ?? prisma;
}
