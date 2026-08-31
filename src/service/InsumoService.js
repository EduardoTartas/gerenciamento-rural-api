// src/service/InsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { insumoRepository, propriedadeRepository } from '../repository/index.js';
import DbConnect from '../config/dbConnect.js';
import { calcularSaldos, calcularSaldosComResumo } from './insumo/calculoSaldo.js';

class InsumoService {
    constructor() {
        this.repository = insumoRepository;
        this.propriedadeRepository = propriedadeRepository;
        this.prisma = DbConnect.prisma;
    }

    /** Converte Decimal -> Number e anexa o pacote de saldo a um insumo lido. */
    comSaldo(insumo) {
        const regimes = (insumo.regimesConsumo ?? []).map((r) => ({
            quantidadeDia: Number(r.quantidadeDia),
            dataInicio: r.dataInicio,
            dataFim: r.dataFim,
            ativo: r.ativo,
        }));
        const agora = new Date();

        // Listagem: o repository já agregou o ledger em `_resumoLedger`.
        // findById/create/update: o ledger cru vem em `movimentacoes`.
        const saldo = insumo._resumoLedger
            ? calcularSaldosComResumo({ resumo: insumo._resumoLedger, regimes, agora })
            : calcularSaldos({
                movimentacoes: (insumo.movimentacoes ?? []).map((m) => ({
                    tipo: m.tipo,
                    quantidade: Number(m.quantidade),
                    origem: m.origem,
                    data: m.data,
                })),
                regimes,
                agora,
            });

        const estoqueMinimo = insumo.estoqueMinimo == null ? null : Number(insumo.estoqueMinimo);
        saldo.estoqueBaixo = estoqueMinimo != null && saldo.saldoProjetado <= estoqueMinimo;

        const { movimentacoes: _m, regimesConsumo: _r, _resumoLedger: _rl, ...limpo } = insumo;
        return { ...limpo, saldo };
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            const insumo = await this.ensureInsumoExists(id, usuarioId);
            return this.comSaldo(insumo);
        }

        const { propriedadeId, tipoInsumoId, destino, nome, ativo, atualizadoDesde, page = 1, limit = 10 } =
            req._parsedQuery ?? req.query;
        const filters = {};
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (tipoInsumoId)  filters.tipoInsumoId = tipoInsumoId;
        if (destino)       filters.destino = destino;
        if (nome)          filters.nome = nome;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        const pagina = await this.repository.list(
            usuarioId, filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100),
        );
        return { ...pagina, docs: pagina.docs.map((d) => this.comSaldo(d)) };
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensurePropriedadeExists(parsedData.propriedadeId, usuarioId);
        await this.ensureTipoInsumoExists(parsedData.tipoInsumoId);
        await this.ensureNomeDisponivel(usuarioId, parsedData.propriedadeId, parsedData.nome);
        const criado = await this.repository.create(parsedData, tx);
        return this.comSaldo(criado);
    }

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        const atual = await this.ensureInsumoExists(id, usuarioId);

        if (parsedData.tipoInsumoId) {
            await this.ensureTipoInsumoExists(parsedData.tipoInsumoId);
        }
        if (parsedData.nome && parsedData.nome.toLowerCase() !== atual.nome.toLowerCase()) {
            await this.ensureNomeDisponivel(usuarioId, atual.propriedadeId, parsedData.nome, id);
        }
        // Reativar um insumo cujo nome foi reutilizado por outro ativo colide com
        // o índice único parcial `insumos_propriedadeId_nome_ci_key`.
        if (parsedData.ativo === true && atual.ativo === false) {
            await this.ensureNomeDisponivel(usuarioId, atual.propriedadeId, parsedData.nome ?? atual.nome, id);
        }
        const atualizado = await this.repository.update(id, parsedData, tx);
        return this.comSaldo(atualizado);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureInsumoExists(id, usuarioId);
        return this.repository.remove(id, tx);
    }

    // utilitários

    async ensureInsumoExists(id, usuarioId) {
        const insumo = await this.repository.findById(id, usuarioId);
        if (!insumo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Insumo',
                details: [],
                customMessage: messages.error.resourceNotFound('Insumo'),
            });
        }
        return insumo;
    }

    async ensurePropriedadeExists(propriedadeId, usuarioId) {
        const p = await this.propriedadeRepository.findById(propriedadeId, usuarioId);
        if (!p) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Propriedade',
                details: [],
                customMessage: 'Propriedade não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return p;
    }

    async ensureTipoInsumoExists(tipoInsumoId) {
        const tipo = await this.prisma.tipoInsumo.findFirst({ where: { id: tipoInsumoId, ativo: true } });
        if (!tipo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'tipoInsumoId',
                details: [{ path: 'tipoInsumoId', message: 'Tipo de insumo não encontrado ou inativo.' }],
                customMessage: 'Tipo de insumo não encontrado.',
            });
        }
        return tipo;
    }

    async ensureNomeDisponivel(usuarioId, propriedadeId, nome, excludeId = null) {
        const existe = await this.repository.findByNome(usuarioId, propriedadeId, nome, excludeId);
        if (existe) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'nome',
                details: [{ path: 'nome', message: 'Já existe um insumo com este nome nesta propriedade.' }],
                customMessage: 'Já existe um insumo com este nome nesta propriedade.',
            });
        }
    }
}

export default InsumoService;
