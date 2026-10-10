// src/routes/notificacaoRoutes.js
import express from 'express';
import NotificacaoController from '../controllers/NotificacaoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const controller = new NotificacaoController();

// `/notificacoes/lidas` e `/notificacoes/verificar` antes de `/notificacoes/:id`.
router
    .get('/notificacoes', AuthMiddleware, asyncWrapper(controller.list.bind(controller)))
    .patch('/notificacoes/lidas', AuthMiddleware, asyncWrapper(controller.marcarTodasLidas.bind(controller)))
    .post('/notificacoes/verificar', AuthMiddleware, asyncWrapper(controller.verificar.bind(controller)))
    .get('/notificacoes/:id', AuthMiddleware, asyncWrapper(controller.list.bind(controller)))
    .patch('/notificacoes/:id', AuthMiddleware, asyncWrapper(controller.update.bind(controller)));

router
    .post('/dispositivos/registrar', AuthMiddleware, asyncWrapper(controller.registrarDispositivo.bind(controller)))
    .post('/dispositivos/desativar-token', AuthMiddleware, asyncWrapper(controller.desativarDispositivo.bind(controller)));

export default router;
