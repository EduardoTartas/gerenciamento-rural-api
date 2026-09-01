// src/docs/config/head.js

// Obtém as URLs do servidor para a documentação de acordo com o ambiente atual
const getServersInCorrectOrder = () => {
    const defaultDevUrl = "http://localhost:6060";
    const defaultProdUrl = "https://pastolivre.eduardotartas.dpdns.org";

    const devUrl = {
        url: process.env.SWAGGER_DEV_URL || defaultDevUrl,
        description: "Ambiente de desenvolvimento"
    };

    const prodUrl = {
        url: process.env.SWAGGER_PROD_URL || defaultProdUrl,
        description: "Ambiente de produção"
    };

    return process.env.NODE_ENV === "development" ? [devUrl, prodUrl] : [prodUrl, devUrl];
};

const getSwaggerOptions = async () => {
    const t = process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : '';

    // Paths
    const authPaths = (await import(new URL("../paths/auth.js",
        import.meta.url).href + t)).default;
    const userPaths = (await import(new URL("../paths/user.js",
        import.meta.url).href + t)).default;
    const propriedadePaths = (await import(new URL("../paths/propriedade.js",
        import.meta.url).href + t)).default;
    const pastoPaths = (await import(new URL("../paths/pasto.js",
        import.meta.url).href + t)).default;
    const manejoPastoPaths = (await import(new URL("../paths/manejoPasto.js",
        import.meta.url).href + t)).default;
    const catalogoPaths = (await import(new URL("../paths/catalogo.js",
        import.meta.url).href + t)).default;
    const rebanhoPaths = (await import(new URL("../paths/rebanho.js",
        import.meta.url).href + t)).default;
    const manejoRebanhoPaths = (await import(new URL("../paths/manejoRebanho.js",
        import.meta.url).href + t)).default;
    const movimentacaoPaths = (await import(new URL("../paths/movimentacao.js",
        import.meta.url).href + t)).default;
    const insumoPaths = (await import(new URL("../paths/insumo.js",
        import.meta.url).href + t)).default;
    const syncPaths = (await import(new URL("../paths/sync.js",
        import.meta.url).href + t)).default;
    const uploadPaths = (await import(new URL("../paths/upload.js",
        import.meta.url).href + t)).default;

    // Schemas
    const authSchemas = (await import(new URL("../schemas/authSchema.js",
        import.meta.url).href + t)).default;
    const userSchemas = (await import(new URL("../schemas/userSchema.js",
        import.meta.url).href + t)).default;
    const propriedadeSchemas = (await import(new URL("../schemas/propriedadeSchema.js",
        import.meta.url).href + t)).default;
    const pastoSchemas = (await import(new URL("../schemas/pastoSchema.js",
        import.meta.url).href + t)).default;
    const manejoPastoSchemas = (await import(new URL("../schemas/manejoPastoSchema.js",
        import.meta.url).href + t)).default;
    const catalogoSchemas = (await import(new URL("../schemas/catalogoSchema.js",
        import.meta.url).href + t)).default;
    const rebanhoSchemas = (await import(new URL("../schemas/rebanhoSchema.js",
        import.meta.url).href + t)).default;
    const manejoRebanhoSchemas = (await import(new URL("../schemas/manejoRebanhoSchema.js",
        import.meta.url).href + t)).default;
    const movimentacaoSchemas = (await import(new URL("../schemas/movimentacaoSchema.js",
        import.meta.url).href + t)).default;
    const insumoSchemas = (await import(new URL("../schemas/insumoSchema.js",
        import.meta.url).href + t)).default;
    const syncSchemas = (await import(new URL("../schemas/syncSchema.js",
        import.meta.url).href + t)).default;
    const uploadSchemas = (await import(new URL("../schemas/uploadSchema.js",
        import.meta.url).href + t)).default;

    return {
        swaggerDefinition: {
            openapi: "3.0.0",
            info: {
                title: "Pasto Livre API",
                version: "1.0.0",
                description: `
## Visão Geral

Backend para gestão de propriedades rurais focado em pecuária de pequeno e médio porte. Suporta registro de múltiplas fazendas, manejo de pastagens, controle de rebanho e sincronização offline-first com o aplicativo móvel.

## Autenticação

Sessões baseadas em cookies gerenciadas pelo BetterAuth. Após login, os cookies são definidos automaticamente.

**Endpoints de autenticação:**
- POST /api/auth/sign-up/email — Cadastro
- POST /api/auth/sign-in/email — Login
- POST /api/auth/sign-out — Logout
- GET /api/auth/get-session — Verificar sessão ativa

**Credenciais de teste:**
- admin@admin.com / admin
- joao@pastoverde.com / Senha@123
- maria@pastoverde.com / Senha@456

## Endpoints Versionados

Todos os endpoints de negócio estão sob /v1. Documentação de regras e comportamento em https://github.com/gerenciamento-rural-tcc/gerenciamento-rural-api/blob/main/documentacao/rotas/rotas_pastolivre.md.

## Convenções de Resposta

Sucesso (2xx):
\`\`\`json
{
  "message": "Descrição da ação realizada",
  "data": { },
  "errors": []
}
\`\`\`

Erro (4xx/5xx):
\`\`\`json
{
  "statusCode": 400,
  "errorType": "validationError",
  "field": "nome_do_campo",
  "details": [ { "path": "campo", "message": "Motivo do erro" } ],
  "customMessage": "Mensagem legível para o usuário",
  "traceId": "identificador-único-da-requisição"
}
\`\`\`

**Error types:** validationError, conflict, rateLimit, unauthorized, forbidden, resourceNotFound

## Multi-tenancy

Todos os dados rurais (propriedades, pastos, rebanhos, manejos) são escopados ao usuário autenticado. Não é possível acessar dados de outro usuário.
                `,
                contact: {
                    name: "Pasto Livre",
                    url: "https://github.com/gerenciamento-rural-tcc/gerenciamento-rural-api"
                },
            },
            servers: getServersInCorrectOrder(),
            tags: [
                {
                    name: "Auth",
                    description: "Autenticação de sessão com BetterAuth"
                },
                {
                    name: "Usuários",
                    description: "Gestão de perfil (leitura restrita ao próprio usuário ou admin)"
                },
                {
                    name: "Propriedades",
                    description: "Cadastro e gestão de fazendas"
                },
                {
                    name: "Pastagens",
                    description: "Gestão de pastos, status de ocupação e descanso"
                },
                {
                    name: "Manejos de Pastagem",
                    description: "Registro de intervenções em pastos (roçagem, adubação, calagem)"
                },
                {
                    name: "Catálogos Globais",
                    description: "Tabelas de referência compartilhadas entre usuários (raças, sistemas de produção, regimes, tipos de manejo)"
                },
                {
                    name: "Rebanhos",
                    description: "Cadastro e gestão de lotes de gado"
                },
                {
                    name: "Manejos de Rebanho",
                    description: "Registro de atividades sanitárias e de pesagem"
                },
                {
                    name: "Movimentações",
                    description: "Histórico imutável de transferências entre pastos"
                },
                {
                    name: "Insumos",
                    description: "Estoque de insumos, movimentações (ledger) e consumo diário do rebanho"
                },
                {
                    name: "Sincronização",
                    description: "Aplicação em lote de mutações geradas offline pelo app"
                },
                {
                    name: "Uploads",
                    description: "Upload genérico de imagens para o armazenamento (Garage)"
                }
            ],
            paths: {
                ...authPaths,
                ...userPaths,
                ...propriedadePaths,
                ...pastoPaths,
                ...manejoPastoPaths,
                ...catalogoPaths,
                ...rebanhoPaths,
                ...manejoRebanhoPaths,
                ...movimentacaoPaths,
                ...insumoPaths,
                ...syncPaths,
                ...uploadPaths,
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT"
                    }
                },
                schemas: {
                    ...authSchemas,
                    ...userSchemas,
                    ...propriedadeSchemas,
                    ...pastoSchemas,
                    ...manejoPastoSchemas,
                    ...catalogoSchemas,
                    ...rebanhoSchemas,
                    ...manejoRebanhoSchemas,
                    ...movimentacaoSchemas,
                    ...insumoSchemas,
                    ...syncSchemas,
                    ...uploadSchemas,
                }
            },
            security: [{
                bearerAuth: []
            }]
        },
        apis: ["./src/routes/*.js"]
    };
};

export default getSwaggerOptions;
