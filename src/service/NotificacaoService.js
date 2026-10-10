// src/service/NotificacaoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { notificacaoRepository } from '../repository/index.js';
import npaas, { npaasAtivo } from '../utils/npaas.js';

/**
 * Caixa de notificações do produtor e registro do aparelho para o push (issue
 * #62). As notificações nascem na verificação periódica
 * (`VerificacaoNotificacoesService`); aqui o app lê, marca como lida e
 * registra o token FCM do aparelho no NPaaS.
 */
class NotificacaoService {
    constructor() {
        this.repository = notificacaoRepository;
    }

    async list(req) {
        const usuarioId = req.user.id;
        const { id } = req.params;
        if (id) return this.ensureExists(id, usuarioId);

        const { lida, propriedadeId, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};
        if (lida !== undefined) filters.lida = lida;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(usuarioId, filters, parseInt(page, 10), parseInt(limit, 10) || 10);
    }

    /** Marca uma notificação como lida (ou não lida). Usado pelo PATCH e pelo `/sync`. */
    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        return this.repository.marcarLida(id, parsedData.lida, tx);
    }

    async marcarTodasLidas(parsedData, req) {
        const marcadas = await this.repository.marcarTodasLidas(req.user.id, parsedData.propriedadeId);
        return { marcadas };
    }

    async registrarDispositivo(parsedData, req) {
        const registrado = await npaas.registrarDispositivo(req.user.id, parsedData);
        return { registrado, pushAtivo: npaasAtivo() };
    }

    async desativarDispositivo(parsedData) {
        const desativado = await npaas.desativarToken(parsedData.tokenFcm);
        return { desativado };
    }

    async ensureExists(id, usuarioId) {
        const notificacao = await this.repository.findById(id, usuarioId);
        if (!notificacao) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Notificação',
                details: [],
                customMessage: messages.error.resourceNotFound('Notificação'),
            });
        }
        return notificacao;
    }
}

export default NotificacaoService;
