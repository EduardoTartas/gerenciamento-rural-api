
import HttpStatusCodes from "../../utils/helpers/HttpStatusCodes.js";

const swaggerCommonResponses = {};

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
