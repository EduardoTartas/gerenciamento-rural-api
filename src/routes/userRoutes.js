// src/routes/userRoutes.js

import express from 'express';
import UserController from '../controllers/UserController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

const userController = new UserController();

router
    .get('/users', AuthMiddleware, asyncWrapper(userController.list.bind(userController)))
    .get('/users/:id', AuthMiddleware, asyncWrapper(userController.list.bind(userController)))
    .patch('/users/:id', AuthMiddleware, asyncWrapper(userController.update.bind(userController)))
    .delete('/users/:id', AuthMiddleware, asyncWrapper(userController.remove.bind(userController)));

export default router;
