// src/service/LancamentoAutomaticoService.js
import { movimentacaoInsumoRepository, regimeConsumoInsumoRepository } from '../repository/index.js';
import { planejarLancamentos } from './insumo/lancamentoAutomatico.js';
import DbConnect from '../config/dbConnect.js';
import logger from '../utils/logger.js';

/**
 * Lançamento automático do consumo diário de insumo (issue #72): para cada
 * regime com `lancamentoAutomatico`, grava as saídas `ConsumoRebanho` que
 * faltam, uma a cada 24 h (ver `planejarLancamentos`).
 *
 * Roda no início da verificação periódica de cada produtor, antes das
 * notificações — o aviso de insumo acabando já vê o estoque atualizado. Um
 * insumo por transação: o ledger lido e os lançamentos gravados são do mesmo
 * instante, e a falha de um insumo não impede os outros.
 */
class LancamentoAutomaticoService {
    constructor() {
        this.regimeRepository = regimeConsumoInsumoRepository;
        this.movimentacaoRepository = movimentacaoInsumoRepository;
        this.prisma = DbConnect.prisma;
    }

    /** @returns {Promise<{ regimes: number, lancamentos: number }>} */
    async lancarPendentes({ usuarioId = null, agora = new Date() } = {}) {
        const regimes = await this.regimeRepository.listarAutomaticos(usuarioId);
        const porInsumo = new Map();
        for (const regime of regimes) {
            const lista = porInsumo.get(regime.insumoId) ?? [];
            lista.push(regime);
            porInsumo.set(regime.insumoId, lista);
        }

        let lancamentos = 0;
        for (const [insumoId, doInsumo] of porInsumo) {
            try {
                lancamentos += await this.prisma.$transaction(async (tx) => {
                    const ledger = await this.movimentacaoRepository.ledgerDoInsumo(insumoId, tx);
                    const novos = planejarLancamentos(doInsumo, ledger, agora);
                    return this.movimentacaoRepository.criarLancamentosAutomaticos(novos, tx);
                });
            } catch (erro) {
                logger.error(`[Consumo automático] Falha no insumo ${insumoId}: ${erro.message}`);
            }
        }
        return { regimes: regimes.length, lancamentos };
    }
}

export default LancamentoAutomaticoService;
