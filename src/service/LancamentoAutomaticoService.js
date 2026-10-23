import { movimentacaoInsumoRepository, regimeConsumoInsumoRepository } from '../repository/index.js';
import { planejarLancamentos } from './insumo/lancamentoAutomatico.js';
import DbConnect from '../config/dbConnect.js';
import logger from '../utils/logger.js';

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
