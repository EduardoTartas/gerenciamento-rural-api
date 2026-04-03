// src/docs/schemas/swaggerCommonResponses.js

import HttpStatusCodes from "../../utils/helpers/HttpStatusCodes.js";

const swaggerCommonResponses = {};

// Dynamically creates a response method for each HTTP status code
// following the same pattern used in the CommonResponse class.
Object.keys(HttpStatusCodes).forEach((statusKey) => {
    const { code, message } = HttpStatusCodes[statusKey];

    swaggerCommonResponses[code] = (schemaRef = null, description = message) => ({
        description,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        data: schemaRef
                            ? { $ref: schemaRef }
                            : { type: "array", items: {}, example: [] },
                        message: {
                            type: "string",
                            example: message
                        },
                        errors: {
                            type: "array",
                            example: code >= 400 ? [{ message }] : [],
                        },
                    },
                },
            },
        },
    });
});

export default swaggerCommonResponses;
