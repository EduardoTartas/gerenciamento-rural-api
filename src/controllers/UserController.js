// src/controllers/UserController.js

import UserService from '../service/UserService.js';
import { UserUpdateSchema } from '../utils/validators/schemas/zod/UserSchema.js';
import {
    UserQuerySchema,
    UserIdSchema,
} from '../utils/validators/schemas/zod/querys/UserQuerySchema.js';
import {
    CommonResponse,
    CustomError,
    HttpStatusCodes,
} from '../utils/helpers/index.js';

class UserController {
    constructor() {
        this.service = new UserService();
    }

    /**
     * GET /users
     * GET /users/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) {
            UserIdSchema.parse(id);
        }

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await UserQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(
                res,
                data,
                HttpStatusCodes.OK.code,
                'Usuário encontrado com sucesso.',
            );
        }

        const totalDocs = data?.totalDocs ?? data?.docs?.length ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.name || query.email);
            const message = hasFilters
                ? 'Nenhum usuário encontrado com os filtros informados.'
                : 'Nenhum usuário registrado.';
            return CommonResponse.success(
                res,
                data,
                HttpStatusCodes.OK.code,
                message,
            );
        }

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            `${totalDocs} usuário(s) encontrado(s).`,
        );
    }

    /**
     * PATCH /users/:id
     */
    async update(req, res) {
        const { id } = req.params;
        UserIdSchema.parse(id);

        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [
                    {
                        path: 'body',
                        message: 'O corpo da requisição não pode estar vazio.',
                    },
                ],
                customMessage: 'Por favor, informe pelo menos um campo para atualizar.',
            });
        }

        const parsedData = UserUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Usuário atualizado com sucesso.',
        );
    }

    /**
     * DELETE /users/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        UserIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Usuário removido com sucesso.',
        );
    }
}

export default UserController;
