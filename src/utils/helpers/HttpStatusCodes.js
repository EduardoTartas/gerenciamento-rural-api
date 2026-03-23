// src/utils/helpers/HttpStatusCodes.js

class HttpStatusCodes {
    static OK = { code: 200, message: 'Requisição bem-sucedida' };
    static CREATED = { code: 201, message: 'Recurso criado com sucesso' };
    static ACCEPTED = { code: 202, message: 'Requisição aceita para processamento' };
    static NO_CONTENT = { code: 204, message: 'Sem conteúdo para retornar' };

    static BAD_REQUEST = { code: 400, message: 'Requisição com sintaxe incorreta' };
    static UNAUTHORIZED = { code: 401, message: 'Não autorizado' };
    static FORBIDDEN = { code: 403, message: 'Proibido' };
    static NOT_FOUND = { code: 404, message: 'Recurso não encontrado' };
    static METHOD_NOT_ALLOWED = { code: 405, message: 'Método HTTP não permitido para o recurso solicitado' };
    static CONFLICT = { code: 409, message: 'Conflito com o estado atual do servidor' };
    static UNPROCESSABLE_ENTITY = { code: 422, message: 'Falha na validação' };
    static TOO_MANY_REQUESTS = { code: 429, message: 'Muitas requisições realizadas em um curto período de tempo' };
    static INVALID_TOKEN = { code: 498, message: 'O token JWT está expirado!' };

    static INTERNAL_SERVER_ERROR = { code: 500, message: 'Erro interno do servidor' };
    static SERVICE_UNAVAILABLE = { code: 503, message: 'Serviço temporariamente indisponível' };
}

export default HttpStatusCodes;
