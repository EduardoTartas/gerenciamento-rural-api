// src/routes/manejoPastoRoutes.js

import express from 'express';
import ManejoPastoController from '../controllers/ManejoPastoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

const manejoPastoController = new ManejoPastoController();

router
    .get('/pastagens/manejos', AuthMiddleware, asyncWrapper(manejoPastoController.list.bind(manejoPastoController)))
    .get('/pastagens/manejos/:id', AuthMiddleware, asyncWrapper(manejoPastoController.list.bind(manejoPastoController)))
    .post('/pastagens/manejos', AuthMiddleware, asyncWrapper(manejoPastoController.create.bind(manejoPastoController)))
    .patch('/pastagens/manejos/:id', AuthMiddleware, asyncWrapper(manejoPastoController.update.bind(manejoPastoController)))
    .delete('/pastagens/manejos/:id', AuthMiddleware, asyncWrapper(manejoPastoController.remove.bind(manejoPastoController)));

export default router;
