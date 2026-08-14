import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UserService.registrarFoto', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });
    const BUCKET_URL = 'https://pastolivre-bucket.eduardotartas.dpdns.org';
    const originalPublicUrl = process.env.GARAGE_PUBLIC_URL;

    beforeEach(async () => {
        process.env.GARAGE_PUBLIC_URL = BUCKET_URL;
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: UserService } = await import('../../src/service/UserService.js');
        service = new UserService();
        service.uploadService = {
            deletarImagem: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        process.env.GARAGE_PUBLIC_URL = originalPublicUrl;
    });

    it('recusa URL fora do bucket configurado', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'u1', image: null }),
        };

        await expect(
            service.registrarFoto('u1', 'https://evil.example.com/foto.jpg', req('u1')),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'url' });

        expect(service.uploadService.deletarImagem).not.toHaveBeenCalled();
    });

    it('recusa registrar foto de outro usuário', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'u1', image: null }),
        };

        await expect(
            service.registrarFoto('u1', `${BUCKET_URL}/foo.jpeg`, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'forbidden' });
    });

    it('desfaz o upload (rollback) quando o cadastro falha', async () => {
        // Requisito central da feature: se o update falhar, a imagem recém-enviada
        // não pode ficar órfã no bucket.
        const erroDoUpdate = new Error('falha no banco');
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'u1', image: null }),
            update: vi.fn().mockRejectedValue(erroDoUpdate),
        };

        const novaUrl = `${BUCKET_URL}/nova.jpeg`;

        await expect(
            service.registrarFoto('u1', novaUrl, req('u1')),
        ).rejects.toBe(erroDoUpdate);

        expect(service.uploadService.deletarImagem).toHaveBeenCalledWith(novaUrl);
        expect(service.uploadService.deletarImagem).toHaveBeenCalledTimes(1);
    });

    it('não derruba a requisição se o rollback também falhar', async () => {
        const erroDoUpdate = new Error('falha no banco');
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'u1', image: null }),
            update: vi.fn().mockRejectedValue(erroDoUpdate),
        };
        service.uploadService.deletarImagem = vi.fn().mockRejectedValue(new Error('garage fora do ar'));

        const novaUrl = `${BUCKET_URL}/nova.jpeg`;

        await expect(
            service.registrarFoto('u1', novaUrl, req('u1')),
        ).rejects.toBe(erroDoUpdate);
    });

    it('descarta o avatar antigo em background quando o cadastro dá certo', async () => {
        const urlAntiga = `${BUCKET_URL}/antiga.jpeg`;
        const urlNova = `${BUCKET_URL}/nova.jpeg`;
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'u1', image: urlAntiga }),
            update: vi.fn().mockResolvedValue({ id: 'u1', image: urlNova }),
        };

        const resultado = await service.registrarFoto('u1', urlNova, req('u1'));

        expect(resultado).toEqual({ id: 'u1', image: urlNova });
        // dá um tick pro .catch() fire-and-forget rodar
        await new Promise((r) => setTimeout(r, 0));
        expect(service.uploadService.deletarImagem).toHaveBeenCalledWith(urlAntiga);
    });

    it('não tenta descartar avatar antigo quando não havia um (ou é o mesmo)', async () => {
        const urlNova = `${BUCKET_URL}/nova.jpeg`;
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'u1', image: null }),
            update: vi.fn().mockResolvedValue({ id: 'u1', image: urlNova }),
        };

        await service.registrarFoto('u1', urlNova, req('u1'));

        expect(service.uploadService.deletarImagem).not.toHaveBeenCalled();
    });
});
