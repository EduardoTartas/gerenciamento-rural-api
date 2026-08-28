// src/service/RegimeConsumoInsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { regimeConsumoInsumoRepository, rebanhoRepository, insumoRepository } from '../repository/index.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import DbConnect from '../config/dbConnect.js';

class RegimeConsumoInsumoService {
    constructor() {
        this.repository = regimeConsumoInsumoRepository;
        this.rebanhoRepository = rebanhoRepository;
        this.insumoRepository = insumoRepository;
        this.prisma = DbConnect.prisma;
    }

    async list(req) {
        const usuarioId = req.user.id;
        const { id } = req.params;
        if (id) return this.ensureExists(id, usuarioId);

        const { rebanhoId, insumoId, emAberto, ativo, atualizadoDesde, page = 1, limit = 10 } =
            req._parsedQuery ?? req.query;
        const filters = {};
        if (rebanhoId) filters.rebanhoId = rebanhoId;
        if (insumoId)  filters.insumoId = insumoId;
        if (emAberto)  filters.emAberto = emAberto;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(usuarioId, filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100));
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanho(parsedData.rebanhoId, usuarioId);
        const insumo = await this.ensureInsumo(parsedData.insumoId, usuarioId);
        this.validarCompatibilidade(rebanho, insumo);

        return comTransacao(this.prisma, tx, async (trx) => {
            const aberto = await this.repository.findAbertoDoPar(parsedData.rebanhoId, parsedData.insumoId, trx);
            if (aberto) {
                await this.repository.update(aberto.id, { dataFim: parsedData.dataInicio, ativo: false }, trx);
            }
            return this.repository.create(parsedData, trx);
        });
    }

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        const dados = { ...parsedData };
        if (dados.dataFim) dados.ativo = false; // encerrar
        return this.repository.update(id, dados, tx);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        // exclusão lógica: encerra e desativa
        return this.repository.update(id, { ativo: false, dataFim: new Date() }, tx);
    }

    // utilitários

    validarCompatibilidade(rebanho, insumo) {
        if (insumo.propriedadeId !== rebanho.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'O insumo pertence a outra propriedade.' }],
                customMessage: 'Insumo e rebanho são de propriedades diferentes.',
            });
        }
        if (!['Rebanho', 'Ambos'].includes(insumo.destino)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'Este insumo não é destinado ao rebanho.' }],
                customMessage: 'Insumo não pode ser consumido pelo rebanho.',
            });
        }
    }

    async ensureExists(id, usuarioId) {
        const regime = await this.repository.findById(id, usuarioId);
        if (!regime) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Regime de Consumo',
                details: [],
                customMessage: messages.error.resourceNotFound('Regime de Consumo'),
            });
        }
        return regime;
    }

    async ensureRebanho(rebanhoId, usuarioId) {
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

    async ensureInsumo(insumoId, usuarioId) {
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

export default RegimeConsumoInsumoService;
