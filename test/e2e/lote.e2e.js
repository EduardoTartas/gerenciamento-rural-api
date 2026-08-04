// test/e2e/lote.e2e.js
//
// Executado contra a API real em Docker, com Postgres real. Prova o caminho
// completo: rota, middleware de autenticação, service, transação e Prisma.
//
//   npm run dev            # noutro terminal
//   npm run test:e2e
//
// Usa `fetch` do Node 22, sem dependência extra — mesma abordagem das 37
// asserções do fluxo de rebanho.

import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:6060/v1';
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;

assert.ok(EMAIL && SENHA, 'Defina E2E_EMAIL e E2E_SENHA no ambiente.');

let passou = 0;
let falhou = 0;

function verificar(descricao, condicao) {
    if (condicao) {
        passou++;
        console.log(`  ok   ${descricao}`);
    } else {
        falhou++;
        console.error(`  FALHOU ${descricao}`);
    }
}

async function entrar() {
    const origem = BASE.replace('/v1', '');
    const r = await fetch(`${origem}/api/auth/sign-in/email`, {
        method: 'POST',
        // O fetch nativo do Node envia `Sec-Fetch-Mode: cors` por padrão, o que
        // aciona a proteção CSRF do BetterAuth e passa a exigir um Origin válido
        // (curl e o app mobile não enviam esse cabeçalho e não precisam disso).
        headers: { 'Content-Type': 'application/json', Origin: origem },
        body: JSON.stringify({ email: EMAIL, password: SENHA }),
    });
    const corpo = await r.json();
    assert.ok(corpo.token, 'Login falhou: token ausente.');
    return corpo.token;
}

async function enviarLote(token, mutacoes) {
    const r = await fetch(`${BASE}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mutacoes }),
    });
    return { status: r.status, corpo: await r.json() };
}

const token = await entrar();

// ── 1. Lote misto: um pasto válido, um duplicado, e um rebanho dependente ────
const propriedadeId = process.env.E2E_PROPRIEDADE_ID;
assert.ok(propriedadeId, 'Defina E2E_PROPRIEDADE_ID no ambiente.');

const nomeUnico = `QA ${Date.now()}`;
const mutPastoOk = randomUUID();
const mutPastoDup = randomUUID();
const mutRebanho = randomUUID();
const idPastoOk = randomUUID();
const idPastoDup = randomUUID();
const idRebanho = randomUUID();

console.log('\n1. lote misto');
const primeiro = await enviarLote(token, [
    { id: mutPastoOk, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoOk,
      dados: { propriedadeId, nome: nomeUnico, extensaoHa: 5 } },
    { id: mutPastoDup, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoDup,
      dados: { propriedadeId, nome: nomeUnico, extensaoHa: 5 } },
    { id: mutRebanho, entidade: 'rebanhos', acao: 'CREATE', entidadeId: idRebanho,
      dependeDe: mutPastoDup,
      dados: { propriedadeId, pastoAtualId: idPastoDup, nomeRebanho: `Lote ${Date.now()}` } },
]);

verificar('responde 200 mesmo com recusa', primeiro.status === 200);

const porId = Object.fromEntries(
    primeiro.corpo.data.resultados.map((r) => [r.id, r]),
);
verificar('o primeiro pasto entra', porId[mutPastoOk]?.situacao === 'aceito');
verificar('o duplicado é recusado', porId[mutPastoDup]?.situacao === 'recusado');
verificar('a recusa vem com tipo conflict', porId[mutPastoDup]?.erro?.tipo === 'conflict');
verificar('a recusa não é recuperável', porId[mutPastoDup]?.erro?.recuperavel === false);
verificar('o dependente é bloqueado', porId[mutRebanho]?.situacao === 'bloqueado');
verificar('o bloqueio aponta a causa', porId[mutRebanho]?.bloqueadoPor === mutPastoDup);

// ── 2. Reenvio: idempotência ─────────────────────────────────────────────────
console.log('\n2. reenvio do mesmo lote');
const segundo = await enviarLote(token, [
    { id: mutPastoOk, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoOk,
      dados: { propriedadeId, nome: nomeUnico, extensaoHa: 5 } },
]);
const reenviado = segundo.corpo.data.resultados[0];
verificar('o reenvio devolve aceito sem duplicar', reenviado.situacao === 'aceito');
verificar('o id da entidade é o mesmo', reenviado.entidadeId === idPastoOk);

// ── 3. Delta ─────────────────────────────────────────────────────────────────
console.log('\n3. leitura por diferença');
const agora = new Date(Date.now() - 60_000).toISOString();
const delta = await fetch(
    `${BASE}/pastagens?propriedadeId=${propriedadeId}&atualizadoDesde=${agora}`,
    { headers: { Authorization: `Bearer ${token}` } },
);
const corpoDelta = await delta.json();
verificar('o delta responde 200', delta.status === 200);
verificar(
    'o pasto recém-criado aparece na janela',
    corpoDelta.data.docs.some((p) => p.id === idPastoOk),
);

// ── 4. Envelope inválido ─────────────────────────────────────────────────────
console.log('\n4. envelope inválido');
const ciclo = await enviarLote(token, [
    { id: mutPastoOk, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoOk,
      dependeDe: mutPastoDup, dados: { propriedadeId, nome: 'A' } },
    { id: mutPastoDup, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoDup,
      dependeDe: mutPastoOk, dados: { propriedadeId, nome: 'B' } },
]);
verificar('ciclo de dependência devolve 400', ciclo.status === 400);

console.log(`\n${passou} asserções passaram, ${falhou} falharam.`);
process.exit(falhou === 0 ? 0 : 1);
