
import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import { propriedadeRepository } from '../repository/index.js';

class PropriedadeService {
    constructor() {
        this.repository = propriedadeRepository;
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensurePropriedadeExists(id, usuarioId);
        }

        const { nome, localizacao, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};

        if (nome) filters.nome = nome;
        if (localizacao) filters.localizacao = localizacao;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            parseInt(limit, 10) || 10,
        );
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;

        // validate unique name per user
        await this.validateUniqueNome(parsedData.nome, usuarioId);

        return this.repository.create({
            ...parsedData,
            usuarioId,
        }, tx);
    }

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;

        await this.ensurePropriedadeExists(id, usuarioId);

        // validate unique name if changing it
        if (parsedData.nome) {
            await this.validateUniqueNome(parsedData.nome, usuarioId, id);
        }

        // validate deactivation against active herds
        if (parsedData.ativo === false) {
            const rebanhosAtivos = await this.repository.countRebanhosAtivos(id);
            if (rebanhosAtivos > 0) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'ativo',
                    details: [{ path: 'ativo', message: 'Não é possível inativar uma propriedade que contém rebanhos ativos.' }],
                    customMessage: 'A propriedade ainda possui rebanhos vinculados a ela.',
                });
            }
        }

        return this.repository.update(id, parsedData, tx);
    }

    async remove(id, req, tx) {
        return this.update(id, { ativo: false }, req, tx);
    }

    // MÉTODOS UTILITÁRIOS

    async validateUniqueNome(nome, usuarioId, excludeId = null) {
        const existing = await this.repository.findByNome(nome, usuarioId, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'nome',
                details: [{ path: 'nome', message: 'Já existe uma propriedade com este nome.' }],
                customMessage: 'Já existe uma propriedade com este nome para este usuário.',
            });
        }
    }

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
