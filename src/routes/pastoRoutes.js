// src/routes/pastoRoutes.js

import express from 'express';
import PastoController from '../controllers/PastoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

const pastoController = new PastoController();

router
    .get('/pastagens', AuthMiddleware, asyncWrapper(pastoController.list.bind(pastoController)))
    .get('/pastagens/:id', AuthMiddleware, asyncWrapper(pastoController.list.bind(pastoController)))
    .post('/pastagens', AuthMiddleware, asyncWrapper(pastoController.create.bind(pastoController)))
    .patch('/pastagens/:id', AuthMiddleware, asyncWrapper(pastoController.update.bind(pastoController)))
    .delete('/pastagens/:id', AuthMiddleware, asyncWrapper(pastoController.remove.bind(pastoController)));

export default router;
