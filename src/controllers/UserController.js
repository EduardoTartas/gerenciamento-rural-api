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
                'User found successfully.',
            );
        }

        const totalDocs = data?.totalDocs ?? data?.docs?.length ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.name || query.email);
            const message = hasFilters
                ? 'No users found with the given filters.'
                : 'No users registered.';
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
            `${totalDocs} user(s) found.`,
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
                        message: 'Request body cannot be empty.',
                    },
                ],
                customMessage: 'Please provide at least one field to update.',
            });
        }

        const parsedData = UserUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'User updated successfully.',
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
            'User deleted successfully.',
        );
    }
}

export default UserController;
