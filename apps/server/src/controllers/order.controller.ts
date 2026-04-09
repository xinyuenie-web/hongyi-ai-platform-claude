import type { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/order.model.js';
import { Tree } from '../models/tree.model.js';

function generateOrderNo(): string {
  const date = new Date();
  const prefix = 'HY';
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${dateStr}${rand}`;
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  treeIds: z.array(z.string()).min(1, '请选择至少一棵树木'),
  shippingAddress: z.string().min(1, '请输入收货地址'),
  designId: z.string().optional(),
});

/** POST /api/v1/orders - Create order (public) */
export async function createOrder(req: Request, res: Response) {
  try {
    const data = createSchema.parse(req.body);

    // Calculate total from tree prices
    const trees = await Tree.find({ treeId: { $in: data.treeIds } }).lean();
    const totalAmount = trees.reduce((sum, t) => sum + (t.price.sale + (t.price.excavation || 0) + (t.price.packaging || 0)), 0);

    const order = await Order.create({
      orderNo: generateOrderNo(),
      customerId: data.phone, // use phone as customer ID for now
      treeIds: data.treeIds,
      designId: data.designId,
      totalAmount,
      payStatus: 'unpaid',
      status: 'pending',
      shippingAddress: data.shippingAddress,
      logistics: [],
    });

    // Mark trees as reserved
    await Tree.updateMany(
      { treeId: { $in: data.treeIds }, status: 'available' },
      { $set: { status: 'reserved' } },
    );

    res.status(201).json({ success: true, data: order });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message || '验证失败' },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** GET /api/v1/orders - List orders (admin) */
export async function listOrders(req: Request, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit as string)).lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, data: orders, pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** GET /api/v1/orders/:orderNo - Get order detail */
export async function getOrder(req: Request, res: Response) {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo }).lean();
    if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** PUT /api/v1/orders/:orderNo - Update order (admin) */
export async function updateOrder(req: Request, res: Response) {
  try {
    const order = await Order.findOneAndUpdate(
      { orderNo: req.params.orderNo },
      { $set: req.body },
      { new: true },
    );
    if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** POST /api/v1/orders/:orderNo/logistics - Add logistics node (admin) */
export async function addLogisticsNode(req: Request, res: Response) {
  try {
    const { step, description, media } = req.body;
    const order = await Order.findOneAndUpdate(
      { orderNo: req.params.orderNo },
      {
        $push: { logistics: { step, description, media: media || [], timestamp: new Date().toISOString() } },
      },
      { new: true },
    );
    if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } });
    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}
