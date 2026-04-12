// src/service/PropriedadeService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import PropriedadeRepository from '../repository/PropriedadeRepository.js';

class PropriedadeService {
    constructor() {
        this.repository = new PropriedadeRepository();
    }

    /**
     * Lista propriedades com paginação e filtragem.
     * Sempre restrito ao usuário autenticado.
     */
    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.repository.findById(id, usuarioId);
        }

        const { nome, localizacao, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (nome) filters.nome = nome;
        if (localizacao) filters.localizacao = localizacao;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Cria uma nova propriedade para o usuário autenticado.
     */
    async create(parsedData, req) {
        const usuarioId = req.user.id;

        // Validate unique name per user
        await this.validateUniqueNome(parsedData.nome, usuarioId);

        return this.repository.create({
            ...parsedData,
            usuarioId,
        });
    }

    /**
     * Atualiza uma propriedade existente.
     * Apenas o dono pode atualizar sua propriedade.
     */
    async update(id, parsedData, req) {
        const usuarioId = req.user.id;

        await this.ensurePropriedadeExists(id, usuarioId);

        // Validate unique name if changing it
        if (parsedData.nome) {
            await this.validateUniqueNome(parsedData.nome, usuarioId, id);
        }

        return this.repository.update(id, parsedData);
    }

    /**
     * Exclui uma propriedade.
     * Apenas o dono pode excluir sua propriedade.
     * A exclusão em cascata remove todos os pastos, rebanhos, etc. relacionados.
     */
    async remove(id, req) {
        const usuarioId = req.user.id;

        await this.ensurePropriedadeExists(id, usuarioId);

        return this.repository.remove(id);
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    /**
     * Valida se o nome já está em uso pelo mesmo usuário.
     */
    async validateUniqueNome(nome, usuarioId, excludeId = null) {
        const existing = await this.repository.findByNome(nome, usuarioId, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'validationError',
                field: 'nome',
                details: [{ path: 'nome', message: 'Já existe uma propriedade com este nome.' }],
                customMessage: 'Já existe uma propriedade com este nome para este usuário.',
            });
        }
    }

    /**
     * Garante que uma propriedade com o ID fornecido existe e pertence ao usuário.
     */
    async ensurePropriedadeExists(id, usuarioId) {
        const propriedade = await this.repository.findById(id, usuarioId);
        if (!propriedade) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Propriedade',
                details: [],
                customMessage: messages.error.resourceNotFound('Propriedade'),
            });
        }
        return propriedade;
    }
}

export default PropriedadeService;
