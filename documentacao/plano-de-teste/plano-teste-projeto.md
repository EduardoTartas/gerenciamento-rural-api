# Plano de Teste

**Projeto Pasto Livre — API REST**

## 1 - Introdução

O Pasto Livre é um sistema de apoio ao manejo de gado de corte em propriedades de pequeno e médio
porte, desenvolvido como Trabalho de Conclusão de Curso. Esta API é a persistência central em nuvem
e atende o aplicativo móvel, que opera em modo **offline-first**: o produtor registra o manejo no
celular sem internet e sincroniza depois, quando houver sinal.

O levantamento de requisitos combinou a vivência do autor no meio rural com uma conversa direta com
um produtor, e dele saíram três prioridades concretas: organizar o rebanho por lotes, registrar o
histórico de manejo das pastagens e controlar o estoque de insumos. O sistema cobre ainda o cadastro
de propriedades e pastos, a movimentação de lotes entre pastos, os catálogos compartilhados
(raças, sistemas de produção, tipos de manejo), o upload de imagens e a sincronização em lote.

Este plano descreve a estratégia, os cenários e os critérios de aceite aplicados sobre a API, com
foco em três riscos próprios do domínio: o **isolamento entre produtores** (nenhum usuário pode ver
ou alterar dado de outro), a **integridade de operações que tocam várias tabelas** (movimentar um
lote muda o rebanho, os dois pastos e o histórico, tudo ou nada) e a **idempotência da
sincronização** (reenviar um lote não pode duplicar registro).

## 2 - Arquitetura da API

Aplicação modular em camadas, em Node.js 20+ com ES Modules, Express 5, Prisma 7 sobre PostgreSQL 16,
Zod 4 para validação, BetterAuth 1.5 para autenticação (sessão e token bearer para o app) e Swagger
para documentação interativa.

```text
routes/ → controllers/ → service/ → repository/ → Prisma → PostgreSQL
```

### Camadas

**Routes**: definem o caminho, aplicam o `AuthMiddleware` e o `asyncWrapper`. Não contêm lógica. A
ordem de registro importa: rotas específicas (`/pastagens/manejos`) vêm antes das genéricas
(`/pastagens/:id`).

**Controllers**: validam a entrada com Zod, atribuem a query já coagida a `req._parsedQuery` e
formatam a resposta com `CommonResponse`. Não acessam o banco.

**Services**: concentram as regras de negócio, as validações cruzadas e as transações. É onde vive o
escopo por usuário e as travas de integridade (não inativar propriedade com rebanho ativo, não
esvaziar pasto ocupado).

**Repositories**: únicos a tocar o Prisma, com `select` explícito. São singletons injetados nos
services.

**Validations**: um schema Zod por operação, todos com `.strict()`; schemas de query à parte. Os
schemas de criação aceitam `id` opcional (UUID), porque o app gera o identificador offline.

**Middlewares**: autenticação via BetterAuth, perfil administrativo, limitação de taxa e tratamento
global de erros.

## 3 - Categorização dos Requisitos em Funcionais x Não Funcionais

