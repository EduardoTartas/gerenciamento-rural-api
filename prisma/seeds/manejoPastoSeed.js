// prisma/seeds/manejoPastoSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';

const TIPOS_MANEJO_PASTO = [
  'Roçagem', 'Adubação', 'Reforma de Cerca', 'Limpeza',
  'Calagem', 'Dessecação', 'Plantio de Forrageira', 'Irrigação',
];

const OBSERVACOES = {
  'Roçagem': [
    'Roçagem mecanizada para controle de invasoras.',
    'Roçagem manual nas áreas de difícil acesso.',
    'Roçagem de uniformização antes da entrada do lote.',
    'Roçagem parcial para manter cobertura do solo.',
  ],
  'Adubação': [
    'Aplicação de 200kg/ha de NPK 20-05-20.',
    'Adubação de cobertura com ureia (100kg/ha).',
    'Calagem e adubação de cobertura pós-chuvas.',
    'Aplicação de superfosfato simples para correção.',
  ],
  'Reforma de Cerca': [
    'Substituição de mourões e estiramento de arame liso.',
    'Reparo emergencial após queda de árvore.',
    'Troca de arame farpado por liso (segurança dos animais).',
    'Instalação de porteira nova.',
  ],
  'Limpeza': [
    'Limpeza de bebedouros e cochos de sal.',
    'Remoção de galhos e detritos após temporal.',
    'Limpeza de aceiros para prevenção de incêndio.',
    'Desobstrução de canal de drenagem.',
  ],
  'Calagem': [
    'Aplicação de 2 ton/ha de calcário dolomítico.',
    'Correção de acidez conforme análise de solo.',
    'Calagem superficial para elevação do pH.',
  ],
  'Dessecação': [
    'Dessecação de braquiária degradada para replantio.',
    'Aplicação de herbicida pré-plantio.',
    'Dessecação parcial para renovação da pastagem.',
  ],
  'Plantio de Forrageira': [
    'Plantio de Brachiaria Brizantha cv. Marandu.',
    'Sobressemeadura com Panicum Maximum cv. Mombaça.',
    'Replantio em áreas com falhas na cobertura.',
  ],
  'Irrigação': [
    'Irrigação emergencial por seca prolongada.',
    'Teste do sistema de irrigação por aspersão.',
    'Irrigação de formação após plantio da forrageira.',
  ],
};

/**
 * Seed de manejos de pasto.
 * Cria N manejos por pasto com dados aleatórios.
 */
export async function seedManejoPastos(prisma, pastos, quantidadePorPasto = 2) {
  console.log('🌱 Semeando manejos de pasto...');

  let count = 0;

  for (const pasto of pastos) {
    for (let i = 0; i < quantidadePorPasto; i++) {
      const tipoManejo = faker.helpers.arrayElement(TIPOS_MANEJO_PASTO);
      const dataAtividade = faker.date.recent({ days: 120 });
      const observacoes = faker.helpers.arrayElement(OBSERVACOES[tipoManejo]);

      await prisma.manejoPasto.create({
        data: {
          pastoId: pasto.id,
          tipoManejo,
          dataAtividade,
          observacoes,
        },
      });

      count++;
    }
  }

  console.log(`  ✅ ${count} manejo(s) de pasto registrado(s)`);
}
