// src/routes/rebanhoRoutes.js

import express from 'express';
import RebanhoController from '../controllers/RebanhoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const rebanhoController = new RebanhoController();

router
    .get('/rebanhos',      AuthMiddleware, asyncWrapper(rebanhoController.list.bind(rebanhoController)))
    .get('/rebanhos/:id',  AuthMiddleware, asyncWrapper(rebanhoController.list.bind(rebanhoController)))
    .post('/rebanhos',     AuthMiddleware, asyncWrapper(rebanhoController.create.bind(rebanhoController)))
    .patch('/rebanhos/:id', AuthMiddleware, asyncWrapper(rebanhoController.update.bind(rebanhoController)))
    .delete('/rebanhos/:id', AuthMiddleware, asyncWrapper(rebanhoController.remove.bind(rebanhoController)));

export default router;