| Código | Requisito Funcional | Regra de Negócio Associada |
| :--- | :--- | :--- |
| **RF-001** | Autenticar produtor | Cadastro e login por e-mail e senha, login social pelo Google e redefinição de senha por código enviado no e-mail. |
| **RF-002** | Manter propriedades | Cadastrar, listar, editar e arquivar propriedades. Nome único por produtor entre as ativas. |
| **RF-003** | Manter pastagens | Cadastrar, listar, editar e arquivar pastos de uma propriedade, com controle de status (livre, ocupado, descanso). |
| **RF-004** | Registrar manejo de pastagem | Registrar atividades no pasto (adubação, roçada, reforma), com consumo opcional de insumos. |
| **RF-005** | Manter rebanhos | Cadastrar, listar, editar, inativar e reativar lotes vinculados a um pasto da mesma propriedade. Nome único por propriedade entre os ativos. |
| **RF-006** | Movimentar rebanho entre pastos | Registrar a mudança de lote de pasto, atualizando o pasto atual do rebanho e o status dos pastos de origem e destino; permitir desfazer a última movimentação. |
| **RF-007** | Registrar manejo de rebanho | Registrar atividades no lote (pesagem, vacinação, sanidade), atualizando o peso médio quando for pesagem, com consumo opcional de insumos. |
| **RF-008** | Controlar estoque de insumos | Cadastrar insumos e apurar o saldo por livro-razão de movimentações, sem campo de saldo gravado. |
| **RF-009** | Movimentar insumos | Registrar entradas e saídas de insumo e estornar movimentações. |
| **RF-010** | Definir regime de consumo | Vincular consumo diário de insumo a um rebanho, com início e fim, para projetar o consumo futuro. |
| **RF-011** | Manter catálogos | Consultar catálogos compartilhados (raça, sistema de produção, regime alimentar, tipos de manejo, tipo de insumo); apenas administradores criam, editam e arquivam. |
| **RF-012** | Manter usuários | Consultar e editar os próprios dados, registrar foto de perfil e excluir a conta; a listagem geral é restrita a administradores. |
| **RF-013** | Enviar imagens | Enviar imagens para o armazenamento de objetos, com validação de formato e tamanho e redimensionamento. |
| **RF-014** | Sincronizar em lote | Receber um lote de mutações geradas offline, aplicar cada uma de forma independente, respeitar dependências entre elas e garantir idempotência no reenvio. |

| Código | Requisito Não Funcional | Descrição |
| :--- | :--- | :--- |
| **RNF-001** | Isolamento por produtor | Toda consulta de dado rural é escopada ao usuário autenticado; recurso de outro produtor responde como inexistente. |
| **RNF-002** | Suporte a operação offline | A API aceita identificadores gerados pelo cliente e leitura por diferença (`atualizadoDesde`), para o app reconciliar o que mudou. |
| **RNF-003** | Contrato de resposta estável | Toda resposta usa o envelope `{ message, data, errors }`; o erro acrescenta `tipo` e `recuperavel`, para o app decidir se repete a operação. |
| **RNF-004** | Mensagens em linguagem clara | As mensagens chegam à tela do produtor: português claro, sem jargão técnico e sem detalhe interno do servidor. |
| **RNF-005** | Desempenho compatível com o uso | Uso normal de 1 a 3 produtores simultâneos; o sistema deve suportar 100 requisições por minuto e 10 usuários sem degradação perceptível. |
| **RNF-006** | Segurança da entrada | 100% dos parâmetros, query e corpo validados com Zod `.strict()` antes da camada de negócio; limitação de taxa nas rotas autenticadas e nas sensíveis. |
| **RNF-007** | Rastreabilidade das regras | Cada endpoint documentado em `documentacao/rotas/` e no Swagger, e coberto por cenários de teste rastreáveis por identificador. |

## 4 - Casos de Teste

Os casos de teste estão organizados por rota, em arquivos complementares dentro de
`documentacao/plano-de-teste/suite-de-teste/`. Cada arquivo traz uma tabela por endpoint, com
cenário, pré-condições e critérios de aceite.

Cada cenário tem um identificador estável (por exemplo `PROP-POST-01`) que é repetido no nome do
teste automatizado correspondente, em `test/endpoints/<rota>/`. Isso permite navegar da tabela para
o teste e vice-versa. A contraparte técnica, com o detalhamento de cada verificação e as
divergências encontradas entre código e documentação, está em `documentacao/testes/<rota>/`.

De forma geral, cada endpoint é coberto nas seguintes categorias: sucesso, validação de corpo, query
e parâmetros, autenticação ausente ou inválida, autorização administrativa, isolamento entre
produtores, recurso inexistente e regras de negócio específicas do domínio.

## 5 - Estratégia de Teste

