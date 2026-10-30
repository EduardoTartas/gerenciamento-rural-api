# Pasto Livre — API REST

![Node.js](https://img.shields.io/badge/Node.js-ES%20Modules%20v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.2-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma ORM](https://img.shields.io/badge/Prisma%20ORM-v7.5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

Backend do Pasto Livre, sistema de apoio ao manejo de gado de corte desenvolvido como Trabalho de Conclusão de Curso. Centraliza os dados em nuvem e atende o [aplicativo móvel](../gerenciamento-rural-mobile/README.md), que opera offline-first.

## Stack

Node.js 20+ (ES Modules), Express 5, Prisma 7, PostgreSQL 16, Zod, BetterAuth, Winston e Swagger.

## Arquitetura

```text
routes/ -> controllers/ -> service/ -> repository/ -> Prisma -> PostgreSQL
```

| Camada | Responsabilidade |
| :--- | :--- |
| `routes/` | Caminhos, autenticação e wrapper assíncrono |
| `controllers/` | Validação de entrada (Zod) e formato da resposta |
| `service/` | Regras de negócio, validações cruzadas e transações |
| `repository/` | Consultas Prisma com `select` explícito |

## Recursos

Rotas de domínio sob o prefixo `/v1`.

| Recurso | Rota |
| :--- | :--- |
| Autenticação | `/api/auth/*` |
| Usuários | `/usuarios` |
| Propriedades | `/propriedades` |
| Pastagens e manejos | `/pastagens`, `/pastagens/manejos` |
| Rebanhos e manejos | `/rebanhos`, `/rebanhos/manejos` |
| Movimentações | `/rebanhos/movimentacoes` (imutáveis) |
| Saídas de rebanho (venda, abate, morte) | `/rebanhos/saidas` |
| Insumos e movimentações de estoque | `/insumos`, `/insumos/movimentacoes` |
| Regime de consumo | `/rebanhos/regimes-consumo` |
| Fotos de manejo e upload | `/manejos/fotos`, `/uploads/imagens` |
| Sincronização em lote | `POST /sync` |
| Catálogos globais | `/catalogos/:entidade` |
| Notificações e dispositivos | `/notificacoes`, `/dispositivos/*` |
| Operacional | `/health`, `/docs` |

As regras de cada endpoint estão em [`documentacao/rotas/rotas_pastolivre.md`](documentacao/rotas/rotas_pastolivre.md).

### Contrato

- Toda resposta usa o envelope `{ message, data, errors }`.
- Listagens são paginadas: `limit` padrão de 10 e máximo de 100.
- Todo dado do domínio rural é escopado ao usuário autenticado.
- Os schemas de criação aceitam `id` (UUID) opcional, gerado pelo app ao criar registros offline.

## Como rodar

```bash
cp .env.example .env
npm run dev
```

Com o Docker em execução, o comando sobe API e PostgreSQL com hot-reload e aplica as migrações no boot.

| Serviço | Endereço |
| :--- | :--- |
| API | `http://localhost:6060` |
| Swagger | `http://localhost:6060/docs` |
| Health check | `http://localhost:6060/health` |
| PostgreSQL | `localhost:5433` |

### Variáveis de ambiente

Principais: `DATABASE_URL`, `APP_PORT`, `CORS_ORIGIN`, `BETTER_AUTH_URL` e as credenciais SMTP usadas no código de redefinição de senha. Detalhes em `.env.example`.

O push de avisos é opcional; sem as variáveis abaixo, os avisos ficam apenas na caixa de notificações do app.

| Variável | Uso |
| :--- | :--- |
| `NPAAS_URL` | URL base da API do NPaaS |
| `NPAAS_API_KEY` | Chave do projeto (segredo, nunca versionar) |
| `NOTIFICACOES_INTERVALO_MIN` | Intervalo da verificação periódica em minutos (padrão 60; 0 desliga) |

### Scripts

| Script | Descrição |
| :--- | :--- |
| `npm run dev` | API e PostgreSQL em contêineres, com hot-reload |
| `npm run dev:local` | Servidor via nodemon no host (requer PostgreSQL ativo) |
| `npm start` | Executa `node server.js` |
| `npm run prisma:migrate` | Aplica migrações pendentes |
| `npm run prisma:seed` | Popula catálogos e dados de teste |
| `npm run prisma:studio` | Interface visual do banco |
| `npm test` | Suíte de endpoints contra PostgreSQL real |

## Testes

```bash
docker compose -f docker-compose.dev.yml up -d postgresql
npm test
```

Os testes usam o banco `pasto_livre_teste`, criado e migrado automaticamente e truncado a cada teste; o banco de desenvolvimento não é afetado. Os cenários estão em `documentacao/plano-de-teste/suite-de-teste/`.

## Segurança

- Cabeçalhos via `helmet` e rate limiting, mais estrito nas rotas de autenticação.
- Autenticação com BetterAuth: sessão por cookie e plugin `bearer` para o app. Senha de 8 a 32 caracteres, com maiúscula e dígito.
- Redefinição de senha por OTP enviado por e-mail.
- Tratamento centralizado de erros, com identificador de rastreio e sem stack trace em produção.
- Logs com `winston` e rotação diária.

## Implantação

Produção em cluster K3s na Oracle Cloud (ARM64), exposto por Cloudflare Tunnel. O GitLab CI valida os manifests com `kubeconform`, constrói a imagem com Kaniko e atualiza o Deployment. Detalhes em [`deployment/infrastructure_diagram.md`](deployment/infrastructure_diagram.md).
