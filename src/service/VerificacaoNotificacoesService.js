
import { notificacaoRepository, insumoRepository } from '../repository/index.js';
import InsumoService from './InsumoService.js';
import LancamentoAutomaticoService from './LancamentoAutomaticoService.js';
import { avaliarSituacoes, TIPOS_DADOS_FALTANDO, TIPOS_SEM_RESOLUCAO } from './notificacao/regras.js';
import npaas, { npaasAtivo } from '../utils/npaas.js';
import logger from '../utils/logger.js';

export const FUSO_DA_FAZENDA = 'America/Cuiaba';
export const HORA_INICIO_PUSH = 6;
export const HORA_FIM_PUSH = 21;
export const MAXIMO_TENTATIVAS_PUSH = 3;
export const LIMITE_PUSH_INDIVIDUAL = 3;

const horaNoFuso = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_DA_FAZENDA,
    hour: 'numeric',
    hourCycle: 'h23',
});

/** dentro da janela de envio (6h às 21h no fuso da fazenda)? */
export function dentroDoHorarioDePush(agora = new Date()) {
    const hora = Number(horaNoFuso.format(agora));
    return hora >= HORA_INICIO_PUSH && hora < HORA_FIM_PUSH;
}

const dataNoFuso = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DA_FAZENDA, year: 'numeric', month: '2-digit', day: '2-digit',
});
const nomeDoMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long' });

function inicioDoMes(ano, mes) {
    return new Date(`${ano}-${String(mes).padStart(2, '0')}-01T00:00:00-04:00`);
}

