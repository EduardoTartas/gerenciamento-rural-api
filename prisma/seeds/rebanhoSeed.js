// prisma/seeds/rebanhoSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';

const CATEGORIAS = ['Cria', 'Recria', 'Engorda'];
const RACAS = ['Nelore', 'Angus', 'Anelorado', 'Brahman', 'Hereford', 'Senepol', 'Mestiço', 'Guzerá', 'Tabapuã', 'Gir'];

const NOMES_LOTE = [
  'Lote', 'Rebanho', 'Plantel', 'Tropa',
];

/**
 * Seed de rebanhos (lotes de gado).
 * Cria N rebanhos por propriedade, vinculando aleatoriamente aos pastos.
 */
export async function seedRebanhos(prisma, propriedades, pastos, quantidadePorPropriedade = 2) {
  console.log('🌱 Semeando rebanhos...');

  // Organiza pastos por propriedade
  const pastosPorProp = {};
  for (const p of pastos) {
    if (!pastosPorProp[p.propriedadeId]) pastosPorProp[p.propriedadeId] = [];
    pastosPorProp[p.propriedadeId].push(p);
  }

  const created = [];

  for (const prop of propriedades) {
    const pastosDisponiveis = pastosPorProp[prop.id] || [];

    for (let i = 0; i < quantidadePorPropriedade; i++) {
      const categoria = faker.helpers.arrayElement(CATEGORIAS);
      const raca = faker.helpers.arrayElement(RACAS);
      const tipo = faker.helpers.arrayElement(NOMES_LOTE);
      const nomeRebanho = `${tipo} ${raca} ${categoria}`;

      // Define peso médio baseado na categoria
      let pesoMedio;
      switch (categoria) {
        case 'Cria': pesoMedio = faker.number.float({ min: 120, max: 220, fractionDigits: 1 }); break;
        case 'Recria': pesoMedio = faker.number.float({ min: 220, max: 360, fractionDigits: 1 }); break;
        case 'Engorda': pesoMedio = faker.number.float({ min: 360, max: 550, fractionDigits: 1 }); break;
      }

      const quantidadeCabecas = faker.number.int({ min: 8, max: 80 });

      // 70% de chance de estar em um pasto, 30% sem pasto (curral/confinamento)
      const temPasto = faker.datatype.boolean({ probability: 0.7 }) && pastosDisponiveis.length > 0;
      const pastoAtualId = temPasto
        ? faker.helpers.arrayElement(pastosDisponiveis).id
        : null;
      const dataEntradaPastoAtual = temPasto
        ? faker.date.recent({ days: 60 })
        : null;

      const existing = await prisma.rebanho.findFirst({
        where: { propriedadeId: prop.id, nomeRebanho },
      });

      if (existing) {
        console.log(`  ⏭️  Rebanho "${nomeRebanho}" já existe, pulando...`);
        created.push(existing);
        continue;
      }

      const rebanho = await prisma.rebanho.create({
        data: {
          propriedadeId: prop.id,
          pastoAtualId,
          nomeRebanho,
          quantidadeCabecas,
          categoria,
          raca,
          pesoMedioAtual: pesoMedio,
          dataEntradaPastoAtual,
        },
      });

      console.log(`  ✅ Rebanho "${nomeRebanho}" criado (${quantidadeCabecas} cabeças - ${pesoMedio}kg)`);
      created.push(rebanho);
    }
  }

  return created;
}
