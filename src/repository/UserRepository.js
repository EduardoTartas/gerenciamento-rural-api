// src/repository/UserRepository.js

import DbConnect from '../config/dbConnect.js';
import { contemInsensitive } from '../utils/helpers/index.js';

const USER_SELECT = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    createdAt: true,
    updatedAt: true,
};

class UserRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista usuários com paginação e filtros opcionais.
     */
    async list(filters = {}, page = 1, limit = 10) {
        const where = {};

        if (filters.name) where.name = contemInsensitive(filters.name);
        if (filters.email) where.email = contemInsensitive(filters.email);

        const [docs, totalDocs] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' },
                select: USER_SELECT,
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            docs,
            totalDocs,
            page,
            limit,
            totalPages: Math.ceil(totalDocs / limit),
        };
    }

    /**
     * Busca um usuário pelo ID. Retorna null se não encontrado.
     */
    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
            select: USER_SELECT,
        });
    }

    /**
     * Busca um usuário por e-mail, opcionalmente excluindo um ID.
     */
    async findByEmail(email, excludeId = null) {
        const where = { email };
        if (excludeId) {
            where.id = { not: excludeId };
        }
        return this.prisma.user.findFirst({ where });
    }

    /**
     * Atualiza um usuário pelo ID. Lança erro se não encontrado.
     */
    async update(id, data) {
        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: USER_SELECT,
        });

        return user;
    }

    /**
     * Deleta um usuário pelo ID. Lança erro se não encontrado.
     *
     * As mutações do sync não têm relação com o usuário (ver `mutacaoAplicada`
     * no schema) e guardam o resultado das gravações dele, então saem junto na
     * mesma transação — senão sobrariam dados da conta já excluída.
     */
    async remove(id) {
        const [, user] = await this.prisma.$transaction([
            this.prisma.mutacaoAplicada.deleteMany({ where: { usuarioId: id } }),
            this.prisma.user.delete({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            }),
        ]);

        return user;
    }

    /**
     * URLs das fotos de atividade do usuário (ativas ou não). Lidas antes da
     * exclusão da conta: a cascata apaga as linhas, e sem as URLs os arquivos
     * ficariam órfãos no bucket.
     */
    async urlsFotosAtividade(id) {
        const fotos = await this.prisma.fotoAtividade.findMany({
            where: {
                OR: [
                    { manejoPasto: { pasto: { propriedade: { usuarioId: id } } } },
                    { manejoRebanho: { rebanho: { propriedade: { usuarioId: id } } } },
                ],
            },
            select: { url: true },
        });
        return fotos.map((foto) => foto.url);
    }

    /**
     * Tudo o que a conta guarda, para a exportação a pedido do titular (LGPD,
     * art. 18). Inclui o que está com exclusão lógica (`ativo: false`), porque
     * continua armazenado. Fica de fora o que é segredo da autenticação: senha,
     * tokens e sessões.
     */
    async exportarDados(id) {
        const [titular, propriedades, notificacoes] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id },
                select: {
                    ...USER_SELECT,
                    accounts: { select: { providerId: true, createdAt: true } },
                },
            }),
            this.prisma.propriedade.findMany({
                where: { usuarioId: id },
                orderBy: { createdAt: 'asc' },
                include: {
                    pastos: { include: { manejosPasto: { include: { fotos: true } } } },
                    rebanhos: {
                        include: {
                            movimentacoes: true,
                            saidas: true,
                            manejos: { include: { fotos: true } },
                            regimesConsumo: true,
                        },
                    },
                    insumos: { include: { movimentacoes: true } },
                },
            }),
            this.prisma.notificacao.findMany({
                where: { usuarioId: id },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        return { titular, propriedades, notificacoes };
    }
}

export default UserRepository;
