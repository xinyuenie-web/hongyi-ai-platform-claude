import { Router } from 'express';
import { createOrder, listOrders, getOrder, updateOrder, addLogisticsNode } from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const orderRouter = Router();

// Public
orderRouter.post('/', createOrder);
orderRouter.get('/:orderNo', getOrder);

// Admin
orderRouter.get('/', requireAuth, listOrders);
orderRouter.put('/:orderNo', requireAuth, updateOrder);
orderRouter.post('/:orderNo/logistics', requireAuth, addLogisticsNode);
