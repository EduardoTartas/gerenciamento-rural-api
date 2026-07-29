// src/routes/catalogoRoutes.js

import express from 'express';
import CatalogoController from '../controllers/CatalogoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const catalogoController = new CatalogoController();

/**
 * Rotas de Catálogos Globais.
 *
 * Entidades disponíveis em :entidade:
 *   racas, sistemas-producao,
 *   regimes-alimentares, tipos-manejo-rebanho, tipos-manejo-pasto
 *
 * Somente leitura: catálogos são compartilhados entre todos os usuários e mantidos
 * via seed (prisma/seeds). Não existe perfil administrativo no sistema — escrever
 * aqui exigiria um usuário autenticado qualquer alterar dado usado por todos.
 */
router
    .get('/catalogos/:entidade',        AuthMiddleware, asyncWrapper(catalogoController.list.bind(catalogoController)))
    .get('/catalogos/:entidade/:id',    AuthMiddleware, asyncWrapper(catalogoController.list.bind(catalogoController)));

export default router;
