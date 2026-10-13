import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { reiniciarNpaasFalso } from './apoio-local.js';

const npaasFalso = vi.hoisted(() => ({
    ativo: true, enviar: vi.fn(), registrarDispositivo: vi.fn(), desativarToken: vi.fn(),
}));
vi.mock('../../../src/utils/npaas.js', async () => {
    const { moduloNpaasFalso } = await import('./apoio-local.js');
    return moduloNpaasFalso(npaasFalso);
});

const TOKEN = 'token-fcm-de-teste-1234567890';

describe('Aparelho para push — /v1/dispositivos', () => {
    let a;

    beforeEach(async () => {
        reiniciarNpaasFalso(npaasFalso);
        a = await criarUsuario();
    });

    const registrar = (corpo) =>
        api().post('/v1/dispositivos/registrar').set('Authorization', a.bearer).send(corpo);
    const desativar = (corpo) =>
        api().post('/v1/dispositivos/desativar-token').set('Authorization', a.bearer).send(corpo);

    it('DISP-POST-01 registra o token do usuário autenticado no NPaaS', async () => {
        const r = await registrar({ tokenFcm: TOKEN, plataforma: 'android', versaoApp: '1.4.0' });

        expect(r.status).toBe(200);
        expect(r.body.data).toEqual({ registrado: true, pushAtivo: true });
        expect(npaasFalso.registrarDispositivo).toHaveBeenCalledWith(a.id, {
            tokenFcm: TOKEN, plataforma: 'android', versaoApp: '1.4.0',
        });
    });

    it('DISP-POST-02 plataforma padrão é android', async () => {
        await registrar({ tokenFcm: TOKEN });

        expect(npaasFalso.registrarDispositivo.mock.calls[0][1].plataforma).toBe('android');
    });

    it('DISP-POST-03 NPaaS fora do ar não derruba a requisição: 200 com registrado false', async () => {
        npaasFalso.registrarDispositivo.mockResolvedValue(false);

        const r = await registrar({ tokenFcm: TOKEN });

        expect(r.status).toBe(200);
        expect(r.body.data.registrado).toBe(false);
    });

    it('DISP-POST-04 NPaaS não configurado: 200 com pushAtivo false', async () => {
        npaasFalso.ativo = false;
        npaasFalso.registrarDispositivo.mockResolvedValue(false);

        const r = await registrar({ tokenFcm: TOKEN });

        expect(r.status).toBe(200);
        expect(r.body.data).toEqual({ registrado: false, pushAtivo: false });
    });

    it('DISP-POST-05 sem token, token curto, plataforma inválida ou campo extra → 400', async () => {
        expect((await registrar({})).status).toBe(400);
        expect((await registrar({ tokenFcm: 'x' })).status).toBe(400);
        expect((await registrar({ tokenFcm: TOKEN, plataforma: 'windows' })).status).toBe(400);
        expect((await registrar({ tokenFcm: TOKEN, usuarioId: 'outro' })).status).toBe(400);
        expect(npaasFalso.registrarDispositivo).not.toHaveBeenCalled();
    });

    it('DISP-POST-06 sem autenticação → 401', async () => {
        expect((await api().post('/v1/dispositivos/registrar').send({ tokenFcm: TOKEN })).status).toBe(401);
        expect((await api().post('/v1/dispositivos/desativar-token').send({ tokenFcm: TOKEN })).status).toBe(401);
    });

    it('DISP-DESAT-01 desativa o token no NPaaS', async () => {
        const r = await desativar({ tokenFcm: TOKEN });

        expect(r.status).toBe(200);
        expect(r.body.data.desativado).toBe(true);
        expect(npaasFalso.desativarToken).toHaveBeenCalledWith(TOKEN);
    });

    it('DISP-DESAT-02 falha do NPaaS responde 200 com desativado false; corpo inválido → 400', async () => {
        npaasFalso.desativarToken.mockResolvedValue(false);

        const r = await desativar({ tokenFcm: TOKEN });
        expect(r.status).toBe(200);
        expect(r.body.data.desativado).toBe(false);

        expect((await desativar({})).status).toBe(400);
    });
});
