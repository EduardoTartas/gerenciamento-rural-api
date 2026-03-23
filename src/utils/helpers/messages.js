// src/utils/helpers/messages.js

const messages = {
    info: {
        welcome: "Bem-vindo ao App de Delivery!",
    },

    success: {
        default: "Operação concluída com sucesso.",
        logout: "Logout realizado com sucesso.",
    },

    authorized: {
        default: "autorizado",
    },

    error: {
        default: "Ocorreu um erro ao processar a solicitação.",
        serverError: "Erro interno do servidor. Tente novamente mais tarde.",
        validationError: "Erro de validação. Verifique os dados fornecidos e tente novamente.",
        invalidRequest: "Requisição inválida. Verifique os parâmetros fornecidos.",
        unauthorizedAccess: "Acesso não autorizado. Faça login para continuar.",
        internalServerError: (resource) => `Erro interno no servidor ao processar ${resource}.`,
        unauthorized: (resource) => `Erro de autorização: ${resource}.`,
        resourceConflict: (resource, conflictField) => `Conflito de recurso em ${resource} contém ${conflictField}.`,
        duplicateEntry: (fieldName) => `Já existe um registro com o dado informado no(s) campo(s) ${fieldName}.`,
        resourceInUse: (fieldName) => `Recurso em uso em ${fieldName}.`,
        authenticationError: (fieldName) => `Erro de autenticação em ${fieldName}.`,
        permissionError: (fieldName) => `Erro de permissão em ${fieldName}.`,
        resourceNotFound: (fieldName) => `Recurso não encontrado em ${fieldName}.`,
    },

    validation: {
        generic: {
            fieldIsRequired: (fieldName) => `O campo ${fieldName} é obrigatório.`,
            fieldIsRepeated: (fieldName) => `O campo ${fieldName} informado já está cadastrado.`,
            invalidInputFormat: (fieldName) => `Formato de entrada inválido para o campo ${fieldName}.`,
            invalid: (fieldName) => `Valor informado em ${fieldName} é inválido.`,
            notFound: (fieldName) => `Valor informado para o campo ${fieldName} não foi encontrado.`,
            resourceCreated: (fieldName) => `${fieldName} criado(a) com sucesso.`,
            resourceUpdated: (fieldName) => `${fieldName} atualizado(a) com sucesso.`,
            resourceDeleted: (fieldName) => `${fieldName} excluído(a) com sucesso.`,
            resourceAlreadyExists: (fieldName) => `${fieldName} já existe.`,
        },
    },

    auth: {
        authenticationFailed: "Falha na autenticação. Credenciais inválidas.",
        invalidPermission: "Permissão insuficiente para executar a operação.",
        invalidToken: "Token inválido. Faça login novamente.",
        invalidCredentials: "Credenciais inválidas. Verifique seu usuário e senha.",
    },
};

export default messages;
