// src/middlewares/AdminMiddleware.js

import CustomError from '../utils/helpers/CustomError.js';
import HttpStatusCodes from '../utils/helpers/HttpStatusCodes.js';

/**
 * Middleware que restringe a rota a usuários com perfil administrativo.
 * Deve ser usado sempre depois de AuthMiddleware, que popula req.user.
 */
const AdminMiddleware = (req, res, next) => {
    if (!req.user?.admin) {
        return next(new CustomError({
            statusCode: HttpStatusCodes.FORBIDDEN.code,
            errorType: 'forbidden',
            field: 'admin',
            details: [],
            customMessage: 'Esta ação exige perfil administrativo.',
        }));
    }
    next();
};

export default AdminMiddleware;
