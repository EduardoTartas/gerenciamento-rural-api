// O cliente real do NPaaS, com `fetch` falso: nenhum teste sai para a rede.
// Exercita o que os endpoints não enxergam através do mock — o contrato do
// corpo enviado, o desligamento sem configuração e a falha virando `false`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import npaas, { npaasAtivo } from '../../../src/utils/npaas.js';

const URL_FALSA = 'https://npaas.exemplo.test/api/v1';

describe('Cliente NPaaS (src/utils/npaas.js)', () => {
    let fetchFalso;

    beforeEach(() => {
        fetchFalso = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
        vi.stubGlobal('fetch', fetchFalso);
        vi.stubEnv('NPAAS_URL', `${URL_FALSA}/`);
        vi.stubEnv('NPAAS_API_KEY', 'chave-falsa-de-teste');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('NPAAS-01 envia o push com usuário _mobile, x-api-key e dados só em texto', async () => {
        const ok = await npaas.enviar('u1', {
            titulo: 'Piquete 3 pronto',
            corpo: 'O descanso terminou.',
            dados: { notificacaoId: 'n1', tipo: 'PASTO_PRONTO', rota: '/pastos/p1', propriedadeId: 'f1', entidadeId: 'p1', vazio: null, numero: 3 },
        });

        expect(ok).toBe(true);
        const [url, opcoes] = fetchFalso.mock.calls[0];
        expect(url).toBe(`${URL_FALSA}/notificacoes/enviar`);
        expect(opcoes.headers['x-api-key']).toBe('chave-falsa-de-teste');
        const corpo = JSON.parse(opcoes.body);
        expect(corpo).toMatchObject({ usuarioId: 'u1_mobile', titulo: 'Piquete 3 pronto', corpo: 'O descanso terminou.', prioridade: 'alta' });
        expect(corpo.dados).toEqual({
            notificacaoId: 'n1', tipo: 'PASTO_PRONTO', rota: '/pastos/p1', propriedadeId: 'f1', entidadeId: 'p1', numero: '3',
        });
    });

    it('NPAAS-02 registra o aparelho em /dispositivos com usuário _mobile', async () => {
        const ok = await npaas.registrarDispositivo('u1', { tokenFcm: 'tok', versaoApp: '1.0.0' });

        expect(ok).toBe(true);
        const [url, opcoes] = fetchFalso.mock.calls[0];
        expect(url).toBe(`${URL_FALSA}/dispositivos`);
        expect(JSON.parse(opcoes.body)).toEqual({ tokenFcm: 'tok', plataforma: 'android', versaoApp: '1.0.0', usuarioId: 'u1_mobile' });
    });

    it('NPAAS-03 sem NPAAS_URL ou NPAAS_API_KEY fica desligado e não chama a rede', async () => {
        vi.stubEnv('NPAAS_API_KEY', '');

        expect(npaasAtivo()).toBe(false);
        expect(await npaas.enviar('u1', { titulo: 't', corpo: 'c' })).toBe(false);
        expect(await npaas.desativarToken('tok')).toBe(false);
        expect(fetchFalso).not.toHaveBeenCalled();
    });

    it('NPAAS-04 erro de rede ou status de erro viram false, nunca exceção', async () => {
        fetchFalso.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        expect(await npaas.enviar('u1', { titulo: 't', corpo: 'c' })).toBe(false);

        fetchFalso.mockResolvedValueOnce(new Response('falhou', { status: 500 }));
        expect(await npaas.enviar('u1', { titulo: 't', corpo: 'c' })).toBe(false);

        fetchFalso.mockResolvedValueOnce(new Response('', { status: 401 }));
        expect(await npaas.registrarDispositivo('u1', { tokenFcm: 'tok' })).toBe(false);
    });
});
