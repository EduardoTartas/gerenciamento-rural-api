
import express from 'express';
import CatalogoController from '../controllers/CatalogoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';
import AdminMiddleware from '../middlewares/AdminMiddleware.js';

const router = express.Router();
const catalogoController = new CatalogoController();

router
    .get('/catalogos/:entidade',        AuthMiddleware, asyncWrapper(catalogoController.list.bind(catalogoController)))
    .get('/catalogos/:entidade/:id',    AuthMiddleware, asyncWrapper(catalogoController.list.bind(catalogoController)))
    .post('/catalogos/:entidade',       AuthMiddleware, AdminMiddleware, asyncWrapper(catalogoController.create.bind(catalogoController)))
    .patch('/catalogos/:entidade/:id',  AuthMiddleware, AdminMiddleware, asyncWrapper(catalogoController.update.bind(catalogoController)))
    .delete('/catalogos/:entidade/:id', AuthMiddleware, AdminMiddleware, asyncWrapper(catalogoController.remove.bind(catalogoController)));

export default router;
