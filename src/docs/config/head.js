// src/docs/config/head.js

// Recupera as URLs de servidores da documentação considerando o ambiente atual
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
    return {
        swaggerDefinition: {
            openapi: "3.0.0",
            info: {
                title: "Pasto Livre API - Gestão Rural",
                version: "1.0.0",
                description: "API responsável pelo backend do aplicativo Pasto Livre, solução mobile offline-first para pequenos e médios pecuaristas. Abrange cadastro multi-fazenda, manejo de pastagens, controle de lotes, dietas e inventário de insumos.",
                contact: {
                    name: "Equipe Pasto Livre",
                    email: "contato@pastolivre.com"
                },
            },
            servers: getServersInCorrectOrder(),
            tags: [
                {
                    name: "Autenticação",
                    description: "Fluxos de login, registro e renovação de tokens"
                },
                {
                    name: "Produtores",
                    description: "Seleção de propriedade, perfis e permissões dos usuários de campo"
                },
                {
                    name: "Propriedades",
                    description: "Cadastro de fazendas, talhões, infraestrutura e alertas do dashboard"
                },
                {
                    name: "Pastagens",
                    description: "Manejo de pastos, ocupação, descanso e histórico de intervenções"
                },
                {
                    name: "Rebanhos (Lotes)",
                    description: "Criação de lotes, movimentação entre pastos e linha do tempo sanitária"
                },
                {
                    name: "Dietas",
                    description: "Configuração de consumo por lote, cálculo de autonomia e vínculo com estoque"
                },
                {
                    name: "Inventário",
                    description: "Entradas de insumos, unidades de medida e saldo disponível"
                },
                {
                    name: "Sincronização",
                    description: "Status offline, fila de envio e reconciliamento com o servidor"
                }
            ],
            paths: {}, // TODO: adicionar os paths assim que forem versionados
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT"
                    }
                },
                schemas: {} // TODO: adicionar schemas quando disponíveis
            },
            security: [{
                bearerAuth: []
            }]
        },
        apis: ["./src/routes/*.js"]
    };
};

export default getSwaggerOptions;
