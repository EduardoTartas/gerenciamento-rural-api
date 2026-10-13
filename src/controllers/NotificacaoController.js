// src/controllers/NotificacaoController.js
import NotificacaoService from '../service/NotificacaoService.js';
import VerificacaoNotificacoesService from '../service/VerificacaoNotificacoesService.js';
import {
    NotificacaoUpdateSchema,
    NotificacaoLidasSchema,
    DispositivoRegistrarSchema,
    DispositivoDesativarSchema,
} from '../utils/validators/schemas/zod/NotificacaoSchema.js';
import { NotificacaoQuerySchema, NotificacaoIdSchema } from '../utils/validators/schemas/zod/querys/NotificacaoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

function exigirCorpo(req, customMessage) {
    if (!req.body || Object.keys(req.body).length === 0) {
        throw new CustomError({
            statusCode: HttpStatusCodes.BAD_REQUEST.code,
            errorType: 'validationError',
            field: 'body',
            details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
            customMessage,
        });
    }
}

class NotificacaoController {
    constructor() {
        this.service = new NotificacaoService();
        this.verificacao = new VerificacaoNotificacoesService();
    }

    async list(req, res) {
        const { id } = req.params;
        if (id) NotificacaoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await NotificacaoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Notificação encontrada com sucesso.');
        }
        const totalDocs = data?.totalDocs ?? 0;
        const msg = totalDocs === 0
            ? 'Nenhuma notificação.'
            : `${totalDocs} notificação(ões) encontrada(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async update(req, res) {
        const { id } = req.params;
        NotificacaoIdSchema.parse(id);
        exigirCorpo(req, 'Informe se a notificação foi lida.');
        const parsedData = NotificacaoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Notificação atualizada com sucesso.');
    }

    async marcarTodasLidas(req, res) {
        const parsedData = NotificacaoLidasSchema.parse(req.body ?? {});
        const data = await this.service.marcarTodasLidas(parsedData, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, `${data.marcadas} notificação(ões) marcada(s) como lida(s).`);
    }

    /** Disparo manual da verificação, só para o usuário autenticado. Ignora o horário de silêncio. */
    async verificar(req, res) {
        const data = await this.verificacao.verificarUsuario(req.user.id, { ignorarSilencio: true });
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Verificação concluída.');
    }

    async registrarDispositivo(req, res) {
        exigirCorpo(req, 'Informe o token do aparelho.');
        const parsedData = DispositivoRegistrarSchema.parse(req.body);
        const data = await this.service.registrarDispositivo(parsedData, req);
        const msg = data.registrado
            ? 'Aparelho registrado para receber avisos.'
            : 'Não foi possível registrar o aparelho agora. Os avisos continuam na caixa de notificações.';
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async desativarDispositivo(req, res) {
        exigirCorpo(req, 'Informe o token do aparelho.');
        const parsedData = DispositivoDesativarSchema.parse(req.body);
        const data = await this.service.desativarDispositivo(parsedData);
        const msg = data.desativado
            ? 'Aparelho não receberá mais avisos.'
            : 'Não foi possível desativar o aparelho agora.';
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }
}

export default NotificacaoController;
