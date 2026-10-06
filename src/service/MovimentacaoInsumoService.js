// src/service/MovimentacaoInsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { problemasDoMotivo, problemasDoValor } from '../utils/validators/schemas/zod/MovimentacaoInsumoSchema.js';
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

        // Sem `insumoId` só é permitido para a leitura por diferença: com
        // `atualizadoDesde`, o app avança a marca d'água de todas as
        // movimentações da propriedade num único request, em vez de iterar
        // insumo a insumo. O `where` do repository continua escopado ao
        // usuário via `insumo.propriedade.usuarioId` — nada vaza.
        if (!q.insumoId && !q.atualizadoDesde) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'Informe o insumoId, ou use atualizadoDesde para a leitura por diferença.' }],
                customMessage: 'Informe o insumo.',
            });
        }

        if (q.insumoId) {
            await this.ensureInsumoDoUsuario(q.insumoId, usuarioId);
        }

        const { insumoId, propriedadeId, tipo, origem, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = q;
        const filters = {};
        if (insumoId)      filters.insumoId = insumoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (tipo)   filters.tipo = tipo;
        if (origem) filters.origem = origem;
        if (dataInicio) filters.dataInicio = dataInicio;
        if (dataFim)    filters.dataFim = dataFim;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(usuarioId, filters, parseInt(page, 10), parseInt(limit, 10) || 10);
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

    /**
     * Corrige um lançamento já sincronizado (issue #68). Só quantidade, data,
     * motivo, observações e valor pago (#70) — `insumoId` e `tipo` o schema já recusou. A regra
     * do motivo é conferida aqui, com o `tipo` gravado e o resultado do merge:
     * trocar só a observação de um "Outro" para vazio também é recusado.
     */
    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        const atual = await this.ensureExists(id, usuarioId);
        if (!atual.ativo) this.naoEncontrada();

        if (atual.manejoRebanhoId || atual.manejoPastoId
            || atual.origem === 'ManejoRebanho' || atual.origem === 'ManejoPasto') {
            this.edicaoRecusada('origem', 'Lançamento gerado por manejo: edite pelo manejo.');
        }
        // Contagem antiga convertida (#67) é marco da projeção de consumo e
        // não tem motivo de entrada/saída: fica só leitura.
        if (atual.origem === 'AjusteContagem') {
            this.edicaoRecusada('origem', 'Contagem antiga não pode ser editada.');
        }

        const resultado = {
            tipo: atual.tipo,
            origem: parsedData.origem ?? atual.origem,
            observacoes: 'observacoes' in parsedData ? parsedData.observacoes : atual.observacoes,
        };
        const [problema] = [
            ...problemasDoMotivo(resultado),
            // Valor pago só em entrada (issue #70): confere contra o `tipo` gravado.
            ...problemasDoValor({ tipo: atual.tipo, valorTotal: parsedData.valorTotal }),
        ];
        if (problema) this.edicaoRecusada(problema.path[0], problema.message);

        return this.repository.update(id, parsedData, tx);
    }

    /**
     * Desfazer só existe enquanto o lançamento está na fila do aparelho —
     * pendente, ele nunca chegou aqui (issue #68). O que chega é lançamento
     * sincronizado: 409, e a correção é pela edição. A rota e a entrada do
     * `/sync` continuam para que um aparelho antigo com `DELETE` na fila
     * receba a recusa (`conflict`, não recuperável) em vez de travar a fila.
     * A exclusão em cascata de manejo usa `desativarPorManejo`, não isto.
     */
    async remove(id, req) {
        const usuarioId = req.user.id;
        const atual = await this.ensureExists(id, usuarioId);
        if (!atual.ativo) this.naoEncontrada();
        const mensagem = 'Lançamento sincronizado não pode ser desfeito; edite para corrigir.';
        throw new CustomError({
            statusCode: HttpStatusCodes.CONFLICT.code,
            errorType: 'conflict',
            field: 'id',
            details: [{ path: 'id', message: mensagem }],
            customMessage: mensagem,
        });
    }

    edicaoRecusada(campo, mensagem) {
        throw new CustomError({
            statusCode: HttpStatusCodes.BAD_REQUEST.code,
            errorType: 'validationError',
            field: campo,
            details: [{ path: campo, message: mensagem }],
            customMessage: mensagem,
        });
    }

    naoEncontrada() {
        throw new CustomError({
            statusCode: HttpStatusCodes.NOT_FOUND.code,
            errorType: 'resourceNotFound',
            field: 'Movimentação de Insumo',
            details: [],
            customMessage: messages.error.resourceNotFound('Movimentação de Insumo'),
        });
    }

    async ensureExists(id, usuarioId) {
        const mov = await this.repository.findById(id, usuarioId);
        if (!mov) this.naoEncontrada();
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
