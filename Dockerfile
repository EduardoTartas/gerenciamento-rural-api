# Estágio 1: Base com dependências do sistema
FROM node:22-alpine AS base

# Definir o diretório de trabalho
WORKDIR /app

# Instalar dependências necessárias para o Prisma funcionar no Alpine (musl vs glibc)
RUN apk add --no-cache libc6-compat openssl

# Estágio 2: Instalação de dependências e geração do Prisma Client
FROM base AS builder

# Copiar apenas os arquivos de manifesto para aproveitar o cache do Docker
COPY package.json package-lock.json ./

# Copiar a pasta prisma para gerar o client
COPY prisma ./prisma/

# Instalar TODAS as dependências (incluindo devDependencies para o build/generate)
RUN npm ci

# Gerar o Prisma Client (isso cria os arquivos em node_modules/.prisma)
RUN npx prisma generate

# Estágio 3: Runner (Imagem final de execução)
FROM base AS runner

# Variáveis de ambiente padrão
ENV NODE_ENV=production

# Copiar as dependências instaladas e o client gerado do estágio builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar o restante do código fonte (filtrado pelo .dockerignore)
COPY . .

# Expõe a porta padrão da API
EXPOSE 6060

# Comando padrão (pode ser sobrescrito pelo docker-compose)
CMD ["node", "server.js"]
