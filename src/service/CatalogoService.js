// src/service/CatalogoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import CatalogoRepository, { CATALOGO_ENTITIES } from '../repository/CatalogoRepository.js';

class CatalogoService {
    constructor() {
        this.repository = new CatalogoRepository();
    }

    /**
     * Resolve e valida a entidade de catálogo pelo segmento da URL.
     * Lança 404 se a entidade não for reconhecida.
     */
    resolveEntidade(entidade) {
        const config = CATALOGO_ENTITIES[entidade];
        if (!config) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'entidade',
                details: [],
                customMessage: `Catálogo "${entidade}" não encontrado. Entidades disponíveis: ${Object.keys(CATALOGO_ENTITIES).join(', ')}.`,
            });
        }
        return config;
    }

    /**
     * Lista itens de catálogo com paginação.
     */
    async list(req, parsedQuery = {}) {
        const { entidade } = req.params;
        const { id } = req.params;
        const config = this.resolveEntidade(entidade);

        if (id) {
            return this.ensureItemExists(config, id);
        }

        const { nome, ativo, page = 1, limit = 10 } = parsedQuery;
        const filters = {};
        if (nome) filters.nome = nome;
        if (ativo !== undefined) filters.ativo = ativo;

        return this.repository.list(
            config.model,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Cria novo item de catálogo.
     * Valida unicidade do nome (case-insensitive global).
     */
    async create(parsedData, req) {
        const { entidade } = req.params;
        const config = this.resolveEntidade(entidade);

        await this.validateUniqueNome(config, parsedData.nome);

        return this.repository.create(config.model, parsedData);
    }

    /**
     * Atualiza item de catálogo.
     */
    async update(id, parsedData, req) {
        const { entidade } = req.params;
        const config = this.resolveEntidade(entidade);

        await this.ensureItemExists(config, id);

        if (parsedData.nome) {
            await this.validateUniqueNome(config, parsedData.nome, id);
        }

        return this.repository.update(config.model, id, parsedData);
    }

    /**
     * Remove item de catálogo.
     * Impede exclusão se houver registros dependentes (rebanhos, manejos, etc).
     */
    async remove(id, req) {
        const { entidade } = req.params;
        const config = this.resolveEntidade(entidade);

        await this.ensureItemExists(config, id);

        const dependentes = await this.repository.countDependentes(
            config.relationModel,
            config.relationField,
            id,
        );

        if (dependentes > 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'validationError',
                field: config.label,
                details: [{ path: 'id', message: `Este(a) ${config.label} está vinculado(a) a ${dependentes} registro(s) e não pode ser excluído(a).` }],
                customMessage: `Não é possível excluir: ${config.label} possui registros dependentes.`,
            });
        }

        return this.repository.update(config.model, id, { ativo: false });
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    async validateUniqueNome(config, nome, excludeId = null) {
        const existing = await this.repository.findByNome(config.model, nome, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'validationError',
                field: 'nome',
                details: [{ path: 'nome', message: `Já existe um(a) ${config.label} com este nome.` }],
                customMessage: `Já existe um(a) ${config.label} com este nome.`,
            });
        }
    }

    async ensureItemExists(config, id) {
        const item = await this.repository.findById(config.model, id);
        if (!item) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: config.label,
                details: [],
                customMessage: messages.error.resourceNotFound(config.label),
            });
        }
        return item;
    }
}

export default CatalogoService;
