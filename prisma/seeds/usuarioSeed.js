// prisma/seeds/usuarioSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';
import { hashPassword } from 'better-auth/crypto';

/**
 * Cria um usuário e sua conta de autenticação no BetterAuth.
 * Usa o hashPassword nativo do BetterAuth para garantir compatibilidade.
 */
async function criarUsuario(prisma, { name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ⏭️  Usuário "${name}" já existe, pulando...`);
    return existing;
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Cria a conta de credenciais (mesma estrutura que o BetterAuth usa)
  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`  ✅ Usuário "${name}" criado (${email})`);
  return user;
}

/**
 * Seed de usuários.
 * Cria o admin, 2 usuários fixos e N aleatórios via Faker.
 */
export async function seedUsuarios(prisma, quantidadeAleatorios = 3) {
  console.log('🌱 Semeando usuários...');

  const created = [];

  // 1. Usuário admin (credencial padrão para testes)
  const admin = await criarUsuario(prisma, {
    name: 'Administrador',
    email: 'admin@admin.com',
    password: 'admin',
  });
  created.push(admin);

  // 2. Usuários fixos com dados realistas
  const fixos = [
    { name: 'João Pecuarista', email: 'joao@pastoverde.com', password: 'Senha@123' },
    { name: 'Maria Fazendeira', email: 'maria@pastoverde.com', password: 'Senha@456' },
  ];

  for (const u of fixos) {
    const user = await criarUsuario(prisma, u);
    created.push(user);
  }

  // 3. Usuários aleatórios via Faker
  for (let i = 0; i < quantidadeAleatorios; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const user = await criarUsuario(prisma, {
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: 'Senha@123',
    });
    created.push(user);
  }

  return created;
}
