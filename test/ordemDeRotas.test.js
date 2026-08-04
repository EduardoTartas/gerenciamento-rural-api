import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const INDEX_DE_ROTAS = fileURLToPath(
    new URL('../src/routes/index.js', import.meta.url),
);

/**
 * `/pastagens/:id` e `/rebanhos/:id` casam com qualquer segmento, inclusive
 * `manejos` e `movimentacoes`. Quem for registrado primeiro vence.
 *
 * `pastoRoutes` vinha antes de `manejoPastoRoutes`, e o resultado era que
 * **toda** listagem de manejo de pasto — inclusive a leitura por diferença —
 * respondia 400 "ID de pastagem inválido. Deve ser um UUID válido.", porque o
 * `PastoController` recebia `id = 'manejos'`. O endpoint estava morto e nenhum
 * teste percebia, porque a suíte não exercita o roteamento.
 *
 * A verificação é sobre o texto do registro por um motivo: o defeito é a ORDEM
 * das linhas em `app.use('/v1', ...)`. Montar os mesmos routers numa ordem
 * escolhida pelo teste só provaria que o teste sabe a ordem certa.
 */
describe('ordem de registro das rotas', () => {
    const fonte = readFileSync(INDEX_DE_ROTAS, 'utf8');

    const registro = fonte.slice(
        fonte.indexOf("app.use('/v1'"),
        fonte.indexOf(');', fonte.indexOf("app.use('/v1'")),
    );

    const posicao = (nome) => registro.indexOf(nome);

    it('o bloco de registro foi encontrado (a busca ainda funciona)', () => {
        expect(registro).toContain('pastoRoutes');
        expect(registro).toContain('rebanhoRoutes');
    });

    it('rotas de manejo de pasto vêm antes de /pastagens/:id', () => {
        expect(posicao('manejoPastoRoutes')).toBeLessThan(posicao('pastoRoutes'));
    });

    it('rotas de manejo e movimentação de rebanho vêm antes de /rebanhos/:id', () => {
        expect(posicao('manejoRebanhoRoutes')).toBeLessThan(posicao('rebanhoRoutes'));
        expect(posicao('movimentacaoRoutes')).toBeLessThan(posicao('rebanhoRoutes'));
    });
});
