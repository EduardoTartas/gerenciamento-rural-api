
import express from 'express';
import MovimentacaoController from '../controllers/MovimentacaoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const movimentacaoController = new MovimentacaoController();

router
    .get('/rebanhos/movimentacoes',     AuthMiddleware, asyncWrapper(movimentacaoController.list.bind(movimentacaoController)))
    .get('/rebanhos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoController.list.bind(movimentacaoController)))
    .post('/rebanhos/movimentacoes',    AuthMiddleware, asyncWrapper(movimentacaoController.create.bind(movimentacaoController)))
    .delete('/rebanhos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoController.remove.bind(movimentacaoController)));

export default router;
