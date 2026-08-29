// src/service/MovimentacaoInsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import {
    movimentacaoInsumoRepository,
    insumoRepository,
    rebanhoRepository,
    pastoRepository,
} from '../repository/index.js';

class MovimentacaoInsumoService {
    constructor() {
        this.repository = movimentacaoInsumoRepository;
        this.insumoRepository = insumoRepository;
        this.rebanhoRepository = rebanhoRepository;
        this.pastoRepository = pastoRepository;
    }

    async list(req) {
        const usuarioId = req.user.id;
        const { id } = req.params;
        if (id) return this.ensureExists(id, usuarioId);

        const q = req._parsedQuery ?? req.query;
        if (!q.insumoId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'Informe o insumoId para listar as movimentações.' }],
                customMessage: 'Informe o insumo.',
            });
        }
        await this.ensureInsumoDoUsuario(q.insumoId, usuarioId);

        const { insumoId, tipo, origem, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = q;
        const filters = { insumoId };
        if (tipo)   filters.tipo = tipo;
        if (origem) filters.origem = origem;
        if (dataInicio) filters.dataInicio = dataInicio;
        if (dataFim)    filters.dataFim = dataFim;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(usuarioId, filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100));
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        const insumo = await this.ensureInsumoDoUsuario(parsedData.insumoId, usuarioId);

        if (parsedData.rebanhoId) {
            await this.ensureVinculoDaPropriedade(
                this.rebanhoRepository, parsedData.rebanhoId, usuarioId, insumo.propriedadeId,
                'rebanhoId',
                'Rebanho não encontrado ou não pertence ao usuário autenticado.',
                'O rebanho pertence a outra propriedade.',
            );
        }
        if (parsedData.pastoId) {
            await this.ensureVinculoDaPropriedade(
                this.pastoRepository, parsedData.pastoId, usuarioId, insumo.propriedadeId,
                'pastoId',
                'Pasto não encontrado ou não pertence ao usuário autenticado.',
                'O pasto pertence a outra propriedade.',
            );
        }

        return this.repository.create(parsedData, tx);
    }

    /**
     * Garante que o rebanho/pasto informado pertence ao usuário e à mesma
     * propriedade do insumo movimentado. Sem isso, o produtor poderia gravar
     * linhas de ledger referenciando FK de outro tenant.
     */
    async ensureVinculoDaPropriedade(repository, id, usuarioId, propriedadeIdInsumo, campo, msgNaoEncontrado, msgOutraPropriedade) {
        const registro = await repository.findById(id, usuarioId);
        if (!registro) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: campo,
                details: [{ path: campo, message: msgNaoEncontrado }],
                customMessage: msgNaoEncontrado,
            });
        }
        if (registro.propriedadeId !== propriedadeIdInsumo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: campo,
                details: [{ path: campo, message: msgOutraPropriedade }],
                customMessage: msgOutraPropriedade,
            });
        }
        return registro;
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        return this.repository.remove(id, tx);
    }

    async ensureExists(id, usuarioId) {
        const mov = await this.repository.findById(id, usuarioId);
        if (!mov) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Movimentação de Insumo',
                details: [],
                customMessage: messages.error.resourceNotFound('Movimentação de Insumo'),
            });
        }
        return mov;
    }

    async ensureInsumoDoUsuario(insumoId, usuarioId) {
        const insumo = await this.insumoRepository.findById(insumoId, usuarioId);
        if (!insumo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Insumo',
                details: [],
                customMessage: 'Insumo não encontrado ou não pertence ao usuário autenticado.',
            });
        }
        return insumo;
    }
}

export default MovimentacaoInsumoService;
