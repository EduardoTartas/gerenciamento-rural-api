# ☁️ Pasto Livre — API REST

![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules%20v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.2-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-v7.5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

Backend do ecossistema **Pasto Livre**, responsável pela persistência central em nuvem e
pelo atendimento das requisições do aplicativo móvel, que opera em modo offline-first.

> 🌿 Para a visão geral do produto, consulte o
> **[README principal](../README.md)**. As diretrizes de interface estão no
> **[Guia de Identidade Visual](../IDENTIDADE_VISUAL.md)**.

---

## 🏛️ Arquitetura

API modular em **Node.js (ESM)**, organizada em camadas com responsabilidades estritas:

```text
routes/ → controllers/ → service/ → repository/ → Prisma → PostgreSQL
```

| Camada | Responsabilidade |
| :--- | :--- |
| `routes/` | Definição de caminhos, autenticação e wrapper assíncrono |
| `controllers/` | Validação de entrada (Zod) e formatação da resposta |
| `service/` | Regras de negócio, validações cruzadas e transações |
| `repository/` | Consultas Prisma com `select` explícito |

```text
gerenciamento-rural-api/
├── prisma/
│   ├── schema.prisma            # Modelo de dados declarativo
│   ├── migrations/              # Histórico versionado de migrações SQL
│   └── seeds/                   # Populadores de catálogos e dados de teste
│
├── src/
│   ├── app.js                   # Express, CORS, Helmet, compressão, BetterAuth
│   ├── config/                  # Conexão Prisma (dbConnect) e BetterAuth (auth)
│   ├── routes/                  # Rotas por domínio + Swagger + health check
│   ├── controllers/             # Controladores REST
│   ├── service/                 # Regras de negócio
│   ├── repository/              # Acesso a dados
│   ├── middlewares/             # Autenticação, rate limiting, logs, asyncWrapper
│   ├── docs/                    # Definições OpenAPI (paths e schemas)
│   └── utils/
│       ├── helpers/             # CommonResponse, CustomError, errorHandler
│       ├── validators/          # Schemas Zod de corpo e de query
│       └── templates/           # Templates HTML de e-mail
│
├── documentacao/rotas/          # Regras de negócio por endpoint
├── deployment/                  # Manifests Kubernetes e diagrama de infraestrutura
├── Dockerfile                   # Build multi-estágio de produção
├── docker-compose.dev.yml       # Ambiente de desenvolvimento com hot-reload
└── docker-compose.yml           # Ambiente de produção
```

---

## 📡 Recursos disponíveis

| Recurso | Endpoints |
| :--- | :--- |
| Autenticação | `/api/auth/*` (BetterAuth: cadastro, login, sessão, OTP de redefinição) |
| Usuários | `GET · PATCH · DELETE /usuarios` |
| Propriedades | `GET · POST · PATCH · DELETE /propriedades` |
| Pastagens | `GET · POST · PATCH · DELETE /pastagens` |
| Manejos de pasto | `GET · POST · PATCH · DELETE /pastagens/manejos` |
| Rebanhos | `GET · POST · PATCH · DELETE /rebanhos` |
| Movimentações | `GET · POST /rebanhos/movimentacoes` (imutáveis: sem PATCH/DELETE) |
| Manejos de rebanho | `GET · POST · PATCH · DELETE /rebanhos/manejos` |
| Catálogos globais | `GET · POST · PATCH · DELETE /catalogos/:entidade` |
| Operacional | `GET /health` · `GET /docs` |

As regras de negócio de cada endpoint estão detalhadas em
[`documentacao/rotas/rotas_pastolivre.md`](documentacao/rotas/rotas_pastolivre.md).

### Padrão de resposta

Todas as respostas usam o mesmo envelope:

```json
{
  "message": "3 pastagem(ns) encontrada(s).",
  "data": { "docs": [], "totalDocs": 3, "page": 1, "limit": 10, "totalPages": 1 },
  "errors": []
}
```

Listagens são **paginadas**, com `limit` padrão de `10` e teto de `100`. Clientes devem
informar `page` e `limit` explicitamente quando esperarem mais de dez registros.

### Isolamento de dados

Todo recurso do domínio rural é escopado ao usuário autenticado, direta ou indiretamente
pela cadeia `propriedade → pasto → rebanho → evento`. Um produtor nunca acessa dados de
outro.

### Suporte a offline-first

Os schemas de criação aceitam um campo `id` opcional (UUID). O aplicativo gera o
identificador no dispositivo ao criar um registro sem conexão e o envia ao sincronizar, de
modo que o mesmo registro tenha o mesmo ID no celular e no servidor.

---

## 📜 Scripts NPM

| Script | Descrição |
| :--- | :--- |
| `npm run dev` | Sobe API e PostgreSQL em contêineres, com hot-reload |
| `npm run dev:local` | Inicia o servidor via nodemon no host (requer PostgreSQL ativo) |
| `npm start` | Executa `node server.js` |
| `npm run start:docker` | Sobe o ambiente de produção |
| `npm run prisma:migrate` | Aplica migrações pendentes |
| `npm run prisma:seed` | Popula catálogos e dados de teste |
| `npm run prisma:studio` | Abre a interface visual do banco |

> Não há suíte de testes automatizados configurada neste repositório.

---

## 🛠️ Configuração

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

O arquivo `.env.example` traz as credenciais padrão de conexão com o contêiner do
PostgreSQL. As variáveis relevantes incluem `DATABASE_URL`, `APP_PORT`, `CORS_ORIGIN`,
`BETTER_AUTH_URL` e as credenciais SMTP usadas no envio do código de redefinição de senha.

### 2. Subindo o ambiente

Com o Docker em execução:

```bash
npm run dev
```

* 🌐 **API**: `http://localhost:6060`
* 📚 **Swagger UI**: `http://localhost:6060/docs`
* ❤️ **Health check**: `http://localhost:6060/health`
* 🗄️ **PostgreSQL**: `localhost:5433` (mapeado da porta 5432 do contêiner)

O contêiner aplica `prisma migrate deploy` automaticamente no boot.

### 3. Inspecionando o banco

```bash
npm run prisma:studio
```

---

## 🛡️ Segurança e observabilidade

* **Cabeçalhos de segurança** via `helmet`, com Content Security Policy restritiva
* **Rate limiting** com `express-rate-limit`: limite geral nas rotas autenticadas e limite
  mais estrito nas rotas de autenticação
* **Autenticação** com `better-auth` — sessões com cookie e plugin `bearer` para o cliente
  móvel; senhas com política de 8 a 32 caracteres, exigindo maiúscula e dígito
* **Redefinição de senha por OTP** enviado por e-mail (`nodemailer`)
* **Compressão** de respostas com `compression`, relevante em conexões de baixa largura
* **Logs estruturados** com `winston` e rotação diária (`winston-daily-rotate-file`)
* **Tratamento centralizado de erros** normalizando códigos do Prisma, do Zod e do
  BetterAuth para o envelope padrão, com identificador de rastreio e ocultação de stack
  trace em produção
* **Encerramento gracioso** em `SIGINT`/`SIGTERM`, fechando o pool de conexões

---

## 🚢 Implantação

Produção roda em cluster **K3s** na Oracle Cloud (ARM64), exposto por **Cloudflare Tunnel**
— sem portas abertas na máquina. O pipeline do GitLab CI valida os manifests com
`kubeconform`, constrói a imagem com Kaniko e atualiza o Deployment via `kubectl`.

Detalhes e diagrama completo em
[`deployment/infrastructure_diagram.md`](deployment/infrastructure_diagram.md).

---

<p align="center">
  <em>Backend do Pasto Livre.</em> ☁️ 🐂
</p>
