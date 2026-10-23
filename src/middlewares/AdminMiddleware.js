
import CustomError from '../utils/helpers/CustomError.js';
import HttpStatusCodes from '../utils/helpers/HttpStatusCodes.js';

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
