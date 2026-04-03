// src/middlewares/AuthMiddleware.js

import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/auth.js';
import CustomError from '../utils/helpers/CustomError.js';
import HttpStatusCodes from '../utils/helpers/HttpStatusCodes.js';

/**
 * Middleware that protects routes by verifying the user session via BetterAuth.
 * Attaches `req.user` and `req.session` on success.
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

        // Attach user and session data to the request object
        req.user = session.user;
        req.session = session.session;

        next();
    } catch (err) {
        next(err);
    }
};

export default AuthMiddleware;
