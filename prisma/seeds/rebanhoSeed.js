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
export async function seedRebanhos(prisma, propriedades, pastos, catalogos, quantidadePorPropriedade = 2) {
  console.log('Semeando rebanhos...');

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
      const racaObj = faker.helpers.arrayElement(catalogos.racas);
      const sistemaObj = faker.helpers.arrayElement(catalogos.sistemasProducao);
      const regimeObj = faker.helpers.arrayElement(catalogos.regimesAlimentares);
      
      const tipo = faker.helpers.arrayElement(NOMES_LOTE);
      const nomeRebanho = `${tipo} ${racaObj.nome} ${sistemaObj.nome}`;

      // Define peso médio baseado no sistema de produção
      let pesoMedio;
      switch (sistemaObj.nome) {
        case 'Cria': pesoMedio = faker.number.float({ min: 120, max: 220, fractionDigits: 1 }); break;
        case 'Recria': pesoMedio = faker.number.float({ min: 220, max: 360, fractionDigits: 1 }); break;
        case 'Engorda': pesoMedio = faker.number.float({ min: 360, max: 550, fractionDigits: 1 }); break;
        default: pesoMedio = faker.number.float({ min: 200, max: 400, fractionDigits: 1 }); break;
      }

      const quantidadeCabecas = faker.number.int({ min: 8, max: 80 });

      if (pastosDisponiveis.length === 0) {
        console.log(`  - Pulando rebanho "${nomeRebanho}", pois a propriedade não possui pastos.`);
        continue;
      }

      const pastoAtualId = faker.helpers.arrayElement(pastosDisponiveis).id;
      const dataEntradaPastoAtual = faker.date.recent({ days: 60 });

      const existing = await prisma.rebanho.findFirst({
        where: { propriedadeId: prop.id, nomeRebanho },
      });

      if (existing) {
        console.log(`  - Rebanho "${nomeRebanho}" ja existe, pulando...`);
        created.push(existing);
        continue;
      }

      const rebanho = await prisma.rebanho.create({
        data: {
          propriedadeId: prop.id,
          pastoAtualId,
          nomeRebanho,
          quantidadeCabecas,
          racaId: racaObj.id,
          sistemaProducaoId: sistemaObj.id,
          regimeAlimentarId: regimeObj.id,
          pesoMedioAtual: pesoMedio,
          dataEntradaPastoAtual,
        },
      });

      console.log(`  - Rebanho "${nomeRebanho}" criado (${quantidadeCabecas} cabecas - ${pesoMedio}kg)`);
      created.push(rebanho);
    }
  }

  return created;
}
