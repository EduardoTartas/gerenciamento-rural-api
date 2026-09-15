import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Os mesmos casos rodam em Dart no aplicativo. Divergiu entre os dois lados, um
 * dos runners quebra.
 */
describe('casos de regra compartilhados', () => {
    let casos;

    beforeAll(async () => {
        casos = JSON.parse(await readFile('contrato/casos_de_regra.json', 'utf8'));
    });

    it('o arquivo declara os oito conjuntos de regra', () => {
        expect(Object.keys(casos).sort()).toEqual([
            'desfazerMovimentacao',
            'formatoLocalizacao',
            'lotacaoConjunta',
            'nomeUnicoPasto',
            'nomeUnicoRebanho',
            'pastoComRebanhoNaoExclui',
            'propriedadeInativaNaoRecebePasto',
            'rebanhoInativoNaoRecebeManejo',
        ]);
    });

    it('todo caso tem descrição, entrada e veredito', () => {
        for (const [regra, lista] of Object.entries(casos)) {
            for (const caso of lista) {
                expect(caso.descricao, `${regra}: falta descrição`).toBeTruthy();
                expect(caso.entrada, `${regra}: falta entrada`).toBeDefined();
                expect(['aceita', 'recusa']).toContain(caso.esperado);
            }
        }
    });

    describe('formato da localização', () => {
        // Mesma expressão de PropriedadeSchema.js. Se ela mudar lá sem mudar
        // aqui, este teste acusa.
        const PADRAO = /^[A-Za-zÀ-ÿ\s'-]{2,100},\s?[A-Za-z]{2}$/;

        it('cada caso produz o veredito esperado', async () => {
            for (const caso of casos.formatoLocalizacao) {
                const valor = caso.entrada.localizacao;
                const aceita = valor === '' ? true : PADRAO.test(valor);
                expect(aceita ? 'aceita' : 'recusa', caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('nome único de pasto', () => {
        // Espelha `PastoRepository.findByNome`: mesma propriedade, ignorando
        // caixa, considerando só os ativos.
        function jaExiste({ existentes, entrada }) {
            return existentes.some(
                (e) =>
                    e.ativo &&
                    e.propriedadeId === entrada.propriedadeId &&
                    e.nome.toLowerCase() === entrada.nome.toLowerCase(),
            );
        }

        it('cada caso produz o veredito esperado', () => {
            for (const caso of casos.nomeUnicoPasto) {
                const veredito = jaExiste(caso) ? 'recusa' : 'aceita';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('desfazer movimentação', () => {
        it('só a última é aceita', () => {
            for (const caso of casos.desfazerMovimentacao) {
                const ultima = caso.existentes.reduce((a, b) => (a.ordem > b.ordem ? a : b));
                const veredito = ultima.id === caso.entrada.id ? 'aceita' : 'recusa';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('nome único de rebanho', () => {
        // Espelha `RebanhoRepository.findByNome`: mesma propriedade, ignorando
        // caixa, considerando só os ativos.
        function jaExiste({ existentes, entrada }) {
            return existentes.some(
                (e) =>
                    e.ativo &&
                    e.propriedadeId === entrada.propriedadeId &&
                    e.nomeRebanho.toLowerCase() === entrada.nomeRebanho.toLowerCase(),
            );
        }

        it('cada caso produz o veredito esperado', () => {
            for (const caso of casos.nomeUnicoRebanho) {
                expect(jaExiste(caso) ? 'recusa' : 'aceita', caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('entidade inativa não recebe filho', () => {
        it('propriedade inativa recusa pasto', () => {
            for (const caso of casos.propriedadeInativaNaoRecebePasto) {
                const pai = caso.existentes.find((e) => e.id === caso.entrada.propriedadeId);
                const veredito = pai && pai.ativo ? 'aceita' : 'recusa';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });

        it('rebanho inativo recusa manejo', () => {
            for (const caso of casos.rebanhoInativoNaoRecebeManejo) {
                const pai = caso.existentes.find((e) => e.id === caso.entrada.rebanhoId);
                const veredito = pai && pai.ativo ? 'aceita' : 'recusa';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('integridade do pasto', () => {
        // Conta rebanhos ativos no pasto. Nunca lê `pasto.status` — o campo é
        // cache e já esteve comprovadamente defasado.
        function ocupantes({ existentes, entrada }) {
            return existentes.filter(
                (r) => r.ativo && r.pastoAtualId === entrada.pastoId,
            ).length;
        }

        it('pasto com rebanho ativo não pode ser excluído', () => {
            for (const caso of casos.pastoComRebanhoNaoExclui) {
                const veredito = ocupantes(caso) > 0 ? 'recusa' : 'aceita';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });

        it('lotação conjunta exige confirmação explícita', () => {
            for (const caso of casos.lotacaoConjunta) {
                const precisaConfirmar = ocupantes(caso) > 0;
                const veredito =
                    !precisaConfirmar || caso.entrada.confirmouLotacaoConjunta
                        ? 'aceita'
                        : 'recusa';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });
    });
});
