import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import {
    criarPropriedade, criarPasto, criarRebanho, criarTipoManejoRebanho, criarTipoManejoPasto,
} from '../../apoio/fabricas.js';
import { criarManejoPasto, criarManejoRebanho } from './apoio-local.js';

describe('POST /v1/sync — validação por entidade (schema do REST reaproveitado)', () => {
    let a, propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    it('SYNC-POST-27 pastos:UPDATE com propriedadeId no corpo é recusado', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId: pasto.id,
            dados: { propriedadeId: outraPropriedade.id },
        };
        const r = await sync(a, [m]);
        expect(r.status).toBe(200);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.campo).toBe('propriedadeId');
        expect(res.erro.recuperavel).toBe(false);
        expect(res.erro.mensagem).toBe('Campo não aceito em pastos: propriedadeId.');

        const pastoAtual = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(pastoAtual.propriedadeId).toBe(propriedade.id);
    });

    it('SYNC-POST-28 rebanhos:UPDATE com propriedadeId é recusado', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const outraPropriedade = await criarPropriedade(a.id);
        const m = {
            id: randomUUID(), entidade: 'rebanhos', acao: 'UPDATE', entidadeId: rebanho.id,
            dados: { propriedadeId: outraPropriedade.id },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.campo).toBe('propriedadeId');
        expect(res.erro.mensagem).toBe('Campo não aceito em rebanhos: propriedadeId.');

        const rebanhoAtual = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(rebanhoAtual.propriedadeId).toBe(propriedade.id);
    });

    it('SYNC-POST-29 manejo_pastos:UPDATE com pastoId é recusado', async () => {
        const pasto = await criarPasto(propriedade.id);
        const tipoManejo = await criarTipoManejoPasto();
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const outroPasto = await criarPasto(propriedade.id);
        const m = {
            id: randomUUID(), entidade: 'manejo_pastos', acao: 'UPDATE', entidadeId: manejo.id,
            dados: { pastoId: outroPasto.id },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.campo).toBe('pastoId');
        expect(res.erro.mensagem).toBe('Campo não aceito em manejo_pastos: pastoId.');
    });

    it('SYNC-POST-30 manejo_rebanhos:UPDATE com rebanhoId é recusado', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const tipoManejo = await criarTipoManejoRebanho();
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const outroRebanho = await criarRebanho(propriedade.id, pasto.id);
        const m = {
            id: randomUUID(), entidade: 'manejo_rebanhos', acao: 'UPDATE', entidadeId: manejo.id,
            dados: { rebanhoId: outroRebanho.id },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.campo).toBe('rebanhoId');
        expect(res.erro.mensagem).toBe('Campo não aceito em manejo_rebanhos: rebanhoId.');
    });

    it('SYNC-POST-31 campo desconhecido gera mensagem em português, sem termos do Zod', async () => {
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Piquete', campoInventado: 1 },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.mensagem).toBe('Campo não aceito em pastos: campoInventado.');
        expect(res.erro.mensagem).not.toContain('Unrecognized');
        expect(res.erro.mensagem).not.toContain('key(s)');
    });

    it('SYNC-POST-32 dado é coagido igual ao REST (string ISO → Date)', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const tipoManejo = await criarTipoManejoRebanho();
        const entidadeId = randomUUID();
        const m = {
            id: randomUUID(), entidade: 'manejo_rebanhos', acao: 'CREATE', entidadeId,
            dados: { rebanhoId: rebanho.id, tipoManejoId: tipoManejo.id, dataAtividade: '2026-01-01T00:00:00.000Z' },
        };
        const r = await sync(a, [m]);
        expect(r.body.data.resultados[0].situacao).toBe('aceito');

        const salvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: entidadeId } });
        expect(salvo.dataAtividade).toBeInstanceOf(Date);
        expect(salvo.dataAtividade.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('SYNC-POST-33 corpo inválido recusa só o item, não o lote', async () => {
        const invalida = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { nome: 'Sem Propriedade' },
        };
        const valida = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Com Propriedade' },
        };
        const r = await sync(a, [invalida, valida]);
        expect(r.status).toBe(200);
        const resInvalida = r.body.data.resultados.find((x) => x.id === invalida.id);
        const resValida = r.body.data.resultados.find((x) => x.id === valida.id);
        expect(resInvalida.situacao).toBe('recusado');
        expect(resInvalida.erro.tipo).toBe('validationError');
        expect(resValida.situacao).toBe('aceito');

        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: valida.entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-34 DELETE não exige dados e não passa por validação de schema', async () => {
        const pasto = await criarPasto(propriedade.id);
        const m = { id: randomUUID(), entidade: 'pastos', acao: 'DELETE', entidadeId: pasto.id };
        const r = await sync(a, [m]);
        expect(r.body.data.resultados[0].situacao).toBe('aceito');

        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-35 combinação entidade:acao não suportada', async () => {
        const m = { id: randomUUID(), entidade: 'coisas', acao: 'CREATE', entidadeId: randomUUID(), dados: {} };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.mensagem).toBe('Combinação não suportada: coisas com ação CREATE.');
    });

    it('SYNC-POST-36 historico_movimentacoes:UPDATE não é suportado', async () => {
        const m = {
            id: randomUUID(), entidade: 'historico_movimentacoes', acao: 'UPDATE', entidadeId: randomUUID(),
            dados: {},
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.mensagem).toBe('Combinação não suportada: historico_movimentacoes com ação UPDATE.');
    });

    it('SYNC-POST-37 movimentacoes_insumo:UPDATE não é suportado', async () => {
        const m = {
            id: randomUUID(), entidade: 'movimentacoes_insumo', acao: 'UPDATE', entidadeId: randomUUID(),
            dados: {},
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
        expect(res.erro.mensagem).toBe('Combinação não suportada: movimentacoes_insumo com ação UPDATE.');
    });
});
