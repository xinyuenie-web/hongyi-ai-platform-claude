import { Router } from 'express';
import { createInquiry, listInquiries } from '../controllers/inquiry.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadPhotos } from '../middleware/upload.js';

export const inquiryRouter = Router();

// Public - supports multipart/form-data with photos
inquiryRouter.post('/', uploadPhotos, createInquiry);

// Admin
inquiryRouter.get('/', requireAuth, listInquiries);
