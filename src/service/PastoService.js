// src/service/PastoService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import PastoRepository from '../repository/PastoRepository.js';
import PropriedadeRepository from '../repository/PropriedadeRepository.js';

class PastoService {
    constructor() {
        this.repository = new PastoRepository();
        this.propriedadeRepository = new PropriedadeRepository();
    }

    /**
     * Lista pastos com paginação e filtragem.
     * Sempre restrito ao usuário autenticado (via propriedade).
     */
    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.repository.findById(id, usuarioId);
        }

        const { nome, propriedadeId, status, tipoPastagem, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (nome) filters.nome = nome;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (status) filters.status = status;
        if (tipoPastagem) filters.tipoPastagem = tipoPastagem;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Cria um novo pasto para uma propriedade do usuário autenticado.
     */
    async create(parsedData, req) {
        const usuarioId = req.user.id;

        // Valida se a propriedade existe e pertence ao usuário
        const propriedade = await this.ensurePropriedadeExists(parsedData.propriedadeId, usuarioId);

        if (!propriedade.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'propriedadeId',
                details: [{ path: 'propriedadeId', message: 'Não é possível criar um pasto em uma propriedade inativa.' }],
                customMessage: 'Propriedade está inativa.',
            });
        }


        // Valida nome único por propriedade
        await this.validateUniqueNome(parsedData.nome, parsedData.propriedadeId);

        return this.repository.create(parsedData);
    }

    /**
     * Atualiza um pasto existente.
     * Apenas o dono da propriedade pode atualizar.
     */
    async update(id, parsedData, req) {
        const usuarioId = req.user.id;

        const pasto = await this.ensurePastoExists(id, usuarioId);

        // Valida nome único se estiver alterando
        if (parsedData.nome) {
            await this.validateUniqueNome(parsedData.nome, pasto.propriedadeId, id);
        }

        // Validação de estado "Ativo" e "Status" usando rebanhos
        if (parsedData.ativo === false || parsedData.status === 'Vazio' || parsedData.status === 'Descanso') {
            const rebanhosAtivos = await this.repository.countRebanhos(id);
            if (rebanhosAtivos > 0) {
                if (parsedData.ativo === false) {
                    throw new CustomError({
                        statusCode: HttpStatusCodes.BAD_REQUEST.code,
                        errorType: 'validationError',
                        field: 'ativo',
                        details: [{ path: 'ativo', message: 'Não é possível inativar um pasto que contém rebanhos.' }],
                        customMessage: 'Pasto ainda contém rebanhos vinculados.',
                    });
                }
                if (parsedData.status === 'Vazio' || parsedData.status === 'Descanso') {
                    throw new CustomError({
                        statusCode: HttpStatusCodes.BAD_REQUEST.code,
                        errorType: 'validationError',
                        field: 'status',
                        details: [{ path: 'status', message: `Não é possível alterar o status para "${parsedData.status}" pois há rebanhos no pasto.` }],
                        customMessage: 'Pasto está ocupado por um ou mais rebanhos.',
                    });
                }
            }
        }

        // TODO: Implementar lógica de cálculo de Taxa de Lotação (cabeças/ha) e capacidade de suporte em endpoints futuros (Dashboards).

        return this.repository.update(id, parsedData);
    }

    /**
     * Exclui um pasto.
     * Apenas o dono da propriedade pode excluir.
     * A exclusão em cascata remove manejos de pasto relacionados.
     * Rebanhos vinculados têm o pastoAtualId definido como null (SetNull).
     */
    async remove(id, req) {
        const usuarioId = req.user.id;

        await this.ensurePastoExists(id, usuarioId);

        return this.repository.remove(id);
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    /**
     * Valida se o nome já está em uso na mesma propriedade.
     */
    async validateUniqueNome(nome, propriedadeId, excludeId = null) {
        const existing = await this.repository.findByNome(nome, propriedadeId, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'validationError',
                field: 'nome',
                details: [{ path: 'nome', message: 'Já existe uma pastagem com este nome nesta propriedade.' }],
                customMessage: 'Já existe uma pastagem com este nome nesta propriedade.',
            });
        }
    }

    /**
     * Garante que um pasto com o ID fornecido existe e pertence ao usuário.
     */
    async ensurePastoExists(id, usuarioId) {
        const pasto = await this.repository.findById(id, usuarioId);
        if (!pasto) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Pastagem',
                details: [],
                customMessage: messages.error.resourceNotFound('Pastagem'),
            });
        }
        return pasto;
    }

    /**
     * Garante que a propriedade existe e pertence ao usuário autenticado.
     */
    async ensurePropriedadeExists(propriedadeId, usuarioId) {
        const propriedade = await this.propriedadeRepository.findById(propriedadeId, usuarioId);
        if (!propriedade) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Propriedade',
                details: [],
                customMessage: 'Propriedade não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return propriedade;
    }
}

export default PastoService;
