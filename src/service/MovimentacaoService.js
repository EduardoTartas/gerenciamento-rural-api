
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { movimentacaoRepository, rebanhoRepository, pastoRepository } from '../repository/index.js';

class MovimentacaoService {
    constructor() {
        this.repository = movimentacaoRepository;
        this.rebanhoRepository = rebanhoRepository;
        this.pastoRepository = pastoRepository;
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureMovimentacaoExists(id, usuarioId);
        }

        const { rebanhoId, propriedadeId, pastoOrigemId, pastoDestinoId, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};

        if (rebanhoId)     filters.rebanhoId     = rebanhoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (pastoOrigemId)  filters.pastoOrigemId  = pastoOrigemId;
        if (pastoDestinoId) filters.pastoDestinoId = pastoDestinoId;
        if (dataInicio)    filters.dataInicio    = dataInicio;
        if (dataFim)       filters.dataFim       = dataFim;
        if (ativo !== undefined) filters.ativo   = ativo;
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

        // valida o rebanho
        const rebanho = await this.ensureRebanhoExists(parsedData.rebanhoId, usuarioId);

        if (!rebanho.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'rebanhoId',
                details: [{ path: 'rebanhoId', message: 'Não é possível movimentar um rebanho inativo.' }],
                customMessage: 'Rebanho está inativo.',
            });
        }

        // valida o pasto de destino
        const pastoDestino = await this.ensurePastoExists(parsedData.pastoDestinoId, usuarioId);

        if (!pastoDestino.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoDestinoId',
                details: [{ path: 'pastoDestinoId', message: 'Não é possível mover um rebanho para um pasto inativo.' }],
                customMessage: 'Pasto de destino está inativo.',
            });
        }

        // valida que destino ≠ origem
        if (rebanho.pastoAtualId && rebanho.pastoAtualId === parsedData.pastoDestinoId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoDestinoId',
                details: [{ path: 'pastoDestinoId', message: 'O pasto de destino é o mesmo que o pasto atual do rebanho.' }],
                customMessage: 'O rebanho já está neste pasto.',
            });
        }

        if (rebanho.propriedadeId !== pastoDestino.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoDestinoId',
                details: [{ path: 'pastoDestinoId', message: 'O pasto de destino não pertence à mesma propriedade do rebanho.' }],
                customMessage: 'Pasto de destino não pertence à propriedade do rebanho.',
            });
        }

        if (!parsedData.permitirLotacaoConjunta) {
            const ocupantes = await this.rebanhoRepository.countAtivosNoPasto(
                parsedData.pastoDestinoId,
                { excluirRebanhoId: parsedData.rebanhoId },
            );
            if (ocupantes > 0) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'pastoDestinoId',
                    details: [{
                        path: 'pastoDestinoId',
                        message: 'O pasto de destino já tem outro lote. Envie permitirLotacaoConjunta para juntar os lotes.',
                    }],
                    customMessage: 'O pasto de destino já está ocupado por outro lote.',
                });
            }
        }

        const pastoOrigemId = rebanho.pastoAtualId ?? null;
        const dataMovimentacao = parsedData.dataMovimentacao ?? new Date();

        return this.repository.createComTransacao({
            id: parsedData.id,
            rebanhoId: parsedData.rebanhoId,
            pastoOrigemId,
            pastoDestinoId: parsedData.pastoDestinoId,
            dataMovimentacao,
            observacoes: parsedData.observacoes ?? null,
        }, tx);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        const movimentacao = await this.ensureMovimentacaoExists(id, usuarioId);

        const ultima = await this.repository.ultimaDoRebanho(movimentacao.rebanhoId);
        if (!ultima || ultima.id !== movimentacao.id) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'id',
                details: [{
                    path: 'id',
                    message: `Só a última movimentação pode ser desfeita. A última é ${ultima?.id ?? 'inexistente'}.`,
                }],
                customMessage: 'Só a última movimentação do lote pode ser desfeita.',
            });
        }

        return this.repository.desfazerComTransacao(movimentacao, tx);
    }

    // MÉTODOS UTILITÁRIOS

    async ensureMovimentacaoExists(id, usuarioId) {
        const mov = await this.repository.findById(id, usuarioId);
        if (!mov) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Movimentação',
                details: [],
                customMessage: messages.error.resourceNotFound('Movimentação'),
            });
        }
        return mov;
    }

    async ensureRebanhoExists(rebanhoId, usuarioId) {
        const rebanho = await this.rebanhoRepository.findById(rebanhoId, usuarioId);
        if (!rebanho) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Rebanho',
                details: [],
                customMessage: 'Rebanho não encontrado ou não pertence ao usuário autenticado.',
            });
        }
        return rebanho;
    }

    async ensurePastoExists(pastoId, usuarioId) {
        const pasto = await this.pastoRepository.findById(pastoId, usuarioId);
        if (!pasto) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Pastagem',
                details: [],
                customMessage: 'Pastagem de destino não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return pasto;
    }
}

export default MovimentacaoService;