export function calendarioDaFazenda(agora = new Date()) {
    const [ano, mes, dia] = dataNoFuso.format(agora).split('-').map(Number);
    const anoAnterior = mes === 1 ? ano - 1 : ano;
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    return {
        dia,
        inicioDoMes: inicioDoMes(ano, mes),
        mesAnterior: {
            referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}`,
            nome: nomeDoMes.format(new Date(Date.UTC(anoAnterior, mesAnterior - 1, 15))),
            inicio: inicioDoMes(anoAnterior, mesAnterior),
            fim: inicioDoMes(ano, mes),
        },
    };
}

class VerificacaoNotificacoesService {
    constructor() {
        this.repository = notificacaoRepository;
        this.insumoRepository = insumoRepository;
        this.insumoService = new InsumoService();
        this.lancamentoAutomatico = new LancamentoAutomaticoService();
    }

    async verificarTodos({ agora = new Date() } = {}) {
        await this.repository.liberarEnviosTravados();
        const usuarios = await this.repository.listarUsuariosComPropriedade();
        const total = { usuarios: usuarios.length, abertas: 0, resolvidas: 0, enviadas: 0, falhas: 0 };
        for (const usuarioId of usuarios) {
            try {
                const r = await this.verificarUsuario(usuarioId, { agora });
                total.abertas += r.abertas;
                total.resolvidas += r.resolvidas;
                total.enviadas += r.enviadas;
            } catch (erro) {
                total.falhas += 1;
                logger.error(`[Notificações] Falha ao verificar o usuário ${usuarioId}: ${erro.message}`);
            }
        }
        return total;
    }

    async verificarUsuario(usuarioId, { agora = new Date(), ignorarSilencio = false } = {}) {
        let lancamentos = 0;
        try {
            ({ lancamentos } = await this.lancamentoAutomatico.lancarPendentes({ usuarioId, agora }));
        } catch (erro) {
            logger.error(`[Consumo automático] Falha para o usuário ${usuarioId}: ${erro.message}`);
        }
        const situacoes = await this.avaliar(usuarioId, agora);
        const abertas = await this.repository.listarAbertas(usuarioId);
        const chavesAbertas = new Map(abertas.map((n) => [n.chaveAtiva, n.id]));
        const chavesAtuais = new Set(situacoes.map((s) => s.chave));
        const jaAvisadas = await this.repository.listarJaAvisadas(usuarioId, TIPOS_DADOS_FALTANDO);

        const resolvidas = await this.repository.resolver(
            abertas
                .filter((n) => !chavesAtuais.has(n.chaveAtiva) && !TIPOS_SEM_RESOLUCAO.includes(n.tipo))
                .map((n) => n.id),
        );

        const pushLigado = npaasAtivo();
        let novas = 0;
        for (const s of situacoes) {
            if (chavesAbertas.has(s.chave)) continue;
            if (TIPOS_DADOS_FALTANDO.includes(s.tipo) && jaAvisadas.has(`${s.tipo}:${s.entidadeId}`)) continue;
            // `somenteCaixa`: aviso sem push (dados faltando).
            let pushStatus = 'somenteCaixa';
            if (s.push) pushStatus = pushLigado ? 'pendente' : 'desligado';
            const criada = await this.repository.abrir({
                usuarioId,
                propriedadeId: s.propriedadeId,
                tipo: s.tipo,
                titulo: s.titulo,
                mensagem: s.mensagem,
                entidade: s.entidade,
                entidadeId: s.entidadeId,
                rota: s.rota,
                chaveAtiva: s.chave,
                pushStatus,
            });
            if (criada) novas += 1;
        }

        const podeEnviar = ignorarSilencio || dentroDoHorarioDePush(agora);
        const enviadas = podeEnviar ? await this.enviarPendentes(usuarioId) : 0;

        return { abertas: novas, resolvidas, enviadas, foraDoHorario: !podeEnviar, lancamentos };
    }

    async avaliar(usuarioId, agora) {
        const calendario = calendarioDaFazenda(agora);
        const [fazendas, insumos, lotesSemValorCompra, insumosSemPreco, saidasDoMes] = await Promise.all([
            this.repository.carregarFazendas(usuarioId),
            this.insumoRepository.listarAtivosComResumo(usuarioId),
            this.repository.listarLotesSemValorCompra(usuarioId),
            this.repository.listarInsumosSemPreco(usuarioId, calendario.inicioDoMes, agora),
            // resumo do mês só no dia 1 (no fuso da fazenda).
            calendario.dia === 1
                ? this.repository.listarSaidasDoPeriodo(usuarioId, calendario.mesAnterior.inicio, calendario.mesAnterior.fim)
                : null,
        ]);

        return avaliarSituacoes({
            usuarioId,
            agora,
            lotesSemValorCompra,
            insumosSemPreco,
            resumoMes: saidasDoMes && this.resumirSaidas(saidasDoMes, calendario.mesAnterior),
            fazendas: fazendas.map((f) => ({
                ...f,
                pastos: f.pastos.map((p) => ({ ...p, extensaoHa: p.extensaoHa == null ? null : Number(p.extensaoHa) })),
                rebanhos: f.rebanhos.map((r) => ({
                    ...r,
                    pesoMedioAtual: r.pesoMedioAtual == null ? null : Number(r.pesoMedioAtual),
                    sistemaProducao: r.sistemaProducao?.nome ?? null,
                })),
            })),
            insumos: insumos.map((i) => {
                const teveEntrada = (i._resumoLedger?.entrada ?? 0) > 0;
                const { saldo, ...insumo } = this.insumoService.comSaldo(i);
                return {
                    ...insumo,
                    estoqueMinimo: insumo.estoqueMinimo == null ? null : Number(insumo.estoqueMinimo),
                    teveEntrada,
                    saldo,
                };
            }),
        });
    }

    resumirSaidas(saidas, mes) {
        const porFazenda = new Map();
        for (const s of saidas) {
            const { id, nome } = s.rebanho.propriedade;
            if (!porFazenda.has(id)) {
                porFazenda.set(id, { propriedadeId: id, nome, cabecasVendidas: 0, receita: 0, cabecasSaidas: 0 });
            }
            const f = porFazenda.get(id);
            f.cabecasSaidas += s.quantidadeCabecas;
            if (s.motivo === 'Venda') {
                f.cabecasVendidas += s.quantidadeCabecas;
                f.receita += s.valorTotal == null ? 0 : Number(s.valorTotal);
            }
        }
        return { referencia: mes.referencia, nomeMes: mes.nome, fazendas: [...porFazenda.values()] };
    }

    async enviarPendentes(usuarioId) {
        if (!npaasAtivo()) return 0;
        const pendentes = await this.repository.listarPushPendentes(usuarioId);
        if (pendentes.length === 0) return 0;

        const reservadas = [];
        for (const n of pendentes) {
            if (await this.repository.reservarPush(n.id)) reservadas.push(n);
        }
        if (reservadas.length === 0) return 0;

        if (reservadas.length > LIMITE_PUSH_INDIVIDUAL) {
            const enviado = await npaas.enviar(usuarioId, {
                titulo: `${reservadas.length} avisos da fazenda`,
                corpo: reservadas.slice(0, 2).map((n) => n.titulo).join(' · ') + ' e mais.',
                dados: { tipo: 'RESUMO', rota: '/notificacoes', notificacaoId: '', propriedadeId: '', entidadeId: '' },
            });
            for (const n of reservadas) {
                await this.repository.concluirPush(n.id, enviado, n.pushTentativas + 1, MAXIMO_TENTATIVAS_PUSH);
            }
            return enviado ? 1 : 0;
        }

        let enviadas = 0;
        for (const n of reservadas) {
            const enviado = await npaas.enviar(usuarioId, {
                titulo: n.titulo,
                corpo: n.mensagem,
                dados: {
                    notificacaoId: n.id,
                    tipo: n.tipo,
                    rota: n.rota ?? '/home',
                    propriedadeId: n.propriedadeId ?? '',
                    entidadeId: n.entidadeId ?? '',
                },
            });
            await this.repository.concluirPush(n.id, enviado, n.pushTentativas + 1, MAXIMO_TENTATIVAS_PUSH);
            if (enviado) enviadas += 1;
        }
        return enviadas;
    }
}

export default VerificacaoNotificacoesService;
