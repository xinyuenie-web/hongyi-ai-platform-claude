import { Router } from 'express';
import { createQuotation, getQuotation, listQuotations, updateQuotation, getStandardServices } from '../controllers/quotation.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const quotationRouter = Router();

// Public
quotationRouter.post('/', createQuotation);
quotationRouter.get('/services/list', getStandardServices);
quotationRouter.get('/:quotationNo', getQuotation);

// Admin
quotationRouter.get('/', requireAuth, listQuotations);
quotationRouter.put('/:quotationNo', requireAuth, updateQuotation);
