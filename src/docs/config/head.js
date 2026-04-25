// src/docs/config/head.js

// Obtém as URLs do servidor para a documentação de acordo com o ambiente atual
const getServersInCorrectOrder = () => {
    const defaultDevUrl = "http://localhost:6060";
    const defaultProdUrl = `${defaultDevUrl}/prod`;

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

    return {
        swaggerDefinition: {
            openapi: "3.0.0",
            info: {
                title: "Pasto Livre API - Gestão Rural",
                version: "1.0.0",
                description: `
### 📋 Visão Geral
Documentação oficial da **Pasto Livre API** — um backend para gestão de propriedades rurais focado em operações pecuárias de pequeno e médio porte.

Esta API suporta o registro de múltiplas fazendas, manejo de pastagens, controle de rebanho, inventário de insumos e sincronização offline-first com o aplicativo móvel.

---

### 🔐 Autenticação
A autenticação é gerenciada pelo **BetterAuth** com cookies baseados em sessão.

- **Cadastro**: \`POST /api/auth/sign-up/email\`
- **Login**: \`POST /api/auth/sign-in/email\`
- **Logout**: \`POST /api/auth/sign-out\`
- **Obter Sessão**: \`GET /api/auth/get-session\`

> 🔑 **Credenciais de teste (seed):**
> - \`admin@admin.com\` / \`admin\`
> - \`joao@pastoverde.com\` / \`Senha@123\`
> - \`maria@pastoverde.com\` / \`Senha@456\`

Após o login, os cookies de sessão são definidos automaticamente. Para testes na interface do Swagger, utilize o botão **Authorize** com um token Bearer ou certifique-se de que os cookies estão ativados.

---

### 🚀 Principais Funcionalidades
- **Autenticação de Sessão BetterAuth**: Sessões seguras baseadas em cookies com persistência em PostgreSQL.
- **Gerenciamento de Usuários**: CRUD de perfis com validação Zod e identificadores UUID.
- **Recuperação de Senha**: Fluxos de esquecimento/redefinição de senha (serviço de e-mail pendente de configuração).
- **Prisma ORM**: Acesso ao banco de dados com tipagem segura e PostgreSQL.
                `,
                contact: {
                    name: "Equipe Pasto Livre",
                    email: "contato@pastolivre.com"
                },
            },
            servers: getServersInCorrectOrder(),
            tags: [
                {
                    name: "Auth",
                    description: "Fluxos de autenticação gerenciados pelo BetterAuth (cadastro, login, logout, recuperação de senha)"
                },
                {
                    name: "Usuários",
                    description: "Gerenciamento de perfil de usuários (listar, visualizar, atualizar, excluir)"
                },
                {
                    name: "Propriedades",
                    description: "Cadastro de fazendas, talhões, infraestrutura e alertas do dashboard"
                },
                {
                    name: "Pastagens",
                    description: "Gerenciamento de pastagens, ocupação, descanso e histórico de intervenções"
                },
                {
                    name: "Manejos de Pastagem",
                    description: "Registro de atividades de manejo realizadas nos pastos (roçagem, adubação, calagem, etc.)"
                },
                {
                    name: "Catálogos Globais",
                    description: "Tabelas de apoio compartilhadas: Raças, Categorias, Sistemas de Produção, Regimes Alimentares e Tipos de Manejo"
                },
                {
                    name: "Rebanhos",
                    description: "Cadastro e gestão de lotes/rebanhos, com soft-delete e atualização automática de status dos pastos"
                },
                {
                    name: "Manejos de Rebanho",
                    description: "Registro de atividades sanitárias: vacinação, pesagem, vermifugação, etc."
                },
                {
                    name: "Movimentações",
                    description: "Histórico imutável de transferências de rebanhos entre pastos (log transacional)"
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
