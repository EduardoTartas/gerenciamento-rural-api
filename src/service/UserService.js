// src/service/UserService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import UserRepository from '../repository/UserRepository.js';

class UserService {
    constructor() {
        this.repository = new UserRepository();
    }

    /**
     * Lista usuários com paginação e filtros.
     */
    async list(req) {
        const { id } = req.params;

        if (id) {
            return this.repository.findById(id);
        }

        const { name, email, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (name) filters.name = name;
        if (email) filters.email = email;

        return this.repository.list(filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100));
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
     */
    async remove(id, req) {
        await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'excluir a conta de outro usuário');

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
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
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
