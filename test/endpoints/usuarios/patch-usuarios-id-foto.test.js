import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { userRepository } from '../../../src/repository/index.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

// Mock do Garage/MinIO — a suíte não sobe storage real. Mantém `ensureGarageEnv`
// (chamado no boot da API) e troca só o client (default export) por um dublê
// com `putObject`/`removeObject` espiáveis, conforme uploads.md. `vi.mock` é
// hoisted para o topo do arquivo, então as variáveis usadas na factory
// precisam vir de `vi.hoisted`.
const { removeObject, putObject } = vi.hoisted(() => ({
    removeObject: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/config/garageConnect.js', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        default: vi.fn().mockResolvedValue({ removeObject, putObject }),
    };
});

describe('PATCH /v1/usuarios/:id/foto', () => {
    const BUCKET_URL = process.env.GARAGE_PUBLIC_URL.replace(/\/$/, '');
    let a;

    beforeEach(async () => {
        a = await criarUsuario();
        removeObject.mockClear();
        removeObject.mockResolvedValue(undefined);
        putObject.mockClear();
    });

    const urlSintetica = () => `${BUCKET_URL}/${randomUUID()}.jpeg`;

    const patchFoto = (usuario, id, corpo) =>
        api().patch(`/v1/usuarios/${id}/foto`).set('Authorization', usuario.bearer).send(corpo);

    it('USR-PATCH-FOTO-01 usuário registra a própria foto', async () => {
        const url = urlSintetica();
        const r = await patchFoto(a, a.id, { url });
        expect(r.status).toBe(200);
        expect(r.body.data.image).toBe(url);
        expect(r.body.message).toBe('Foto de perfil atualizada com sucesso.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo.image).toBe(url);
    });

    it('USR-PATCH-FOTO-02 substituição descarta avatar antigo em segundo plano', async () => {
        const antiga = urlSintetica();
        await patchFoto(a, a.id, { url: antiga });
        const nova = urlSintetica();
        const r = await patchFoto(a, a.id, { url: nova });
        expect(r.status).toBe(200);
        expect(r.body.data.image).toBe(nova);
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(removeObject).toHaveBeenCalledTimes(1);
        expect(removeObject.mock.calls[0][1]).toBe(antiga.split('/').pop());
    });

    it('USR-PATCH-FOTO-03 primeira foto (sem avatar anterior) não tenta descartar nada', async () => {
        const url = urlSintetica();
        const r = await patchFoto(a, a.id, { url });
        expect(r.status).toBe(200);
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(removeObject).not.toHaveBeenCalled();
    });

    it('USR-PATCH-FOTO-04 corpo vazio / sem url', async () => {
        const r = await patchFoto(a, a.id, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('url');
    });

    it('USR-PATCH-FOTO-05 url em formato inválido', async () => {
        const r = await patchFoto(a, a.id, { url: 'não-é-url' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A URL da imagem é inválida.');
    });

    it('USR-PATCH-FOTO-06 campo extra no corpo (.strict())', async () => {
        const r = await patchFoto(a, a.id, { url: urlSintetica(), nome: 'x' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-PATCH-FOTO-07 URL fora do bucket configurado', async () => {
        const r = await patchFoto(a, a.id, { url: 'https://evil.example.com/foto.jpg' });
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('A URL informada não corresponde a uma imagem enviada pelo sistema.');
        expect(putObject).not.toHaveBeenCalled();
        expect(removeObject).not.toHaveBeenCalled();
    });

    it('USR-PATCH-FOTO-08 rollback: falha ao gravar no banco desfaz o upload', async () => {
        const nova = urlSintetica();
        const spy = vi.spyOn(userRepository, 'update').mockRejectedValueOnce(new Error('falha simulada de banco'));
        const r = await patchFoto(a, a.id, { url: nova });
        expect(r.status).toBe(500);
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        expect(removeObject).toHaveBeenCalledTimes(1);
        expect(removeObject.mock.calls[0][1]).toBe(nova.split('/').pop());
        spy.mockRestore();
    });

    it('USR-PATCH-FOTO-09 rollback que também falha não derruba a requisição', async () => {
        const nova = urlSintetica();
        const spy = vi.spyOn(userRepository, 'update').mockRejectedValueOnce(new Error('falha simulada de banco'));
        removeObject.mockRejectedValueOnce(new Error('garage indisponível'));
        const r = await patchFoto(a, a.id, { url: nova });
        expect(r.status).toBe(500);
        spy.mockRestore();
    });

    it('USR-PATCH-FOTO-10 usuário comum tenta registrar foto de outro usuário', async () => {
        const b = await criarUsuario();
        const r = await patchFoto(a, b.id, { url: urlSintetica() });
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Você não tem permissão para atualizar a foto de outro usuário.');
        expect(putObject).not.toHaveBeenCalled();
        expect(removeObject).not.toHaveBeenCalled();
    });

    it('USR-PATCH-FOTO-11 admin tenta registrar foto de outro usuário (sem bypass)', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await patchFoto(admin, a.id, { url: urlSintetica() });
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
    });

    it('USR-PATCH-FOTO-12 ID em formato inválido', async () => {
        const r = await api()
            .patch('/v1/usuarios/abc/foto')
            .set('Authorization', a.bearer)
            .send({ url: urlSintetica() });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-PATCH-FOTO-13 UUID válido mas inexistente', async () => {
        const r = await patchFoto(a, randomUUID(), { url: urlSintetica() });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('USR-PATCH-FOTO-14 401 sem token', async () => {
        const r = await api().patch(`/v1/usuarios/${a.id}/foto`).send({ url: urlSintetica() });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
