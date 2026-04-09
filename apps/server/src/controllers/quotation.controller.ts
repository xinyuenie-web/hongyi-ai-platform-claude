import type { Request, Response } from 'express';
import { z } from 'zod';
import { Quotation } from '../models/quotation.model.js';
import { Tree } from '../models/tree.model.js';

function generateQuotationNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BJ${dateStr}${rand}`;
}

// Standard additional services
const STANDARD_SERVICES = [
  { name: '挖掘包装', description: '专业挖掘、土球包扎、草绳固定', priceRate: 0.08 },
  { name: '专车运输', description: '全程恒温运输，保险覆盖', priceRate: 0.05 },
  { name: '种植施工', description: '专业种植团队上门栽植', priceRate: 0.10 },
  { name: '一年养护', description: '种植后一年免费养护跟踪', priceRate: 0.06 },
];

const createSchema = z.object({
  name: z.string().min(1, '请输入姓名'),
  phone: z.string().min(1, '请输入手机号'),
  treeIds: z.array(z.string()).min(1, '请选择至少一棵树木'),
  serviceNames: z.array(z.string()).optional(),
});

/** POST /api/v1/quotations - Generate quotation (public) */
export async function createQuotation(req: Request, res: Response) {
  try {
    const data = createSchema.parse(req.body);

    // Fetch trees
    const trees = await Tree.find({ treeId: { $in: data.treeIds } }).lean();
    if (trees.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_TREES', message: '未找到选择的树木' } });
    }

    const items = trees.map((t) => ({
      treeId: t.treeId,
      name: t.name,
      species: t.species,
      price: t.price.sale,
      quantity: 1,
    }));

    const treesSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Calculate services
    const selectedServiceNames = data.serviceNames || STANDARD_SERVICES.map((s) => s.name);
    const services = STANDARD_SERVICES
      .filter((s) => selectedServiceNames.includes(s.name))
      .map((s) => ({
        name: s.name,
        description: s.description,
        price: Math.round(treesSubtotal * s.priceRate),
      }));

    const servicesSubtotal = services.reduce((sum, s) => sum + s.price, 0);
    const total = treesSubtotal + servicesSubtotal;

    // Valid for 7 days
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const quotation = await Quotation.create({
      quotationNo: generateQuotationNo(),
      name: data.name,
      phone: data.phone,
      items,
      services,
      treesSubtotal,
      servicesSubtotal,
      total,
      status: 'draft',
      validUntil,
    });

    res.status(201).json({ success: true, data: quotation });
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

/** GET /api/v1/quotations/:quotationNo - Get quotation */
export async function getQuotation(req: Request, res: Response) {
  try {
    const quotation = await Quotation.findOne({ quotationNo: req.params.quotationNo }).lean();
    if (!quotation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '报价不存在' } });
    res.json({ success: true, data: quotation });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** GET /api/v1/quotations - List quotations (admin) */
export async function listQuotations(req: Request, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [quotations, total] = await Promise.all([
      Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit as string)).lean(),
      Quotation.countDocuments(filter),
    ]);

    res.json({ success: true, data: quotations, pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** PUT /api/v1/quotations/:quotationNo - Update quotation (admin) */
export async function updateQuotation(req: Request, res: Response) {
  try {
    const quotation = await Quotation.findOneAndUpdate(
      { quotationNo: req.params.quotationNo },
      { $set: req.body },
      { new: true },
    );
    if (!quotation) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '报价不存在' } });
    res.json({ success: true, data: quotation });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** GET /api/v1/quotations/services/list - Get standard services */
export async function getStandardServices(_req: Request, res: Response) {
  res.json({
    success: true,
    data: STANDARD_SERVICES.map((s) => ({ name: s.name, description: s.description, ratePercent: s.priceRate * 100 })),
  });
}
