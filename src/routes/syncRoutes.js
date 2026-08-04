// src/routes/syncRoutes.js

import express from 'express';
import SyncController from '../controllers/SyncController.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';
import { asyncWrapper } from '../utils/helpers/index.js';

const router = express.Router();
const syncController = new SyncController();

router.post(
    '/sync',
    AuthMiddleware,
    asyncWrapper(syncController.aplicar.bind(syncController)),
);

export default router;
