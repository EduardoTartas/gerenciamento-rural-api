
import DbConnect from '../config/dbConnect.js';
import MutacaoAplicadaRepository from '../repository/MutacaoAplicadaRepository.js';
import { CustomError, HttpStatusCodes, descreverErro } from '../utils/helpers/index.js';
import logger from '../utils/logger.js';
import { DESPACHO } from './sync/despacho.js';
import { descendentes, ordenarPorDependencia } from './sync/grafoDeDependencia.js';
import { validarDadosDaMutacao } from './sync/validacao.js';

/** dias que uma mutação aplicada fica registrada. */
const RETENCAO_EM_DIAS = 30;

class SyncService {
    constructor() {
        this.prisma = DbConnect.prisma;
        this.mutacoesAplicadas = new MutacaoAplicadaRepository();
    }

    async aplicarLote(mutacoes, req) {
        const usuarioId = req.user.id;

        const { ordem, erro } = ordenarPorDependencia(mutacoes);
        if (erro) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'mutacoes',
                details: [{ path: 'mutacoes', message: erro }],
                customMessage: erro,
            });
        }

        await this.mutacoesAplicadas.limparAntigas(usuarioId, RETENCAO_EM_DIAS);

        const porId = new Map(mutacoes.map((m) => [m.id, m]));
        const jaAplicadas = await this.mutacoesAplicadas.buscarPorIds(usuarioId, ordem);

        const resultados = new Map();
        const bloqueadas = new Map(); // id da bloqueada -> id de quem a bloqueou

        for (const id of ordem) {
            const mutacao = porId.get(id);

            if (bloqueadas.has(id)) {
                resultados.set(id, {
                    id,
                    situacao: 'bloqueado',
                    entidade: mutacao.entidade,
                    entidadeId: mutacao.entidadeId,
                    bloqueadoPor: bloqueadas.get(id),
                });
                continue;
            }

            const anterior = jaAplicadas.get(id);
            if (anterior) {
                resultados.set(id, anterior);
                continue;
            }

            const resultado = await this._aplicarUma(mutacao, usuarioId, req);
            resultados.set(id, resultado);

            if (resultado.situacao === 'recusado') {
                for (const descendente of descendentes(mutacoes, id)) {
                    if (!bloqueadas.has(descendente)) bloqueadas.set(descendente, id);
                }
            }
        }

        return { resultados: mutacoes.map((m) => resultados.get(m.id)) };
    }

    async _aplicarUma(mutacao, usuarioId, req) {
        const { id, entidade, acao, entidadeId, dados } = mutacao;
        const executar = DESPACHO[`${entidade}:${acao}`];

        if (!executar) {
            return this._recusa(mutacao, {
                errorType: 'validationError',
                field: 'entidade',
                customMessage: `Combinação não suportada: ${entidade} com ação ${acao}.`,
            });
        }

        const validacao = validarDadosDaMutacao({ entidade, acao, dados });
        if (!validacao.ok) {
            return this._recusa(mutacao, validacao.erro);
        }
        const dadosValidados = validacao.dados;

        try {
            return await this.prisma.$transaction(async (tx) => {
                const gravado = await executar({ entidadeId, dados: dadosValidados, req, tx });

                const resultado = {
                    id,
                    situacao: 'aceito',
                    entidade,
                    entidadeId,
                    dados: gravado,
                };

                await this.mutacoesAplicadas.registrar(tx, {
                    id,
                    usuarioId,
                    entidade,
                    entidadeId,
                    resultado,
                });

                return resultado;
            });
        } catch (erro) {
            return this._recusa(mutacao, erro);
        }
    }

    _recusa(mutacao, erro) {
        const tipoBruto = erro?.errorType;

        if (!tipoBruto) {
            logger.error('Erro inesperado ao aplicar mutação do lote', {
                mutacaoId: mutacao.id,
                entidade: mutacao.entidade,
                entidadeId: mutacao.entidadeId,
                message: erro?.message,
                stack: erro?.stack,
            });

            return {
                id: mutacao.id,
                situacao: 'recusado',
                entidade: mutacao.entidade,
                entidadeId: mutacao.entidadeId,
                erro: {
                    tipo: 'serverError',
                    campo: null,
                    mensagem: 'Erro ao aplicar a mutação. Tente novamente mais tarde.',
                    recuperavel: true,
                },
            };
        }

        const { tipo, recuperavel } = descreverErro(tipoBruto);
        return {
            id: mutacao.id,
            situacao: 'recusado',
            entidade: mutacao.entidade,
            entidadeId: mutacao.entidadeId,
            erro: {
                tipo,
                campo: erro.field ?? null,
                mensagem: erro.customMessage ?? erro.message ?? 'Erro ao aplicar a mutação.',
                recuperavel,
            },
        };
    }
}

export default SyncService;
