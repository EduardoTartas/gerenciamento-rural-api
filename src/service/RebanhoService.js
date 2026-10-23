
import { CustomError, HttpStatusCodes, messages, comTransacao } from '../utils/helpers/index.js';
import { rebanhoRepository, pastoRepository, propriedadeRepository } from '../repository/index.js';
import DbConnect from '../config/dbConnect.js';

class RebanhoService {
    constructor() {
        this.repository = rebanhoRepository;
        this.pastoRepository = pastoRepository;
        this.propriedadeRepository = propriedadeRepository;
        this.prisma = DbConnect.prisma;
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureRebanhoExists(id, usuarioId);
        }

        const {
            nomeRebanho, propriedadeId, pastoAtualId, racaId,
            sistemaProducaoId, regimeAlimentarId,
            ativo, atualizadoDesde, page = 1, limit = 10,
        } = req._parsedQuery ?? req.query;

        const filters = {};
        if (nomeRebanho)      filters.nomeRebanho      = nomeRebanho;
        if (propriedadeId)    filters.propriedadeId    = propriedadeId;
        if (pastoAtualId)     filters.pastoAtualId     = pastoAtualId;
        if (racaId)           filters.racaId           = racaId;
        if (sistemaProducaoId) filters.sistemaProducaoId = sistemaProducaoId;
        if (regimeAlimentarId) filters.regimeAlimentarId = regimeAlimentarId;
        if (ativo !== undefined) filters.ativo         = typeof ativo === 'boolean' ? ativo : ativo === 'true';
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            parseInt(limit, 10) || 10,
        );
    }

    async create(parsedData, req, executor) {
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

        // validação obrigatória do pasto
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

        const { permitirLotacaoConjunta = false, ...dadosRebanho } = parsedData;

        if (!permitirLotacaoConjunta) {
            const ocupantes = await this.repository.countAtivosNoPasto(parsedData.pastoAtualId);
            if (ocupantes > 0) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'pastoAtualId',
                    details: [{
                        path: 'pastoAtualId',
                        message: 'O pasto informado já tem outro lote. Envie permitirLotacaoConjunta para juntar os lotes.',
                    }],
                    customMessage: 'O pasto informado já está ocupado por outro lote.',
                });
            }
        }

        const dataEntradaPastoAtual = parsedData.dataEntradaPastoAtual || new Date();

        // transação atômica: cria rebanho + atualiza status do pasto
        return comTransacao(this.prisma, executor, async (tx) => {
            await this.pastoRepository.update(parsedData.pastoAtualId, { status: 'Ocupado' }, tx);

            return this.repository.create({ ...dadosRebanho, dataEntradaPastoAtual }, tx);
        });
    }

    async update(id, parsedData, req, executor) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanhoExists(id, usuarioId);

        if (parsedData.nomeRebanho) {
            await this.validateUniqueNome(parsedData.nomeRebanho, rebanho.propriedadeId, id);
        }

        const isReativacao = parsedData.ativo === true && !rebanho.ativo;

        if (!isReativacao && parsedData.pastoAtualId !== undefined && parsedData.pastoAtualId !== rebanho.pastoAtualId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoAtualId',
                details: [{ path: 'pastoAtualId', message: 'A mudança de pasto deve ser feita através da rota de movimentação.' }],
                customMessage: 'Não é permitido alterar o pasto atual diretamente.',
            });
        }

        if (parsedData.ativo === false) {
            return this._inativar(rebanho, executor);
        }

        if (isReativacao) {
            return this._reativar(rebanho, parsedData, usuarioId, executor);
        }

        return this.repository.update(id, parsedData, executor);
    }

    async remove(id, req, executor) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanhoExists(id, usuarioId);
        return this._inativar(rebanho, executor);
    }

    async _inativar(rebanho, executor) {
        const pastoAnteriorId = rebanho.pastoAtualId;

        return comTransacao(this.prisma, executor, async (tx) => {
            // inativa o rebanho e desvincula do pasto
            const resultado = await tx.rebanho.update({
                where: { id: rebanho.id },
                data: {
                    ativo: false,
                    pastoAtualId: null,
                    dataEntradaPastoAtual: null,
                },
            });

            if (pastoAnteriorId) {
                const rebanhosRestantes = await tx.rebanho.count({
                    where: { pastoAtualId: pastoAnteriorId, ativo: true },
                });
                if (rebanhosRestantes === 0) {
                    await tx.pasto.update({
                        where: { id: pastoAnteriorId },
                        data: { status: 'Descanso', dataUltimaSaida: new Date() },
                    });
                }
            }

            return resultado;
        });
    }

    async _reativar(rebanho, parsedData, usuarioId, executor) {
        if (!parsedData.pastoAtualId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoAtualId',
                details: [{ path: 'pastoAtualId', message: 'Informe o pasto atual para reativar o rebanho.' }],
                customMessage: 'É necessário informar um pasto para reativar o rebanho.',
            });
        }

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

        if (pasto.propriedadeId !== rebanho.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoAtualId',
                details: [{ path: 'pastoAtualId', message: 'O pasto informado não pertence à mesma propriedade do rebanho.' }],
                customMessage: 'Pasto não pertence à propriedade do rebanho.',
            });
        }

        const { pastoAtualId, ativo, ...resto } = parsedData;
        const dataEntradaPastoAtual = resto.dataEntradaPastoAtual || new Date();

        return comTransacao(this.prisma, executor, async (tx) => {
            await tx.pasto.update({
                where: { id: pastoAtualId },
                data: { status: 'Ocupado' },
            });

            return tx.rebanho.update({
                where: { id: rebanho.id },
                data: { ...resto, ativo: true, pastoAtualId, dataEntradaPastoAtual },
            });
        });
    }

    // MÉTODOS UTILITÁRIOS

    async validateUniqueNome(nomeRebanho, propriedadeId, excludeId = null) {
        const existing = await this.repository.findByNome(nomeRebanho, propriedadeId, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
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
