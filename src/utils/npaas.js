// src/utils/npaas.js
//
// Cliente do NPaaS (plataforma de notificações push sobre o Firebase, issue
// #62). Mesmo desenho do app de pedidos (`x-api-key`, usuário `<id>_mobile`),
// com `fetch` nativo em vez de axios — sem dependência nova.
//
// Push é complemento, nunca requisito: sem `NPAAS_URL`/`NPAAS_API_KEY` o
// cliente fica desligado (a notificação continua na caixa do app), e falha ou
// demora do NPaaS vira `false`/log — nunca exceção para quem chamou.

import logger from './logger.js';

const TIMEOUT_MS = 10_000;

let avisouDesligado = false;

/** Usuário no NPaaS: o mesmo id do Pasto Livre com o sufixo do alvo. */
export function usuarioNoNpaas(usuarioId) {
    return `${usuarioId}_mobile`;
}

function configuracao() {
    const url = process.env.NPAAS_URL?.trim();
    const chave = process.env.NPAAS_API_KEY?.trim();
    if (!url || !chave) {
        if (!avisouDesligado) {
            logger.warn('[NPaaS] NPAAS_URL/NPAAS_API_KEY ausentes: push desligado, notificações só na caixa do app.');
            avisouDesligado = true;
        }
        return null;
    }
    return { url: url.replace(/\/+$/, ''), chave };
}

/** O push está configurado? */
export function npaasAtivo() {
    return configuracao() !== null;
}

/**
 * POST no NPaaS. Devolve o corpo da resposta em caso de sucesso e `null` em
 * qualquer falha (desligado, rede, timeout, status de erro) — já com log.
 */
async function postar(caminho, corpo) {
    const config = configuracao();
    if (!config) return null;

    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);
    try {
        const resposta = await fetch(`${config.url}${caminho}`, {
            method: 'POST',
            headers: { 'x-api-key': config.chave, 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
            signal: controle.signal,
        });
        const texto = await resposta.text();
        if (!resposta.ok) {
            logger.error(`[NPaaS] ${caminho} respondeu ${resposta.status}: ${texto.slice(0, 300)}`);
            return null;
        }
        try {
            return texto ? JSON.parse(texto) : {};
        } catch {
            return {};
        }
    } catch (erro) {
        const motivo = erro.name === 'AbortError' ? `timeout de ${TIMEOUT_MS} ms` : erro.message;
        logger.error(`[NPaaS] Falha em ${caminho}: ${motivo}`);
        return null;
    } finally {
        clearTimeout(relogio);
    }
}

const npaas = {
    /** Registra (ou atualiza) o token FCM do aparelho do usuário. */
    async registrarDispositivo(usuarioId, { tokenFcm, plataforma = 'android', versaoApp }) {
        const resposta = await postar('/dispositivos', {
            tokenFcm,
            plataforma,
            versaoApp: versaoApp ?? 'desconhecida',
            usuarioId: usuarioNoNpaas(usuarioId),
        });
        return resposta !== null;
    },

    /** Desativa um token FCM (logout). */
    async desativarToken(tokenFcm) {
        const resposta = await postar('/dispositivos/desativar-token', { tokenFcm });
        return resposta !== null;
    },

    /**
     * Envia o push para todos os aparelhos ativos do usuário. `dados` vai como
     * strings — o FCM só aceita string no payload de dados.
     */
    async enviar(usuarioId, { titulo, corpo, dados = {}, prioridade = 'alta' }) {
        const dadosEmTexto = Object.fromEntries(
            Object.entries(dados)
                .filter(([, valor]) => valor !== null && valor !== undefined)
                .map(([chave, valor]) => [chave, String(valor)]),
        );
        const resposta = await postar('/notificacoes/enviar', {
            usuarioId: usuarioNoNpaas(usuarioId),
            titulo,
            corpo,
            canal: 'push',
            dados: dadosEmTexto,
            prioridade,
        });
        return resposta !== null;
    },
};

export default npaas;
