import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('POST /v1/pastagens', () => {
    let a;
    let propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const post = (usuario, corpo) =>
        api().post('/v1/pastagens').set('Authorization', usuario.bearer).send(corpo);

    it('PAST-POST-01 cria com propriedadeId e nome (campos opcionais ausentes)', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete 1' });
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.status).toBe('Vazio');
        expect(r.body.data.ativo).toBe(true);
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: r.body.data.id } });
        expect(salvo.propriedadeId).toBe(propriedade.id);
    });

    it('PAST-POST-02 cria com extensaoHa, tipoPastagem e status explícitos', async () => {
        const r = await post(a, {
            propriedadeId: propriedade.id,
            nome: 'Piquete 2',
            extensaoHa: 5.5,
            tipoPastagem: 'Braquiária',
            status: 'Ocupado',
        });
        expect(r.status).toBe(201);
        expect(r.body.data.extensaoHa).toBe('5.5');
        expect(r.body.data.tipoPastagem).toBe('Braquiária');
        expect(r.body.data.status).toBe('Ocupado');
    });

    it('PAST-POST-03 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, { id, propriedadeId: propriedade.id, nome: 'Piquete Offline' });
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('PAST-POST-04 corpo vazio ({})', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
        expect(r.body.message).toBe('Forneça os dados da pastagem.');
    });

    it('PAST-POST-05 sem propriedadeId (obrigatório)', async () => {
        const r = await post(a, { nome: 'Piquete Sem Propriedade' });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'propriedadeId')).toBe(true);
    });

    it('PAST-POST-06 sem nome (obrigatório)', async () => {
        const r = await post(a, { propriedadeId: propriedade.id });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'nome')).toBe(true);
    });

    it('PAST-POST-07 campo extra no corpo (.strict())', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete', extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.message.includes('Unrecognized key'))).toBe(true);
    });

    it('PAST-POST-08 status fora do enum (Ocupado/Vazio/Descanso)', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete', status: 'Invalido' });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'status')).toBe(true);
    });

    it('PAST-POST-09 extensaoHa negativo ou zero', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete', extensaoHa: 0 });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'extensaoHa')).toBe(true);
    });

    it('PAST-POST-10 propriedadeId não é UUID válido', async () => {
        const r = await post(a, { propriedadeId: 'nao-uuid', nome: 'Piquete' });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'propriedadeId')).toBe(true);
    });

    it('PAST-POST-11 propriedadeId inexistente', async () => {
        const r = await post(a, { propriedadeId: randomUUID(), nome: 'Piquete' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Propriedade não encontrada ou não pertence ao usuário autenticado.');
    });

    it('PAST-POST-12 multi-tenancy: B tenta criar pasto em propriedade de A', async () => {
        const b = await criarUsuario();
        const r = await post(b, { propriedadeId: propriedade.id, nome: 'Piquete Invasor' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Propriedade não encontrada ou não pertence ao usuário autenticado.');
    });

    it('PAST-POST-13 propriedadeId aponta para propriedade inativa', async () => {
        const inativa = await criarPropriedade(a.id, { ativo: false });
        const r = await post(a, { propriedadeId: inativa.id, nome: 'Piquete' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('propriedadeId');
        expect(r.body.message).toBe('Propriedade está inativa.');
    });

    it('PAST-POST-14 nome duplicado: já existe pasto ativo com o mesmo nome na propriedade', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete 1' });
        const r = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete 1' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('PAST-POST-15 mesmo nome de pasto inativo (arquivado) na mesma propriedade — reciclagem permitida', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete 1', ativo: false });
        const r = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete 1' });
        expect(r.status).toBe(201);
    });

    it('PAST-POST-16 mesmo nome em propriedades diferentes do mesmo usuário', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const r1 = await post(a, { propriedadeId: propriedade.id, nome: 'Piquete Comum' });
        const r2 = await post(a, { propriedadeId: outraPropriedade.id, nome: 'Piquete Comum' });
        expect(r1.status).toBe(201);
        expect(r2.status).toBe(201);
    });

    it('PAST-POST-17 sem token', async () => {
        const r = await api().post('/v1/pastagens').send({ propriedadeId: propriedade.id, nome: 'Piquete' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