A estratégia prioriza o **teste de endpoint sobre banco real**, e não o teste unitário com simulação
de repositório. A razão é o histórico do próprio projeto: uma suíte anterior, baseada em simulações,
passava verde enquanto a rota `GET /pastagens/manejos` respondia erro de validação para toda
listagem, porque a ordem de registro das rotas fazia o identificador cair no controller errado.
Defeitos assim só aparecem quando a requisição percorre rota, middleware, controller, service,
repositório e banco.

**Testes de endpoint (integração)**: exercitam todos os cenários de cada rota por HTTP, com
`supertest` sobre a aplicação Express, contra um PostgreSQL real e usuários criados pelo fluxo real
de cadastro do BetterAuth. Cobrem todos os endpoints da API. São de responsabilidade dos
desenvolvedores.

**Testes unitários**: mantidos apenas onde existe lógica pura sem equivalente observável por HTTP —
cálculo de saldo de insumo, grafo de dependências da sincronização, catálogo de tipos de erro e
schemas de validação.

**Testes manuais**: realizados pontualmente pelo Swagger ou pelo Insomnia durante o
desenvolvimento, e validação do fluxo completo com o aplicativo móvel em modo offline.

Regras adotadas na escrita dos testes:

- Cenário de escrita confere o efeito no banco, não apenas o código de resposta.
- Cenário de isolamento confere que o dado do outro produtor permaneceu intacto.
- Nenhuma simulação, com uma exceção declarada: o cliente do armazenamento de objetos.
- Defeito encontrado não é acomodado. O teste descreve o comportamento correto e fica marcado como
  falha esperada, com a divergência registrada na documentação da rota.

## 6 - Ambiente e Ferramentas

Os testes rodam no ambiente de desenvolvimento, com as mesmas versões do ambiente de produção. O
banco de teste é criado, migrado e limpo automaticamente, e é separado do banco de desenvolvimento.

| Ferramenta | Time | Descrição |
| :--- | :--- | :--- |
| Vitest | Desenvolvimento | Executor de testes, com projetos separados para endpoint e unidade |
| Supertest | Desenvolvimento | Requisições HTTP contra a aplicação Express, sem subir servidor |
| PostgreSQL 17 (Docker Compose) | Desenvolvimento | Banco real de teste, truncado antes de cada caso |
| Prisma Migrate | Desenvolvimento | Aplicação do schema no banco de teste |
| BetterAuth | Desenvolvimento | Criação de usuários e tokens reais nos testes |
| Swagger UI, Insomnia | Desenvolvimento | Testes manuais e exploração da API |

```bash
docker compose -f docker-compose.dev.yml up -d postgresql
npm test                  # tudo
npm run test:endpoints    # só a suíte de endpoint
npm run test:unidade      # só os testes unitários restantes
```

## 7 - Classificação de Bugs

| ID | Nível de Severidade | Descrição |
| :--- | :--- | :--- |
| 1 | Blocker | ● Impede o uso de uma funcionalidade inteira ou derruba a aplicação. <br>● Vazamento de dado entre produtores. <br>● Bloqueia a entrega. |
| 2 | Grave | ● Funcionalidade não se comporta como esperado. <br>● Operação de várias tabelas grava pela metade. <br>● Entrada incomum causa efeito irreversível. |
| 3 | Moderada | ● Funcionalidade não atende algum critério de aceite, mas segue utilizável. <br>● Mensagem de erro ou sucesso incorreta. |
| 4 | Pequena | ● Quase nenhum impacto no uso. <br>● Erro de ortografia, detalhe de formato na resposta. |

## 8 - Definição de Pronto

Uma funcionalidade é considerada pronta quando:

- todos os cenários da sua tabela em `suite-de-teste/` têm teste automatizado correspondente e a
  suíte passa;
- não há bug de severidade acima de moderada em aberto;
- a documentação da rota (`documentacao/rotas/`) e a definição Swagger refletem o comportamento
  implementado;
- o fluxo foi validado manualmente no Swagger e, quando envolve o app, também offline.

Quando um defeito conhecido for corrigido, o teste marcado como falha esperada volta a ser um teste
comum e a tabela da rota é atualizada no mesmo commit.
