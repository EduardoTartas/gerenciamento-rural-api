
import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import { pastoRepository, propriedadeRepository } from '../repository/index.js';

class PastoService {
    constructor() {
        this.repository = pastoRepository;
        this.propriedadeRepository = propriedadeRepository;
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensurePastoExists(id, usuarioId);
        }

        const { nome, propriedadeId, status, tipoPastagemId, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};

        if (nome) filters.nome = nome;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (status) filters.status = status;
        if (tipoPastagemId) filters.tipoPastagemId = tipoPastagemId;
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

        // valida se a propriedade existe e pertence ao usuário
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


        // valida nome único por propriedade
        await this.validateUniqueNome(parsedData.nome, parsedData.propriedadeId);

        await this.converterTipoPastagemLegado(parsedData);
        if (parsedData.tipoPastagemId) {
            await this.ensureTipoPastagemExists(parsedData.tipoPastagemId);
        }

        return this.repository.create(parsedData, tx);
    }

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;

        const pasto = await this.ensurePastoExists(id, usuarioId);

        // valida nome único se estiver alterando
        if (parsedData.nome) {
            await this.validateUniqueNome(parsedData.nome, pasto.propriedadeId, id);
        }

        await this.converterTipoPastagemLegado(parsedData);

        if (parsedData.tipoPastagemId && parsedData.tipoPastagemId !== pasto.tipoPastagemId) {
            await this.ensureTipoPastagemExists(parsedData.tipoPastagemId);
        }

        // validação de estado "Ativo" e "Status" usando rebanhos
        if (parsedData.ativo === false || parsedData.status === 'Vazio' || parsedData.status === 'Descanso' || parsedData.status === 'Ocupado') {
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
            } else if (parsedData.status === 'Ocupado') {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'status',
                    details: [{ path: 'status', message: 'Não é possível marcar o pasto como "Ocupado" sem nenhum rebanho ativo vinculado.' }],
                    customMessage: 'Pasto não possui rebanho vinculado para ser marcado como ocupado.',
                });
            }
        }

        // TODO(lotacao): taxa de lotação e capacidade de suporte.

        return this.repository.update(id, parsedData, tx);
    }

    async remove(id, req, tx) {
        return this.update(id, { ativo: false }, req, tx);
    }

    // MÉTODOS UTILITÁRIOS

    async validateUniqueNome(nome, propriedadeId, excludeId = null) {
        const existing = await this.repository.findByNome(nome, propriedadeId, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'nome',
                details: [{ path: 'nome', message: 'Já existe uma pastagem com este nome nesta propriedade.' }],
                customMessage: 'Já existe uma pastagem com este nome nesta propriedade.',
            });
        }
    }

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

    async converterTipoPastagemLegado(parsedData) {
        if (!('tipoPastagem' in parsedData)) return;
        const texto = parsedData.tipoPastagem?.trim();
        delete parsedData.tipoPastagem;
        if (parsedData.tipoPastagemId !== undefined) return;
        if (!texto) {
            parsedData.tipoPastagemId = null;
            return;
        }
        const tipo = await this.repository.findTipoPastagemPorNome(texto);
        parsedData.tipoPastagemId = tipo?.id ?? null;
    }

    async ensureTipoPastagemExists(tipoPastagemId) {
        const tipo = await this.repository.findTipoPastagemAtivo(tipoPastagemId);
        if (!tipo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'tipoPastagemId',
                details: [{ path: 'tipoPastagemId', message: 'Tipo de pastagem não encontrado ou inativo.' }],
                customMessage: 'Tipo de pastagem não encontrado.',
            });
        }
        return tipo;
    }
}

export default PastoService;
