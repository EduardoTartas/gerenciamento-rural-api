// src/service/UserService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import { userRepository } from '../repository/index.js';
import { auth } from '../config/auth.js';
import DbConnect from '../config/dbConnect.js';
import UploadService from './UploadService.js';
import logger from '../utils/logger.js';

class UserService {
    constructor() {
        this.repository = userRepository;
        this.prisma = DbConnect.prisma;
        this.uploadService = new UploadService();
    }

    /**
     * GET /usuarios/:id — admin pode consultar qualquer usuário; usuário comum,
     * só a si mesmo. GET /usuarios (sem id, listagem geral) é restrito a admin
     * pela rota (AdminMiddleware); aqui listamos com os filtros informados.
     */
    async list(req) {
        const { id } = req.params;

        if (id) {
            const user = await this.ensureUserExists(id);
            if (!req.user.admin) {
                this.ensureSelfAction(req.user.id, id, 'consultar os dados de outro usuário');
            }
            return user;
        }

        const { name, email, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
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
     * Registra no perfil a URL de uma imagem já enviada via /uploads/imagens.
     * Se o cadastro falhar, desfaz o upload (deleta a imagem órfã do bucket).
     * Se o cadastro der certo e havia um avatar anterior, descarta o antigo.
     */
    async registrarFoto(id, url, req) {
        const user = await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'atualizar a foto de outro usuário');
        this.ensureUrlPertenceAoBucket(url);

        let updated;
        try {
            updated = await this.repository.update(id, { image: url });
        } catch (error) {
            await this.uploadService.deletarImagem(url).catch((err) => {
                logger.error('Falha ao desfazer upload após erro de cadastro.', { url, error: err.message });
            });
            throw error;
        }

        if (user.image && user.image !== url) {
            this.uploadService.deletarImagem(user.image).catch((err) => {
                logger.error('Falha ao remover avatar antigo.', { url: user.image, error: err.message });
            });
        }

        return updated;
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
     * Garante que a URL informada é de um arquivo hospedado no bucket configurado,
     * e não uma URL externa arbitrária enviada pelo cliente.
     */
    ensureUrlPertenceAoBucket(url) {
        const baseUrl = process.env.GARAGE_PUBLIC_URL?.replace(/\/$/, '');
        if (!baseUrl || !url.startsWith(`${baseUrl}/`)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'url',
                customMessage: 'A URL informada não corresponde a uma imagem enviada pelo sistema.',
            });
        }
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
