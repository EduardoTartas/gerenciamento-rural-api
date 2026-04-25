// src/routes/manejoRebanhoRoutes.js

import express from 'express';
import ManejoRebanhoController from '../controllers/ManejoRebanhoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const manejoRebanhoController = new ManejoRebanhoController();

router
    .get('/rebanhos/manejos',       AuthMiddleware, asyncWrapper(manejoRebanhoController.list.bind(manejoRebanhoController)))
    .get('/rebanhos/manejos/:id',   AuthMiddleware, asyncWrapper(manejoRebanhoController.list.bind(manejoRebanhoController)))
    .post('/rebanhos/manejos',      AuthMiddleware, asyncWrapper(manejoRebanhoController.create.bind(manejoRebanhoController)))
    .patch('/rebanhos/manejos/:id', AuthMiddleware, asyncWrapper(manejoRebanhoController.update.bind(manejoRebanhoController)))
    .delete('/rebanhos/manejos/:id', AuthMiddleware, asyncWrapper(manejoRebanhoController.remove.bind(manejoRebanhoController)));

export default router;
