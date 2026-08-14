// src/routes/uploadRoutes.js

import express from 'express';
import UploadController from '../controllers/UploadController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();

const uploadController = new UploadController();

router
    .post('/uploads/imagens', AuthMiddleware, asyncWrapper(uploadController.create.bind(uploadController)));

export default router;
