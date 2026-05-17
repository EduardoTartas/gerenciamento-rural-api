// src/routes/movimentacaoRoutes.js

import express from 'express';
import MovimentacaoController from '../controllers/MovimentacaoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const movimentacaoController = new MovimentacaoController();

/**
 * Movimentações são imutáveis (apenas criação e consulta).
 * Não há PATCH nem DELETE — histórico não pode ser alterado.
 */
router
    .get('/rebanhos/movimentacoes',     AuthMiddleware, asyncWrapper(movimentacaoController.list.bind(movimentacaoController)))
    .get('/rebanhos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoController.list.bind(movimentacaoController)))
    .post('/rebanhos/movimentacoes',    AuthMiddleware, asyncWrapper(movimentacaoController.create.bind(movimentacaoController)));

export default router;
