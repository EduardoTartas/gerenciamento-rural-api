// prisma/seeds/historicoMovimentacaoSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';

const OBSERVACOES_MOVIMENTACAO = [
  'Rodízio programado de pastagem.',
  'Transferência para pasto com melhor cobertura vegetal.',
  'Pasto de destino recuperado após período de descanso.',
  'Movimentação emergencial por falta de água no pasto anterior.',
  'Troca para pasto com suplementação mineral disponível.',
  'Reagrupamento de lotes para manejo sanitário.',
  'Movimentação para pasto próximo ao curral para pesagem.',
  'Pasto anterior com sinais de degradação, necessita descanso.',
];

/**
 * Seed de histórico de movimentações entre pastos.
 * Cria N movimentações por rebanho usando pastos da mesma propriedade.
 */
export async function seedHistoricoMovimentacoes(prisma, rebanhos, pastos, quantidadePorRebanho = 2) {
  console.log('🌱 Semeando histórico de movimentações...');

  // Organiza pastos por propriedade
  const pastosPorProp = {};
  for (const p of pastos) {
    if (!pastosPorProp[p.propriedadeId]) pastosPorProp[p.propriedadeId] = [];
    pastosPorProp[p.propriedadeId].push(p);
  }

  let count = 0;

  for (const rebanho of rebanhos) {
    const pastosDisponiveis = pastosPorProp[rebanho.propriedadeId] || [];

    // Precisa de pelo menos 2 pastos para fazer movimentação
    if (pastosDisponiveis.length < 2) continue;

    for (let i = 0; i < quantidadePorRebanho; i++) {
      // Seleciona origem e destino diferentes
      const origem = faker.helpers.arrayElement(pastosDisponiveis);
      let destino;
      do {
        destino = faker.helpers.arrayElement(pastosDisponiveis);
      } while (destino.id === origem.id);

      const dataMovimentacao = faker.date.recent({ days: 90 });
      const observacoes = faker.helpers.arrayElement(OBSERVACOES_MOVIMENTACAO);

      await prisma.historicoMovimentacao.create({
        data: {
          rebanhoId: rebanho.id,
          pastoOrigemId: origem.id,
          pastoDestinoId: destino.id,
          dataMovimentacao,
          observacoes,
        },
      });

      count++;
    }
  }

  console.log(`  ✅ ${count} movimentação(ões) registrada(s)`);
}
