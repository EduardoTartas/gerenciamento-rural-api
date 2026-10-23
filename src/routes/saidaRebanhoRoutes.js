
import express from 'express';
import SaidaRebanhoController from '../controllers/SaidaRebanhoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const saidaRebanhoController = new SaidaRebanhoController();

router
    .get('/rebanhos/saidas',     AuthMiddleware, asyncWrapper(saidaRebanhoController.list.bind(saidaRebanhoController)))
    .get('/rebanhos/saidas/:id', AuthMiddleware, asyncWrapper(saidaRebanhoController.list.bind(saidaRebanhoController)))
    .post('/rebanhos/saidas',    AuthMiddleware, asyncWrapper(saidaRebanhoController.create.bind(saidaRebanhoController)));

export default router;
