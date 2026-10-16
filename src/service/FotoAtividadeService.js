// src/service/FotoAtividadeService.js

import { v4 as uuidv4 } from 'uuid';
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import {
    fotoAtividadeRepository,
    manejoPastoRepository,
    manejoRebanhoRepository,
} from '../repository/index.js';
import UploadService from './UploadService.js';
import logger from '../utils/logger.js';

/** Fotos ativas que uma atividade pode ter ao mesmo tempo. */
export const LIMITE_FOTOS_POR_ATIVIDADE = 3;

/**
 * As duas atividades que aceitam foto. A regra é a mesma para as duas; muda só
 * o FK, o repository que confere o dono e o nome que aparece no 404.
 */
const ATIVIDADES = {
    pasto:   { campo: 'manejoPastoId',   repositorio: manejoPastoRepository,   nome: 'Manejo de Pasto' },
    rebanho: { campo: 'manejoRebanhoId', repositorio: manejoRebanhoRepository, nome: 'Manejo de Rebanho' },
};

/** Chave do arquivo no bucket: derivada do id, então o reenvio cai no mesmo objeto. */
const chaveDoArquivo = (id) => `atividades/${id}.jpeg`;

class FotoAtividadeService {
    constructor() {
        this.repository = fotoAtividadeRepository;
        this.uploadService = new UploadService();
    }

    /**
     * Lista fotos de atividade do usuário (leitura por diferença do app).
     */
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

    /**
     * Anexa uma foto a um manejo de pastagem ou de rebanho.
     *
     * O reenvio do mesmo `id` para o mesmo manejo devolve a foto já gravada
     * (`criada: false`) sem tocar no armazenamento: o app reenvia quando a
     * resposta se perde no caminho, e isso não pode virar foto duplicada nem
     * estourar o limite de 3.
     *
     * @param {'pasto'|'rebanho'} tipo
     * @returns {Promise<{foto: object, criada: boolean}>}
     */
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

        // Checagem antecipada: evita processar e subir uma imagem que vai ser
        // recusada. A decisão definitiva é a contagem dentro da transação.
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
            // P2002 = outro envio do mesmo id gravou primeiro; o arquivo é dele.
            if (erro?.code !== 'P2002') this._removerArquivo(id);
            throw erro;
        }

        if (!resultado.foto) {
            this._removerArquivo(id);
            throw this._erroLimite();
        }

        return { foto: resultado.foto, criada: true };
    }

    /**
     * Exclusão lógica de uma foto e remoção do arquivo em melhor esforço.
     *
     * Foto já excluída devolve o registro como está, sem erro: excluir de novo
     * é o mesmo pedido. `tolerarAusente` é do lote (`fotos_atividade:DELETE`),
     * onde a foto inexistente também é aceita — o aparelho pode estar
     * repetindo uma exclusão cuja foto nunca chegou a subir.
     */
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

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    _erroLimite() {
        return new CustomError({
            statusCode: HttpStatusCodes.BAD_REQUEST.code,
            errorType: 'validationError',
            field: 'file',
            details: [{ path: 'file', message: `Limite de ${LIMITE_FOTOS_POR_ATIVIDADE} fotos por atividade.` }],
            customMessage: `Esta atividade já tem ${LIMITE_FOTOS_POR_ATIVIDADE} fotos.`,
        });
    }

    /**
     * Apaga o arquivo do bucket sem esperar nem falhar a operação: a linha já
     * está excluída (ou nunca existiu), e um arquivo que sobra no bucket não
     * aparece para ninguém. Fica no log para limpeza manual.
     */
    _removerArquivo(id) {
        this.uploadService.deletarImagem(chaveDoArquivo(id)).catch((erro) => {
            logger.warn('Foto de atividade não removida do armazenamento.', { id, error: erro?.message });
        });
    }
}

export default FotoAtividadeService;
