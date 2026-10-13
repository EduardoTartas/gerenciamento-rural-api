// src/service/notificacao/agendador.js
//
// Roda a verificação dos avisos da fazenda periodicamente (issue #62). Só o
// `server.js` liga o agendador — os testes importam o `app` e nunca o ligam.
//
// `setInterval`, e não uma lib de cron: a verificação é horária, idempotente e
// não depende de horário exato, então não vale uma dependência nova. Uma
// execução não começa enquanto a anterior não terminar. Em mais de uma réplica
// as duas verificariam, mas sem duplicar nada: a notificação tem chave única e
// o push é reservado atomicamente (ver `VerificacaoNotificacoesService`).

import VerificacaoNotificacoesService from '../VerificacaoNotificacoesService.js';
import logger from '../../utils/logger.js';

const MINUTO = 60 * 1000;

/** Intervalo em minutos (`NOTIFICACOES_INTERVALO_MIN`, padrão 60). 0 desliga. */
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

    // Primeira verificação um minuto depois de subir, para não competir com o boot.
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
