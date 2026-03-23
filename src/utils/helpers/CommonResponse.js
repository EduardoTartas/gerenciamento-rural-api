// src/utils/helpers/CommonResponse.js

import StatusService from './StatusService.js';

class CommonResponse {
    constructor(message, data = null, errors = []) {
        this.message = message;
        this.data = data;
        this.errors = errors;
    }

    toJSON() {
        return {
            message: this.message,
            data: this.data,
            errors: this.errors
        };
    }

    static success(res, data, code = 200, message = null) {
        const statusMessage = message || StatusService.getHttpCodeMessage(code);
        const response = new CommonResponse(statusMessage, data, []);
        return res.status(code).json(response);
    }

    static error(res, code, errorType, field = null, errors = [], customMessage = null) {
        const errorMessage = customMessage || StatusService.getErrorMessage(errorType, field);
        const response = new CommonResponse(errorMessage, null, errors);
        return res.status(code).json(response);
    }

    static created(res, data, message = null) {
        return this.success(res, data, 201, message);
    }

    static serverError(res, message = null) {
        const errorMessage = message || StatusService.getErrorMessage('serverError');
        const response = new CommonResponse(errorMessage, null, []);
        return res.status(500).json(response);
    }
}

export default CommonResponse;
