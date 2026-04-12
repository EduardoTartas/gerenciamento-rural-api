// src/routes/propriedadeRoutes.js

import express from 'express';
import PropriedadeController from '../controllers/PropriedadeController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

const propriedadeController = new PropriedadeController();

router
    .get('/propriedades', AuthMiddleware, asyncWrapper(propriedadeController.list.bind(propriedadeController)))
    .get('/propriedades/:id', AuthMiddleware, asyncWrapper(propriedadeController.list.bind(propriedadeController)))
    .post('/propriedades', AuthMiddleware, asyncWrapper(propriedadeController.create.bind(propriedadeController)))
    .patch('/propriedades/:id', AuthMiddleware, asyncWrapper(propriedadeController.update.bind(propriedadeController)))
    .delete('/propriedades/:id', AuthMiddleware, asyncWrapper(propriedadeController.remove.bind(propriedadeController)));

export default router;
