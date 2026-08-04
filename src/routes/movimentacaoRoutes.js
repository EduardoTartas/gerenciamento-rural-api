// src/routes/movimentacaoRoutes.js

import express from 'express';
import MovimentacaoController from '../controllers/MovimentacaoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const movimentacaoController = new MovimentacaoController();

/**
 * Movimentações são imutáveis (não há PATCH — histórico não pode ser
 * alterado). O DELETE não apaga o registro: desfaz apenas a última
 * movimentação do rebanho, revertendo seus efeitos colaterais.
 */
router
    .get('/rebanhos/movimentacoes',     AuthMiddleware, asyncWrapper(movimentacaoController.list.bind(movimentacaoController)))
    .get('/rebanhos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoController.list.bind(movimentacaoController)))
    .post('/rebanhos/movimentacoes',    AuthMiddleware, asyncWrapper(movimentacaoController.create.bind(movimentacaoController)))
    .delete('/rebanhos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoController.remove.bind(movimentacaoController)));

export default router;
