
import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import { userRepository } from '../repository/index.js';
import { auth } from '../config/auth.js';
import DbConnect from '../config/dbConnect.js';
import { baseUrlPublica } from '../config/garageConnect.js';
import UploadService from './UploadService.js';
import logger from '../utils/logger.js';

class UserService {
    constructor() {
        this.repository = userRepository;
        this.prisma = DbConnect.prisma;
        this.uploadService = new UploadService();
    }

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

        return this.repository.list(filters, parseInt(page, 10), parseInt(limit, 10) || 10);
    }

    async update(id, parsedData, req) {
        const user = await this.ensureUserExists(id);
        if (!req.user.admin) {
            this.ensureSelfAction(req.user.id, id, 'atualizar o perfil de outro usuário');
        }

        // valida e-mail único caso seja alterado
        if (parsedData.email) {
            await this.validateUniqueEmail(parsedData.email, id);
        }

        const updated = await this.repository.update(id, parsedData);

        if ('image' in parsedData && parsedData.image !== user.image) {
            this.descartarFoto(user.image);
        }

        return updated;
    }

    async registrarFoto(id, url, req) {
        const user = await this.ensureUserExists(id);
        if (!req.user.admin) {
            this.ensureSelfAction(req.user.id, id, 'atualizar a foto de outro usuário');
        }
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

        if (user.image !== url) {
            this.descartarFoto(user.image);
        }

        return updated;
    }

    async remove(id, req) {
        const user = await this.ensureUserExists(id);
        if (!req.user.admin) {
            this.ensureSelfAction(req.user.id, id, 'excluir a conta de outro usuário');
        }

        // revoga todas as sessões ativas do usuário antes de deletar
        const sessions = await this.prisma.session.findMany({
            where: { userId: id },
            select: { token: true },
        });
        for (const session of sessions) {
            try {
                await auth.api.revokeSession({ body: { token: session.token } });
            } catch {
                // se a sessão já expirou ou não existe, ignora
            }
        }

        const fotosAtividade = await this.repository.urlsFotosAtividade(id);

        const removido = await this.repository.remove(id);
        this.descartarFoto(user.image);
        fotosAtividade.forEach((url) => this.descartarFoto(url));
        return removido;
    }

    async exportar(id, req) {
        await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'exportar os dados de outro usuário');

        const dados = await this.repository.exportarDados(id);
        return { exportadoEm: new Date().toISOString(), ...dados };
    }

    // MÉTODOS ÚTEIS

    descartarFoto(url) {
        if (!url || !url.startsWith(`${baseUrlPublica()}/`)) return;
        this.uploadService.deletarImagem(url).catch((err) => {
            logger.error('Falha ao remover foto antiga do bucket.', { url, error: err.message });
        });
    }

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

    ensureUrlPertenceAoBucket(url) {
        const baseUrl = baseUrlPublica();
        if (!url.startsWith(`${baseUrl}/`)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'url',
                customMessage: 'A URL informada não corresponde a uma imagem enviada pelo sistema.',
            });
        }
    }

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
