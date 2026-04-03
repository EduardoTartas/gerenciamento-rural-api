// src/docs/paths/user.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import userSchemas from "../schemas/userSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const userRoutes = {
    "/users": {
        get: {
            tags: ["Users"],
            summary: "Lists all registered users",
            description: `
            + Use case: Allows an authenticated user to list all users in the system with optional filters.

            + Business Function:
                - Returns a paginated list of users.
                + Accepts optional query parameters:
                    • **name**: filter by name (partial match, case-insensitive).
                    • **email**: filter by email (partial match, case-insensitive).
                    • **page**: page number (default: 1).
                    • **limit**: records per page (default: 10, max: 100).

            + Business Rules:
                - Requires a valid authenticated session (cookie-based via BetterAuth).
                - Returns paginated results with totalDocs, totalPages metadata.

            + Expected Result:
                - HTTP 200 OK with **UserPaginatedList** containing docs array and pagination info.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(userSchemas.UserFilter),
                {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", default: 10, maximum: 100 },
                    required: false,
                    description: "Number of records per page (max 100)"
                },
                {
                    name: "page",
                    in: "query",
                    schema: { type: "integer", default: 1 },
                    required: false,
                    description: "Page number"
                }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/UserPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/users/{id}": {
        get: {
            tags: ["Users"],
            summary: "Gets details of a specific user",
            description: `
            + Use case: Retrieve detailed information about a specific user.

            + Business Function:
                - Returns all profile data for the given user ID.
                + Receives as path parameter:
                    - **id**: UUID of the user.

            + Business Rules:
                - Requires a valid authenticated session.
                - The ID must be a valid UUID format.
                - Returns 404 if the user is not found.

            + Expected Result:
                - HTTP 200 OK with **UserDetails** schema.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "User UUID"
            }],
            responses: {
                200: commonResponses[200]("#/components/schemas/UserDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Users"],
            summary: "Partially updates a user's profile",
            description: `
            + Use case: Allows a user to update their own profile data.

            + Business Function:
                - Updates user fields (name, email, image).
                + Receives as path parameter:
                    - **id**: UUID of the user.

            + Business Rules:
                - Requires a valid authenticated session.
                - A user can only update their own profile (self-action enforcement).
                - At least one field must be provided in the request body.
                - If email is changed, it must be unique across the system.

            + Expected Result:
                - HTTP 200 OK with updated **UserDetails**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "User UUID"
            }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/UserPatch" }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/UserDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Users"],
            summary: "Deletes a user account",
            description: `
            + Use case: Allows a user to delete their own account.

            + Business Function:
                - Permanently removes the user and all associated sessions/accounts.
                + Receives as path parameter:
                    - **id**: UUID of the user.

            + Business Rules:
                - Requires a valid authenticated session.
                - A user can only delete their own account (self-action enforcement).
                - Cascade delete removes related sessions and accounts.

            + Expected Result:
                - HTTP 200 OK with confirmation message.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "User UUID"
            }],
            responses: {
                200: commonResponses[200](),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    }
};

export default userRoutes;
