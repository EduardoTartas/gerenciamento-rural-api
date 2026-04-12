// prisma/seeds/index.js

/**
 * Orquestrador de seeds do banco de dados.
 *
 * Executa todos os seeds na ordem correta de dependência:
 * 1. Usuários (base de autenticação)
 * 2. Propriedades (dependem de usuários)
 * 3. Pastos (dependem de propriedades)
 * 4. Rebanhos (dependem de propriedades e pastos)
 * 5. Histórico de Movimentações (dependem de rebanhos e pastos)
 * 6. Manejos de Rebanho (dependem de rebanhos)
 * 7. Manejos de Pasto (dependem de pastos)
 *
 * Configuração de quantidades: prisma/seeds/config.js
 *
 * Uso: npm run prisma:seed
 *   ou: node prisma/seeds/index.js
 */

import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';

import { SEED_CONFIG } from './config.js';
import { seedUsuarios } from './usuarioSeed.js';
import { seedPropriedades } from './propriedadeSeed.js';
import { seedPastos } from './pastoSeed.js';
import { seedRebanhos } from './rebanhoSeed.js';
import { seedHistoricoMovimentacoes } from './historicoMovimentacaoSeed.js';
import { seedManejoRebanhos } from './manejoRebanhoSeed.js';
import { seedManejoPastos } from './manejoPastoSeed.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada. Defina a variável de ambiente.');
  }

  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  console.log('');
  console.log('🚜 ============================================');
  console.log('🚜  SEED DO BANCO DE DADOS - PASTO LIVRE');
  console.log('🚜 ============================================');
  console.log('');
  console.log('📊 Configuração:');
  console.log(`   Usuários aleatórios:       ${SEED_CONFIG.USUARIOS_ALEATORIOS}`);
  console.log(`   Propriedades por usuário:   ${SEED_CONFIG.PROPRIEDADES_POR_USUARIO}`);
  console.log(`   Pastos por propriedade:     ${SEED_CONFIG.PASTOS_POR_PROPRIEDADE}`);
  console.log(`   Rebanhos por propriedade:   ${SEED_CONFIG.REBANHOS_POR_PROPRIEDADE}`);
  console.log(`   Movimentações por rebanho:  ${SEED_CONFIG.MOVIMENTACOES_POR_REBANHO}`);
  console.log(`   Manejos por rebanho:        ${SEED_CONFIG.MANEJOS_POR_REBANHO}`);
  console.log(`   Manejos por pasto:          ${SEED_CONFIG.MANEJOS_POR_PASTO}`);
  console.log('');

  try {
    // 1. Usuários (admin + fixos + aleatórios)
    const usuarios = await seedUsuarios(prisma, SEED_CONFIG.USUARIOS_ALEATORIOS);
    console.log('');

    // 2. Propriedades
    const propriedades = await seedPropriedades(prisma, usuarios, SEED_CONFIG.PROPRIEDADES_POR_USUARIO);
    console.log('');

    // 3. Pastos
    const pastos = await seedPastos(prisma, propriedades, SEED_CONFIG.PASTOS_POR_PROPRIEDADE);
    console.log('');

    // 4. Rebanhos
    const rebanhos = await seedRebanhos(prisma, propriedades, pastos, SEED_CONFIG.REBANHOS_POR_PROPRIEDADE);
    console.log('');

    // 5. Histórico de Movimentações
    await seedHistoricoMovimentacoes(prisma, rebanhos, pastos, SEED_CONFIG.MOVIMENTACOES_POR_REBANHO);
    console.log('');

    // 6. Manejos de Rebanho
    await seedManejoRebanhos(prisma, rebanhos, SEED_CONFIG.MANEJOS_POR_REBANHO);
    console.log('');

    // 7. Manejos de Pasto
    await seedManejoPastos(prisma, pastos, SEED_CONFIG.MANEJOS_POR_PASTO);
    console.log('');

    // Contagem final
    const totais = {
      usuarios: await prisma.user.count(),
      propriedades: await prisma.propriedade.count(),
      pastos: await prisma.pasto.count(),
      rebanhos: await prisma.rebanho.count(),
      movimentacoes: await prisma.historicoMovimentacao.count(),
      manejosRebanho: await prisma.manejoRebanho.count(),
      manejosPasto: await prisma.manejoPasto.count(),
    };

    console.log('🎉 ============================================');
    console.log('🎉  SEED FINALIZADO COM SUCESSO!');
    console.log('🎉 ============================================');
    console.log('');
    console.log('📊 Totais no banco:');
    console.log(`   👤 Usuários:          ${totais.usuarios}`);
    console.log(`   🏠 Propriedades:      ${totais.propriedades}`);
    console.log(`   🌿 Pastos:            ${totais.pastos}`);
    console.log(`   🐄 Rebanhos:          ${totais.rebanhos}`);
    console.log(`   🔄 Movimentações:     ${totais.movimentacoes}`);
    console.log(`   💉 Manejos Rebanho:   ${totais.manejosRebanho}`);
    console.log(`   🌱 Manejos Pasto:     ${totais.manejosPasto}`);
    console.log('');
    console.log('📋 Credenciais de teste:');
    console.log('   🔑 admin@admin.com     / admin     (padrão do Swagger)');
    console.log('   👤 joao@pastoverde.com / Senha@123');
    console.log('   👤 maria@pastoverde.com / Senha@456');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Erro ao executar seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
