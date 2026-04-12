// src/middlewares/AuthMiddleware.js

import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/auth.js';
import CustomError from '../utils/helpers/CustomError.js';
import HttpStatusCodes from '../utils/helpers/HttpStatusCodes.js';

/**
 * Middleware que protege rotas verificando a sessão do usuário via BetterAuth.
 * Anexa `req.user` e `req.session` em caso de sucesso.
 */
const AuthMiddleware = async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.user) {
            throw new CustomError({
                statusCode: HttpStatusCodes.UNAUTHORIZED.code,
                errorType: 'unauthorized',
                field: 'session',
                details: [],
                customMessage: 'Sessão inválida ou expirada. Faça login novamente.',
            });
        }

        // Anexa os dados do usuário e da sessão no objeto de requisição
        req.user = session.user;
        req.session = session.session;

        next();
    } catch (err) {
        next(err);
    }
};

export default AuthMiddleware;
