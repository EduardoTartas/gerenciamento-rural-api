
import { v4 as uuidv4 } from 'uuid';
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import {
    fotoAtividadeRepository,
    manejoPastoRepository,
    manejoRebanhoRepository,
} from '../repository/index.js';
import UploadService from './UploadService.js';
import logger from '../utils/logger.js';

/** fotos ativas que uma atividade pode ter ao mesmo tempo. */
export const LIMITE_FOTOS_POR_ATIVIDADE = 3;

const ATIVIDADES = {
    pasto:   { campo: 'manejoPastoId',   repositorio: manejoPastoRepository,   nome: 'Manejo de Pasto' },
    rebanho: { campo: 'manejoRebanhoId', repositorio: manejoRebanhoRepository, nome: 'Manejo de Rebanho' },
};

const chaveDoArquivo = (id) => `atividades/${id}.jpeg`;

class FotoAtividadeService {
    constructor() {
        this.repository = fotoAtividadeRepository;
        this.uploadService = new UploadService();
    }

    async list(req) {
        const usuarioId = req.user.id;
        const {
            manejoPastoId, manejoRebanhoId, pastoId, rebanhoId, propriedadeId,
            ativo, atualizadoDesde, page = 1, limit = 10,
        } = req._parsedQuery ?? req.query;

        const filters = {};
        if (manejoPastoId)   filters.manejoPastoId   = manejoPastoId;
        if (manejoRebanhoId) filters.manejoRebanhoId = manejoRebanhoId;
        if (pastoId)         filters.pastoId         = pastoId;
        if (rebanhoId)       filters.rebanhoId       = rebanhoId;
        if (propriedadeId)   filters.propriedadeId   = propriedadeId;
        if (ativo !== undefined) filters.ativo       = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            parseInt(limit, 10) || 10,
        );
    }

    async create(tipo, manejoId, parsedData, file, req) {
        const usuarioId = req.user.id;
        const { campo, repositorio, nome } = ATIVIDADES[tipo];

        const manejo = await repositorio.findById(manejoId, usuarioId);
        if (!manejo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: nome,
                details: [],
                customMessage: messages.error.resourceNotFound(nome),
            });
        }
        if (!manejo.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'manejoId',
                details: [{ path: 'manejoId', message: 'Não é possível anexar foto a uma atividade excluída.' }],
                customMessage: 'Esta atividade foi excluída.',
            });
        }

        if (parsedData.id) {
            const dono = await this.repository.findDonoDoId(parsedData.id);
            if (dono) {
                if (dono[campo] === manejoId) {
                    return { foto: await this.repository.findById(parsedData.id, usuarioId), criada: false };
                }
                throw new CustomError({
                    statusCode: HttpStatusCodes.CONFLICT.code,
                    errorType: 'conflict',
                    field: 'id',
                    details: [{ path: 'id', message: 'Este id de foto já pertence a outra atividade.' }],
                    customMessage: 'Esta foto já foi enviada para outra atividade.',
                });
            }
        }

        const ativas = await this.repository.contarAtivas(campo, manejoId);
        if (ativas >= LIMITE_FOTOS_POR_ATIVIDADE) throw this._erroLimite();

        const id = parsedData.id ?? uuidv4();
        const { url } = await this.uploadService.processarImagem(file, {
            perfil: 'atividade',
            fileName: chaveDoArquivo(id),
        });

        let resultado;
        try {
            resultado = await this.repository.createComLimite(
                campo, manejoId, { ...parsedData, id, url }, LIMITE_FOTOS_POR_ATIVIDADE,
            );
        } catch (erro) {
            if (erro?.code !== 'P2002') this._removerArquivo(id);
            throw erro;
        }

        if (!resultado.foto) {
            this._removerArquivo(id);
            throw this._erroLimite();
        }

        return { foto: resultado.foto, criada: true };
    }

    async remove(id, req, tx, { tolerarAusente = false } = {}) {
        const usuarioId = req.user.id;
        const foto = await this.repository.findById(id, usuarioId, tx);

        if (!foto) {
            if (tolerarAusente) return null;
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Foto da Atividade',
                details: [],
                customMessage: messages.error.resourceNotFound('Foto da Atividade'),
            });
        }
        if (!foto.ativo) return foto;

        const removida = await this.repository.remove(id, tx);
        this._removerArquivo(id);
        return removida;
    }

    // MÉTODOS UTILITÁRIOS

    _erroLimite() {
        return new CustomError({
            statusCode: HttpStatusCodes.BAD_REQUEST.code,
            errorType: 'validationError',
            field: 'file',
            details: [{ path: 'file', message: `Limite de ${LIMITE_FOTOS_POR_ATIVIDADE} fotos por atividade.` }],
            customMessage: `Esta atividade já tem ${LIMITE_FOTOS_POR_ATIVIDADE} fotos.`,
        });
    }

    _removerArquivo(id) {
        this.uploadService.deletarImagem(chaveDoArquivo(id)).catch((erro) => {
            logger.warn('Foto de atividade não removida do armazenamento.', { id, error: erro?.message });
        });
    }
}

export default FotoAtividadeService;
