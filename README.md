# ☁️ Pasto Livre — Backend API & Sincronização Central

![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules%20v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.2-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-v7.5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

Este repositório contém o código-fonte da API RESTful de alta performance do ecossistema **Pasto Livre**, responsável pela persistência central em nuvem, cálculo algorítmico de autonomia de insumos e reconciliação bidirecional de eventos disparados por dispositivos móveis em modo offline.

> 🌿 **Documentação Integrada**: Para compreender a visão global do ecossistema, consulte o **[README Principal do Produto](../README.md)** e as diretrizes de design no **[Guia de Identidade Visual](../IDENTIDADE_VISUAL.md)**.

---

## 🏛️ Arquitetura do Servidor & Orquestração

A API foi projetada de forma modular utilizando **Node.js (ESM)**, estruturada para desacoplar rotas, validações estritas de esquema (`Zod`) e acesso ao banco de dados relacional (`Prisma`).

```text
gerenciamento-rural-api/
├── prisma/                      # Camada de Dados ORM
│   ├── schema.prisma            # Definição declarativa do PostgreSQL (Tabelas e Relações)
│   └── seeds/                   # Populadores iniciais de propriedades e insumos de teste
│
├── src/                         # Código-fonte da aplicação
│   ├── controllers/             # Controladores de endpoints REST
│   ├── middlewares/             # Validação Zod, Autenticação Better-Auth e Rate Limiting
│   ├── routes/                  # Definição de rotas da API (/propriedades, /pastos, /sync)
│   ├── services/                # Regras de negócio e motor preditivo de autonomia
│   └── app.js                   # Configuração central do Express, CORS e Helmet
│
├── documentacao/                # Specs OpenAPI / Swagger exportadas
├── Dockerfile                   # Configuração de build de imagem de produção
├── docker-compose.yml           # Orquestração de contêineres de produção
└── docker-compose.dev.yml       # Orquestração com live-reload para desenvolvimento
```

---

## 🔄 Reconciliação Offline-First (`log_sincronizacao`)

Como os terminais em campo operam desconectados (persistindo em SQLite), a API dispõe de um endpoint dedicado de sincronização em lotes (*Batch Sync*). 

Cada transação disparada pelo aplicativo móvel carrega um UUID gerado localmente e um carimbo de data/hora (`data_local`). O backend processa a fila e registra a auditoria na tabela `log_sincronizacao`, garantindo a idoneidade do histórico de vida do gado e das rotações de pastagem sem duplicidade de registros.

---

## 📜 Catálogo de Scripts NPM (`package.json`)

| Script Comando | Execução | Descrição Operacional |
| :--- | :--- | :--- |
| `npm run dev` | Docker Compose Dev | Sobe o PostgreSQL e a API em contêineres com *hot-reload* ativado (`--force-recreate`). |
| `npm run dev:local`| Nodemon Local | Inicia o servidor Node.js diretamente no host local monitorando `server.js`. |
| `npm run start:docker`| Docker Prod | Constrói e levanta o ambiente otimizado de produção. |
| `npm run prisma:studio`| Prisma GUI | Abre a interface visual web para inspeção direta das tabelas no banco de dados. |
| `npm run prisma:migrate`| SQL Migration | Executa as migrações pendentes no PostgreSQL (`update-schema`). |
| `npm run prisma:seed` | Data Seeder | Injeta massa de dados inicial de teste no banco relacional. |

---

## 🛠️ Guia Rápido de Configuração (Docker)

### 1. Variáveis de Ambiente
Crie o arquivo de ambiente a partir do modelo pré-configurado:
```bash
cp .env.example .env
```
> *Nota: O `.env.example` já traz as credenciais padrão de conexão para o contêiner do PostgreSQL na porta `5432`.*

### 2. Levantando o Ambiente de Desenvolvimento
Com o Docker em execução no host, execute o comando orquestrador:
```bash
npm run dev
```

O terminal exibirá a inicialização dos serviços:
* 🌐 **API REST Central**: `http://localhost:3000`
* 📚 **Documentação Swagger UI**: `http://localhost:3000/api-docs` (quando habilitado)
* 🗄️ **Banco PostgreSQL**: `localhost:5432`

### 3. Acessando o Visualizador do Banco (Prisma Studio)
Em um terminal secundário, abra o painel administrativo de dados:
```bash
npm run prisma:studio
```

---

## 🛡️ Segurança & Observabilidade

* **Segurança de Cabeçalhos**: Proteção ativa contra vetores comuns via `helmet: ^8.1.0`.
* **Controle de Tráfego**: Prevenção contra abusos e ataques de negação de serviço via `express-rate-limit`.
* **Autenticação Moderna**: Gestão de sessões e perfis através do `better-auth`.
* **Logs Rotativos**: Auditoria estruturada gravada diariamente em disco via `winston` e `winston-daily-rotate-file`.

---

<p align="center">
  <em>Motor robusto de persistência para o campo brasileiro.</em> ☁️ 🐂
</p>
