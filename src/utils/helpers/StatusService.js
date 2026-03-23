// src/utils/helpers/StatusService.js

import HttpStatusCodes from './HttpStatusCodes.js';
import messages from './messages.js';

class StatusService {
    static getHttpCodeMessage(code) {
        const status = Object.values(HttpStatusCodes).find(status => status.code === code);
        return status ? status.message : 'Status desconhecido.';
    }

    static getErrorMessage(type, field = null) {
        if (messages.error[type]) {
            if (typeof messages.error[type] === 'function') {
                return messages.error[type](field);
            }
            return messages.error[type];
        }
        return "Tipo de erro desconhecido.";
    }
}

export default StatusService;
