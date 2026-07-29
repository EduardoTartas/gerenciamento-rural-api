// src/service/UserService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import { userRepository } from '../repository/index.js';
import { auth } from '../config/auth.js';
import DbConnect from '../config/dbConnect.js';

class UserService {
    constructor() {
        this.repository = userRepository;
        this.prisma = DbConnect.prisma;
    }

    /**
     * Busca um usuário por ID. Restrito ao próprio usuário autenticado —
     * não existe endpoint para listar usuários da plataforma.
     */
    async list(req) {
        const { id } = req.params;

        const user = await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'consultar os dados de outro usuário');

        return user;
    }

    /**
     * Atualiza os dados do perfil de um usuário.
     * Somente o próprio usuário pode atualizar seus dados.
     */
    async update(id, parsedData, req) {
        await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'atualizar o perfil de outro usuário');

        // Valida e-mail único caso seja alterado
        if (parsedData.email) {
            await this.validateUniqueEmail(parsedData.email, id);
        }

        return this.repository.update(id, parsedData);
    }

    /**
     * Exclui uma conta de usuário.
     * Somente o próprio usuário pode excluir sua conta.
     * Revoga todas as sessões ativas antes de excluir.
     */
    async remove(id, req) {
        await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'excluir a conta de outro usuário');

        // Revoga todas as sessões ativas do usuário antes de deletar
        const sessions = await this.prisma.session.findMany({
            where: { userId: id },
            select: { token: true },
        });
        for (const session of sessions) {
            try {
                await auth.api.revokeSession({ body: { token: session.token } });
            } catch {
                // Se a sessão já expirou ou não existe, ignora
            }
        }

        return this.repository.remove(id);
    }

    // ================================
    // MÉTODOS ÚTEIS
    // ================================

    /**
     * Valida que o e-mail não está em uso por outro usuário.
     */
    async validateUniqueEmail(email, excludeId = null) {
        const existing = await this.repository.findByEmail(email, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'email',
                details: [{ path: 'email', message: 'E-mail já está em uso.' }],
                customMessage: 'E-mail já cadastrado.',
            });
        }
    }

    /**
     * Garante que um usuário com o ID informado existe. Retorna os dados do usuário.
     */
    async ensureUserExists(id) {
        const user = await this.repository.findById(id);
        if (!user) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'User',
                details: [],
                customMessage: messages.error.resourceNotFound('User'),
            });
        }
        return user;
    }

    /**
     * Garante que o usuário logado está realizando a ação em seu próprio recurso.
     */
    ensureSelfAction(loggedUserId, targetId, actionDescription) {
        if (loggedUserId !== targetId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.FORBIDDEN.code,
                errorType: 'forbidden',
                field: 'User',
                details: [],
                customMessage: `Você não tem permissão para ${actionDescription}.`,
            });
        }
    }
}

export default UserService;
