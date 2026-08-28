// src/routes/insumoRoutes.js
import express from 'express';
import InsumoController from '../controllers/InsumoController.js';
import MovimentacaoInsumoController from '../controllers/MovimentacaoInsumoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const insumoController = new InsumoController();
const movimentacaoInsumoController = new MovimentacaoInsumoController();

// Rotas de movimentações — registradas antes de `/insumos/:id` para que
// `GET /insumos/:id` não capture `/insumos/movimentacoes`.
router
    .get('/insumos/movimentacoes', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.list.bind(movimentacaoInsumoController)))
    .get('/insumos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.list.bind(movimentacaoInsumoController)))
    .post('/insumos/movimentacoes', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.create.bind(movimentacaoInsumoController)))
    .delete('/insumos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.remove.bind(movimentacaoInsumoController)));

router
    .get('/insumos', AuthMiddleware, asyncWrapper(insumoController.list.bind(insumoController)))
    .get('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.list.bind(insumoController)))
    .post('/insumos', AuthMiddleware, asyncWrapper(insumoController.create.bind(insumoController)))
    .patch('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.update.bind(insumoController)))
    .delete('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.remove.bind(insumoController)));

export default router;
