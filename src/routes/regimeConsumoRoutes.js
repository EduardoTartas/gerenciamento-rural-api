// src/routes/regimeConsumoRoutes.js
import express from 'express';
import RegimeConsumoInsumoController from '../controllers/RegimeConsumoInsumoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const controller = new RegimeConsumoInsumoController();

router
    .get('/rebanhos/regimes-consumo', AuthMiddleware, asyncWrapper(controller.list.bind(controller)))
    .get('/rebanhos/regimes-consumo/:id', AuthMiddleware, asyncWrapper(controller.list.bind(controller)))
    .post('/rebanhos/regimes-consumo', AuthMiddleware, asyncWrapper(controller.create.bind(controller)))
    .patch('/rebanhos/regimes-consumo/:id', AuthMiddleware, asyncWrapper(controller.update.bind(controller)))
    .delete('/rebanhos/regimes-consumo/:id', AuthMiddleware, asyncWrapper(controller.remove.bind(controller)));

export default router;
