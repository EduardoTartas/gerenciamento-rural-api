// prisma/seeds/pastoSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';

const TIPOS_PASTAGEM = [
  'Brachiaria Brizantha', 'Brachiaria Decumbens', 'Brachiaria Humidicola',
  'Mombaça', 'Tanzânia', 'Marandu', 'Tifton 85', 'Capim Elefante',
  'Andropogon', 'Massai',
];

const NOMES_PASTO = [
  'Pasto da Lagoa', 'Pasto do Morro', 'Piquete Central', 'Pasto da Mangueira',
  'Pasto do Córrego', 'Retiro Norte', 'Retiro Sul', 'Pasto Principal',
  'Pasto do Bebedouro', 'Piquete do Curral', 'Pasto da Estrada',
  'Pasto do Barreiro', 'Pasto da Divisa', 'Invernada Grande',
  'Invernada Pequena', 'Piquete de Manejo', 'Pasto do Açude',
  'Pasto da Mata', 'Reserva Leste', 'Reserva Oeste',
];

const STATUS_PASTO = ['Ocupado', 'Vazio', 'Descanso'];

/**
 * Seed de pastos (pastagens).
 * Cria N pastos para cada propriedade com dados aleatórios realistas.
 */
export async function seedPastos(prisma, propriedades, quantidadePorPropriedade = 3) {
  console.log('Semeando pastos...');

  const created = [];
  const nomesUsadosPorProp = {};

  for (const prop of propriedades) {
    nomesUsadosPorProp[prop.id] = new Set();

    for (let i = 0; i < quantidadePorPropriedade; i++) {
      let nome;
      let tentativas = 0;
      do {
        nome = faker.helpers.arrayElement(NOMES_PASTO);
        tentativas++;
        if (tentativas > NOMES_PASTO.length) {
          nome = `Pasto ${faker.number.int({ min: 1, max: 99 })}`;
        }
      } while (nomesUsadosPorProp[prop.id].has(nome));
      nomesUsadosPorProp[prop.id].add(nome);

      const status = faker.helpers.arrayElement(STATUS_PASTO);
      const extensaoHa = faker.number.float({ min: 2, max: 25, fractionDigits: 1 });
      const tipoPastagem = faker.helpers.arrayElement(TIPOS_PASTAGEM);

      // Se status é Descanso ou Vazio, gera uma data de última saída recente
      const dataUltimaSaida = status !== 'Ocupado'
        ? faker.date.recent({ days: 30 })
        : null;

      const existing = await prisma.pasto.findFirst({
        where: { propriedadeId: prop.id, nome },
      });

      if (existing) {
        console.log(`  ⏭️  Pasto "${nome}" já existe, pulando...`);
        created.push(existing);
        continue;
      }

      const pasto = await prisma.pasto.create({
        data: {
          propriedadeId: prop.id,
          nome,
          extensaoHa,
          tipoPastagem,
          status,
          dataUltimaSaida,
        },
      });

      console.log(`  ✅ Pasto "${nome}" criado (${extensaoHa}ha - ${tipoPastagem} - ${status})`);
      created.push(pasto);
    }
  }

  return created;
}
