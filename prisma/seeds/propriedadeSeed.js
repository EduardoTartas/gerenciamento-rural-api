// prisma/seeds/propriedadeSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';

// Cidades e UFs de Rondônia para gerar localizações realistas
const LOCALIDADES = [
  'Vilhena,RO', 'Cacoal,RO', 'Ji-Paraná,RO', 'Porto Velho,RO',
  'Ariquemes,RO', 'Rolim de Moura,RO', 'Ouro Preto do Oeste,RO',
  'Jaru,RO', 'Pimenta Bueno,RO', 'Colorado do Oeste,RO',
  'Espigão do Oeste,RO', 'Alta Floresta do Oeste,RO',
];

const NOMES_FAZENDA = [
  'Fazenda', 'Sítio', 'Rancho', 'Estância', 'Chácara', 'Haras',
];

const COMPLEMENTOS = [
  'Pasto Verde', 'Boa Esperança', 'Sol Nascente', 'Água Clara',
  'Bela Vista', 'São José', 'Santa Maria', 'Três Irmãos',
  'Nova Aurora', 'Céu Azul', 'Serra Bonita', 'Rio Claro',
  'Primavera', 'Recanto Feliz', 'Monte Alegre', 'Terra Firme',
];

/**
 * Gera um nome de fazenda único.
 */
function gerarNomeFazenda(usados) {
  let nome;
  let tentativas = 0;
  do {
    const tipo = faker.helpers.arrayElement(NOMES_FAZENDA);
    const complemento = faker.helpers.arrayElement(COMPLEMENTOS);
    nome = `${tipo} ${complemento}`;
    tentativas++;
    if (tentativas > 50) {
      // Se esgotou combinações, adiciona um número
      nome = `${tipo} ${complemento} ${faker.number.int({ min: 1, max: 99 })}`;
    }
  } while (usados.has(nome));
  usados.add(nome);
  return nome;
}

/**
 * Seed de propriedades rurais.
 * Cria N propriedades para cada usuário.
 */
export async function seedPropriedades(prisma, usuarios, quantidadePorUsuario = 2) {
  console.log('🌱 Semeando propriedades...');

  const created = [];
  const nomesUsados = new Set();

  for (const usuario of usuarios) {
    for (let i = 0; i < quantidadePorUsuario; i++) {
      const nome = gerarNomeFazenda(nomesUsados);
      const localizacao = faker.helpers.arrayElement(LOCALIDADES);

      const existing = await prisma.propriedade.findFirst({
        where: { usuarioId: usuario.id, nome },
      });

      if (existing) {
        console.log(`  ⏭️  Propriedade "${nome}" já existe, pulando...`);
        created.push(existing);
        continue;
      }

      const propriedade = await prisma.propriedade.create({
        data: {
          usuarioId: usuario.id,
          nome,
          localizacao,
        },
      });

      console.log(`  ✅ Propriedade "${nome}" criada (${localizacao})`);
      created.push(propriedade);
    }
  }

  return created;
}
