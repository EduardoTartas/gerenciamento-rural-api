// src/routes/insumoRoutes.js
import express from 'express';
import InsumoController from '../controllers/InsumoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const insumoController = new InsumoController();

router
    .get('/insumos', AuthMiddleware, asyncWrapper(insumoController.list.bind(insumoController)))
    .get('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.list.bind(insumoController)))
    .post('/insumos', AuthMiddleware, asyncWrapper(insumoController.create.bind(insumoController)))
    .patch('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.update.bind(insumoController)))
    .delete('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.remove.bind(insumoController)));

export default router;
