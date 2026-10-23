
import express from 'express';
import FotoAtividadeController from '../controllers/FotoAtividadeController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

const fotoAtividadeController = new FotoAtividadeController();

router
    .post('/pastagens/manejos/:id/fotos', AuthMiddleware, asyncWrapper(fotoAtividadeController.createPasto.bind(fotoAtividadeController)))
    .post('/rebanhos/manejos/:id/fotos', AuthMiddleware, asyncWrapper(fotoAtividadeController.createRebanho.bind(fotoAtividadeController)))
    .get('/manejos/fotos', AuthMiddleware, asyncWrapper(fotoAtividadeController.list.bind(fotoAtividadeController)))
    .delete('/manejos/fotos/:id', AuthMiddleware, asyncWrapper(fotoAtividadeController.remove.bind(fotoAtividadeController)));

export default router;
