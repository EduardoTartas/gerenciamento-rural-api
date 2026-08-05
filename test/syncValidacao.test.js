import { describe, expect, it } from 'vitest';
import { DESPACHO } from '../src/service/sync/despacho.js';
import {
    SCHEMAS_DE_MUTACAO,
    validarDadosDaMutacao,
} from '../src/service/sync/validacao.js';

const UUID = '11111111-1111-4111-8111-111111111111';
const OUTRO_UUID = '22222222-2222-4222-8222-222222222222';

/**
 * O lote entrava sem passar pela portaria. `dados` era `z.record()` — nome
 * bonito para "qualquer coisa" — e seguia verbatim até o Prisma, enquanto o
 * REST parava o mesmo corpo com 400 num schema `.strict()`.
 */
describe('validação dos dados da mutação', () => {
    it('cobre toda ação com corpo que o despacho aceita', () => {
        // Acrescentar entidade em `despacho.js` sem acrescentar o schema aqui
        // reabriria o buraco só para ela. O teste liga as duas tabelas.
        const comCorpo = Object.keys(DESPACHO).filter((par) => !par.endsWith(':DELETE'));

        expect(comCorpo.sort()).toEqual(Object.keys(SCHEMAS_DE_MUTACAO).sort());
    });

    it('recusa campo que reparenta o registro para outro dono', () => {
        const resultado = validarDadosDaMutacao({
            entidade: 'pastos',
            acao: 'UPDATE',
            dados: { nome: 'Piquete Norte', propriedadeId: OUTRO_UUID },
        });

        expect(resultado.ok).toBe(false);
        expect(resultado.erro.errorType).toBe('validationError');
        expect(resultado.erro.field).toBe('propriedadeId');
    });

    it('explica o campo recusado em português', () => {
        // A mensagem do Zod para chave desconhecida vem em inglês. Ela chega na
        // tela do celular do produtor, então não pode passar crua.
        const { erro } = validarDadosDaMutacao({
            entidade: 'pastos',
            acao: 'UPDATE',
            dados: { propriedadeId: OUTRO_UUID },
        });

        expect(erro.customMessage).toBe('Campo não aceito em pastos: propriedadeId.');
        expect(erro.customMessage).not.toMatch(/Unrecognized|key\(s\)/i);
    });

    it('devolve o dado coagido, igual ao REST', () => {
        const resultado = validarDadosDaMutacao({
            entidade: 'manejo_pastos',
            acao: 'CREATE',
            dados: {
                pastoId: UUID,
                tipoManejoId: UUID,
                dataAtividade: '2026-08-01T12:00:00.000Z',
            },
        });

        expect(resultado.ok).toBe(true);
        expect(resultado.dados.dataAtividade).toBeInstanceOf(Date);
    });

    it('deixa passar o que o schema aceita, sem inventar recusa', () => {
        const resultado = validarDadosDaMutacao({
            entidade: 'propriedades',
            acao: 'CREATE',
            dados: { nome: 'Fazenda Santa Rita', localizacao: 'vilhena,ro' },
        });

        expect(resultado.ok).toBe(true);
        // A transformação de `localizacao` também vem junto — é a mesma do REST.
        expect(resultado.dados.localizacao).toBe('Vilhena,RO');
    });

    it('não valida DELETE, que não tem corpo', () => {
        const resultado = validarDadosDaMutacao({
            entidade: 'pastos',
            acao: 'DELETE',
            dados: undefined,
        });

        expect(resultado.ok).toBe(true);
    });

    it('nunca lança: recusa é sempre valor de retorno', () => {
        // Um throw aqui abortaria o lote inteiro por causa de um item ruim,
        // exatamente o que a aplicação por item existe para evitar.
        expect(() =>
            validarDadosDaMutacao({ entidade: 'pastos', acao: 'CREATE', dados: null }),
        ).not.toThrow();

        expect(
            validarDadosDaMutacao({ entidade: 'pastos', acao: 'CREATE', dados: null }).ok,
        ).toBe(false);
    });

    it('entidade desconhecida não é validada aqui — quem recusa é o despacho', () => {
        const resultado = validarDadosDaMutacao({
            entidade: 'coisas',
            acao: 'CREATE',
            dados: { qualquer: 1 },
        });

        expect(resultado.ok).toBe(true);
    });
});
