// src/config/dbConnect.js

import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
const { Pool } = pg;
import logger from '../utils/logger.js';

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada para o Prisma');
}

// Configura o pool do pg
const pool = new Pool({ connectionString: DATABASE_URL });

// Adapter para conexão direta com PostgreSQL via driver pg (porta 5432)
const adapter = new PrismaPg(pool);

class DbConnect {
  constructor() {
    // Instância única do Prisma reaproveitada por toda a API
    this.prisma = new PrismaClient({ adapter });
  }

  async connect() {
    try {
      await this.prisma.$connect();
      logger.info('Conectado ao PostgreSQL via Prisma');
    } catch (error) {
      logger.error('Erro ao conectar no banco', error);
      throw error; // deixa o processo de bootstrap decidir o que fazer
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
    await pool.end();
  }
}

export default new DbConnect();


