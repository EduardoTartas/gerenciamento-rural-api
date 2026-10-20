import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import {
    criarInsumo,
    criarPasto,
    criarPropriedade,
    criarRebanho,
    criarTipoInsumo,
    criarTipoManejoPasto,
} from '../../apoio/fabricas.js';

describe('GET /v1/usuarios/:id/exportacao', () => {
    const exportar = (usuario, id) => api().get(`/v1/usuarios/${id}/exportacao`).set('Authorization', usuario.bearer);

    it('USR-EXPORT-01 titular exporta os próprios dados', async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const tipoInsumo = await criarTipoInsumo();
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });

        const r = await exportar(a, a.id);
        expect(r.status).toBe(200);
        expect(r.body.errors).toEqual([]);
        expect(r.body.message).toBe('Dados da conta exportados com sucesso.');
        expect(r.body.data.exportadoEm).toEqual(expect.any(String));
        expect(r.body.data.titular).toMatchObject({ id: a.id, email: a.email });
        expect(r.body.data.propriedades).toHaveLength(1);
        const [exportada] = r.body.data.propriedades;
        expect(exportada.id).toBe(propriedade.id);
        expect(exportada.pastos.map((p) => p.id)).toEqual([pasto.id]);
        expect(exportada.rebanhos.map((x) => x.id)).toEqual([rebanho.id]);
        expect(exportada.insumos.map((x) => x.id)).toEqual([insumo.id]);
    });

    it('USR-EXPORT-02 exportação inclui registros com exclusão lógica e as fotos das atividades', async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const pastoInativo = await criarPasto(propriedade.id, { ativo: false });
        const tipo = await criarTipoManejoPasto();
        const manejo = await DbConnect.prisma.manejoPasto.create({
            data: { pastoId: pastoInativo.id, tipoManejoId: tipo.id, dataAtividade: new Date() },
        });
        await DbConnect.prisma.fotoAtividade.create({
            data: { manejoPastoId: manejo.id, url: 'https://bucket.exemplo/atividades/x.jpeg', ativo: false },
        });

        const r = await exportar(a, a.id);
        expect(r.status).toBe(200);
        const [exportada] = r.body.data.propriedades;
        expect(exportada.pastos[0]).toMatchObject({ id: pastoInativo.id, ativo: false });
        expect(exportada.pastos[0].manejosPasto[0].fotos[0].url).toBe('https://bucket.exemplo/atividades/x.jpeg');
    });

    it('USR-EXPORT-03 exportação não traz dados de outro usuário', async () => {
        const a = await criarUsuario();
        const b = await criarUsuario();
        await criarPropriedade(b.id);

        const r = await exportar(a, a.id);
        expect(r.status).toBe(200);
        expect(r.body.data.propriedades).toEqual([]);
    });

    it('USR-EXPORT-04 exportação não vaza senha, tokens nem sessões', async () => {
        const a = await criarUsuario();
        const r = await exportar(a, a.id);
        expect(r.status).toBe(200);

        const texto = JSON.stringify(r.body.data);
        expect(texto).not.toMatch(/password|accessToken|refreshToken|idToken|"token"/);
        expect(r.body.data.titular.accounts[0]).toEqual({
            providerId: expect.any(String),
            createdAt: expect.any(String),
        });
    });

    it('USR-EXPORT-05 usuário comum tenta exportar dados de outro usuário', async () => {
        const a = await criarUsuario();
        const b = await criarUsuario();
        const r = await exportar(a, b.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Você não tem permissão para exportar os dados de outro usuário.');
    });

    it('USR-EXPORT-06 admin também não exporta dados de outro usuário', async () => {
        const admin = await criarUsuario({ admin: true });
        const a = await criarUsuario();
        const r = await exportar(admin, a.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
    });

    it('USR-EXPORT-07 ID em formato inválido', async () => {
        const a = await criarUsuario();
        const r = await exportar(a, 'abc');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-EXPORT-08 ID válido mas inexistente', async () => {
        const a = await criarUsuario();
        const r = await exportar(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('USR-EXPORT-09 401 sem token', async () => {
        const a = await criarUsuario();
        const r = await api().get(`/v1/usuarios/${a.id}/exportacao`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
