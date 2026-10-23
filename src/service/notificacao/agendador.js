
import VerificacaoNotificacoesService from '../VerificacaoNotificacoesService.js';
import logger from '../../utils/logger.js';

const MINUTO = 60 * 1000;

function intervaloEmMinutos() {
    const valor = Number(process.env.NOTIFICACOES_INTERVALO_MIN ?? 60);
    return Number.isFinite(valor) && valor >= 0 ? valor : 60;
}

export function iniciarAgendadorDeNotificacoes() {
    const minutos = intervaloEmMinutos();
    if (process.env.NODE_ENV === 'test' || minutos === 0) {
        logger.info('[Notificações] Agendador desligado.');
        return null;
    }

    const servico = new VerificacaoNotificacoesService();
    let executando = false;

    const executar = async () => {
        if (executando) return;
        executando = true;
        try {
            const r = await servico.verificarTodos();
            logger.info(
                `[Notificações] Verificação: ${r.usuarios} usuário(s), ${r.abertas} nova(s), ` +
                `${r.resolvidas} resolvida(s), ${r.enviadas} push(es), ${r.falhas} falha(s).`,
            );
        } catch (erro) {
            logger.error(`[Notificações] Falha na verificação: ${erro.message}`);
        } finally {
            executando = false;
        }
    };

    const primeira = setTimeout(executar, MINUTO);
    const repeticao = setInterval(executar, minutos * MINUTO);
    primeira.unref?.();
    repeticao.unref?.();
    logger.info(`[Notificações] Agendador ligado: a cada ${minutos} min.`);

    return () => {
        clearTimeout(primeira);
        clearInterval(repeticao);
    };
}
