// prisma/seeds/config.js

/**
 * Configuração central de quantidades para o seed.
 */
export const SEED_CONFIG = {
  // Número de usuários aleatórios (além do admin e dos fixos)
  USUARIOS_ALEATORIOS: 3,

  // Número de propriedades por usuário
  PROPRIEDADES_POR_USUARIO: 2,

  // Número de pastos por propriedade
  PASTOS_POR_PROPRIEDADE: 3,

  // Número de rebanhos por propriedade
  REBANHOS_POR_PROPRIEDADE: 2,

  // Número de movimentações por rebanho
  MOVIMENTACOES_POR_REBANHO: 2,

  // Número de manejos por rebanho
  MANEJOS_POR_REBANHO: 3,

  // Número de manejos por pasto
  MANEJOS_POR_PASTO: 2,
};
