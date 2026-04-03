// src/docs/paths/auth.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const authRoutes = {
    "/api/auth/sign-up/email": {
        post: {
            tags: ["Auth"],
            summary: "Registers a new user account",
            description: `
            + Use case: User self-registration via email and password.

            + Business Function:
                - Allows new users to create an account in the system.
                + Receives in the request body:
                    - **name**: full name of the user.
                    - **email**: valid email address.
                    - **password**: password (minimum 8 characters).

            + Business Rules:
                - All fields (name, email, password) are required.
                - Email must be unique in the system.
                - Password is automatically hashed by BetterAuth.
                - On success, a session is created and session cookies are set.

            + Expected Result:
                - HTTP 200 OK with session and user data.
                - Session cookie is automatically set in the response.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/SignUpRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/SignInResponse"),
                400: commonResponses[400](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/sign-in/email": {
        post: {
            tags: ["Auth"],
            summary: "Authenticates a user and creates a session",
            description: `
            + Use case: User authentication via email and password.

            + Business Function:
                - Authenticates the user and creates a server-side session.
                + Receives in the request body:
                    - **email**: registered email address.
                    - **password**: user password.

            + Business Rules:
                - Email and password are required.
                - Credentials are validated against stored hashes.
                - On success, a session is created in the database and cookies are set.
                - On failure, returns 401 Unauthorized.

            + Expected Result:
                - HTTP 200 OK with **SignInResponse** containing session and user data.
                - Session cookie is automatically set for subsequent authenticated requests.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/SignInRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/SignInResponse"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/sign-out": {
        post: {
            tags: ["Auth"],
            summary: "Signs out the user and invalidates the session",
            description: `
            + Use case: User logout and session invalidation.

            + Business Function:
                - Ends the current session and removes it from the database.
                - Clears session cookies from the client.

            + Authentication:
                - Requires a valid session cookie in the request.

            + Business Rules:
                - The session is deleted from the database.
                - Session cookies are cleared from the response.
                - Idempotent: if the session is already expired, still returns 200.

            + Expected Result:
                - HTTP 200 OK with success confirmation.
            `,
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/get-session": {
        get: {
            tags: ["Auth"],
            summary: "Returns the current user session",
            description: `
            + Use case: Verify if the user is authenticated and retrieve session data.

            + Business Function:
                - Returns the active session and the associated user data.
                - Used by the frontend to check authentication state.

            + Authentication:
                - Requires a valid session cookie in the request.

            + Expected Result:
                - HTTP 200 OK with **SessionResponse** containing session and user data.
                - Returns null/empty if no valid session exists.
            `,
            responses: {
                200: commonResponses[200]("#/components/schemas/SessionResponse"),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/forget-password": {
        post: {
            tags: ["Auth"],
            summary: "Requests password recovery via email",
            description: `
            + Use case: Password recovery when the user forgot their credentials.

            + Business Function:
                - Generates a recovery token and stores it in the verifications table.
                + Receives in the request body:
                    - **email**: registered email address.
                    - **redirectTo** (optional): URL to redirect after clicking the recovery link.

            + Business Rules:
                - The email must be registered in the system.
                - A temporary recovery token is generated with an expiration time.
                - **NOTE**: Email sending is not yet configured (TODO). The token is generated and stored but no email is dispatched.

            + Expected Result:
                - HTTP 200 OK with success confirmation.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/ForgetPasswordRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                400: commonResponses[400](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/reset-password": {
        post: {
            tags: ["Auth"],
            summary: "Resets password using recovery token",
            description: `
            + Use case: Password reset using the token received via email.

            + Business Function:
                - Allows the user to set a new password using a valid recovery token.
                + Receives in the request body:
                    - **newPassword**: the new password to set.
                    - **token**: the recovery token received via email.

            + Business Rules:
                - The recovery token must be valid and not expired.
                - The new password is automatically hashed by BetterAuth.
                - After reset, the token is invalidated.

            + Expected Result:
                - HTTP 200 OK with success confirmation.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/ResetPasswordRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/ok": {
        get: {
            tags: ["Auth"],
            summary: "BetterAuth health check",
            description: `
            + Use case: Verify that the BetterAuth handler is running correctly.

            + Expected Result:
                - HTTP 200 OK with a simple status response.
            `,
            responses: {
                200: {
                    description: "BetterAuth is running",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    ok: { type: "boolean", example: true }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

export default authRoutes;
