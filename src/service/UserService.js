// src/service/UserService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import UserRepository from '../repository/UserRepository.js';

class UserService {
    constructor() {
        this.repository = new UserRepository();
    }

    /**
     * List users with pagination and filtering.
     */
    async list(req) {
        const { id } = req.params;

        if (id) {
            return this.repository.findById(id);
        }

        const { name, email, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (name) filters.name = name;
        if (email) filters.email = email;

        return this.repository.list(filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100));
    }

    /**
     * Update a user's profile data.
     * Only the user themselves can update their data.
     */
    async update(id, parsedData, req) {
        await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'update another user\'s profile');

        // Validate unique email if changing it
        if (parsedData.email) {
            await this.validateUniqueEmail(parsedData.email, id);
        }

        return this.repository.update(id, parsedData);
    }

    /**
     * Delete a user account.
     * Only the user themselves can delete their account.
     */
    async remove(id, req) {
        await this.ensureUserExists(id);
        this.ensureSelfAction(req.user.id, id, 'delete another user\'s account');

        return this.repository.remove(id);
    }

    // ================================
    // UTILITY METHODS
    // ================================

    /**
     * Validates that the email is not already in use by another user.
     */
    async validateUniqueEmail(email, excludeId = null) {
        const existing = await this.repository.findByEmail(email, excludeId);
        if (existing) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'email',
                details: [{ path: 'email', message: 'Email is already in use.' }],
                customMessage: 'Email is already registered.',
            });
        }
    }

    /**
     * Ensures a user with the given ID exists. Returns the user data.
     */
    async ensureUserExists(id) {
        const user = await this.repository.findById(id);
        if (!user) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'User',
                details: [],
                customMessage: messages.error.resourceNotFound('User'),
            });
        }
        return user;
    }

    /**
     * Ensures the logged-in user is performing the action on their own resource.
     */
    ensureSelfAction(loggedUserId, targetId, actionDescription) {
        if (loggedUserId !== targetId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.FORBIDDEN.code,
                errorType: 'forbidden',
                field: 'User',
                details: [],
                customMessage: `You do not have permission to ${actionDescription}.`,
            });
        }
    }
}

export default UserService;
