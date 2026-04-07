import { Router } from 'express';
import { createInquiry, listInquiries } from '../controllers/inquiry.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const inquiryRouter = Router();

// Public
inquiryRouter.post('/', createInquiry);

// Admin
inquiryRouter.get('/', requireAuth, listInquiries);
