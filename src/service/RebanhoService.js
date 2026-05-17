// src/service/RebanhoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { rebanhoRepository, pastoRepository, propriedadeRepository } from '../repository/index.js';
import DbConnect from '../config/dbConnect.js';

class RebanhoService {
    constructor() {
        this.repository = rebanhoRepository;
        this.pastoRepository = pastoRepository;
        this.propriedadeRepository = propriedadeRepository;
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista rebanhos com paginação e filtragem.
     */
    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureRebanhoExists(id, usuarioId);
        }

        const {
            nomeRebanho, propriedadeId, pastoAtualId, racaId,
            sistemaProducaoId, regimeAlimentarId,
            ativo, page = 1, limit = 10,
        } = req._parsedQuery ?? req.query;

        const filters = {};
        if (nomeRebanho)      filters.nomeRebanho      = nomeRebanho;
        if (propriedadeId)    filters.propriedadeId    = propriedadeId;
        if (pastoAtualId)     filters.pastoAtualId     = pastoAtualId;
        if (racaId)           filters.racaId           = racaId;
        if (sistemaProducaoId) filters.sistemaProducaoId = sistemaProducaoId;
        if (regimeAlimentarId) filters.regimeAlimentarId = regimeAlimentarId;
        // ativo vem como boolean do Zod (_parsedQuery) ou string do req.query
        if (ativo !== undefined) filters.ativo         = typeof ativo === 'boolean' ? ativo : ativo === 'true';

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Cria um novo rebanho.
     * Regras: propriedade ativa, nome único por propriedade (entre ativos),
     *         pasto ativo (se informado) e pertence à mesma propriedade.
     * Toda a operação é executada em uma transação atômica.
     */
    async create(parsedData, req) {
        const usuarioId = req.user.id;

        const propriedade = await this.ensurePropriedadeExists(parsedData.propriedadeId, usuarioId);
        if (!propriedade.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'propriedadeId',
                details: [{ path: 'propriedadeId', message: 'Não é possível criar um rebanho em uma propriedade inativa.' }],
                customMessage: 'Propriedade está inativa.',
            });
        }

        await this.validateUniqueNome(parsedData.nomeRebanho, parsedData.propriedadeId);

        // Validação obrigatória do pasto
        const pasto = await this.ensurePastoExists(parsedData.pastoAtualId, usuarioId);

        if (!pasto.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoAtualId',
                details: [{ path: 'pastoAtualId', message: 'Não é possível vincular um rebanho a um pasto inativo.' }],
                customMessage: 'Pasto está inativo.',
            });
        }

        if (pasto.propriedadeId !== parsedData.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoAtualId',
                details: [{ path: 'pastoAtualId', message: 'O pasto informado não pertence à mesma propriedade do rebanho.' }],
                customMessage: 'Pasto não pertence à propriedade informada.',
            });
        }

        const dataEntradaPastoAtual = parsedData.dataEntradaPastoAtual || new Date();

        // Transação atômica: cria rebanho + atualiza status do pasto
        return this.prisma.$transaction(async (tx) => {
            await tx.pasto.update({
                where: { id: parsedData.pastoAtualId },
                data: { status: 'Ocupado' },
            });

            return tx.rebanho.create({
                data: { ...parsedData, dataEntradaPastoAtual },
            });
        });
    }

    /**
     * Atualiza um rebanho existente.
     */
    async update(id, parsedData, req) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanhoExists(id, usuarioId);

        if (parsedData.nomeRebanho) {
            await this.validateUniqueNome(parsedData.nomeRebanho, rebanho.propriedadeId, id);
        }

        if (parsedData.pastoAtualId !== undefined && parsedData.pastoAtualId !== rebanho.pastoAtualId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoAtualId',
                details: [{ path: 'pastoAtualId', message: 'A mudança de pasto deve ser feita através da rota de movimentação.' }],
                customMessage: 'Não é permitido alterar o pasto atual diretamente.',
            });
        }

        // Inativação: redireciona para remove(), passando o rebanho já carregado
        if (parsedData.ativo === false) {
            return this._inativar(rebanho);
        }

        return this.repository.update(id, parsedData);
    }

    /**
     * Inativa (Soft-Delete) um rebanho.
     * Desvincula do pasto atual e atualiza o status do pasto se necessário.
     * Executado em uma transação atômica.
     */
    async remove(id, req) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanhoExists(id, usuarioId);
        return this._inativar(rebanho);
    }

    /**
     * Lógica interna de inativação, recebe o rebanho já carregado para evitar query duplicada.
     * Usa transação atômica para garantir consistência.
     */
    async _inativar(rebanho) {
        const pastoAnteriorId = rebanho.pastoAtualId;

        return this.prisma.$transaction(async (tx) => {
            // Inativa o rebanho e desvincula do pasto
            const resultado = await tx.rebanho.update({
                where: { id: rebanho.id },
                data: {
                    ativo: false,
                    pastoAtualId: null,
                    dataEntradaPastoAtual: null,
                },
            });

            // Se havia pasto vinculado, verifica se ainda há outros rebanhos
            if (pastoAnteriorId) {
                const rebanhosRestantes = await tx.rebanho.count({
                    where: { pastoAtualId: pastoAnteriorId, ativo: true },
                });
                if (rebanhosRestantes === 0) {
                    await tx.pasto.update({
                        where: { id: pastoAnteriorId },
                        data: { status: 'Vazio', dataUltimaSaida: new Date() },
                    });
                }
            }

            return resultado;
        });
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    async validateUniqueNome(nomeRebanho, propriedadeId, excludeId = null) {
        const existing = await this.repository.findByNome(nomeRebanho, propriedadeId, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'validationError',
                field: 'nomeRebanho',
                details: [{ path: 'nomeRebanho', message: 'Já existe um rebanho ativo com este nome nesta propriedade.' }],
                customMessage: 'Já existe um rebanho com este nome nesta propriedade.',
            });
        }
    }

    async ensureRebanhoExists(id, usuarioId) {
        const rebanho = await this.repository.findById(id, usuarioId);
        if (!rebanho) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Rebanho',
                details: [],
                customMessage: messages.error.resourceNotFound('Rebanho'),
            });
        }
        return rebanho;
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

    async ensurePastoExists(pastoId, usuarioId) {
        const pasto = await this.pastoRepository.findById(pastoId, usuarioId);
        if (!pasto) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Pastagem',
                details: [],
                customMessage: 'Pastagem não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return pasto;
    }
}

export default RebanhoService;
