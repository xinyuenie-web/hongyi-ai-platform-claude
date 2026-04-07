import { Request, Response } from 'express';
import { z } from 'zod';
import { Inquiry } from '../models/inquiry.model.js';
import { Customer } from '../models/customer.model.js';
import { asyncHandler } from '../middleware/error.js';
import type { ApiResponse } from '@hongyi/shared';

const createInquirySchema = z.object({
  name: z.string().min(1, '请输入姓名'),
  phone: z.string().min(1, '请输入手机号'),
  wechatId: z.string().optional(),
  message: z.string().min(1, '请输入留言内容'),
  treeId: z.string().optional(),
});

/** POST /api/v1/inquiries - Create inquiry */
export const createInquiry = asyncHandler(async (req: Request, res: Response) => {
  const data = createInquirySchema.parse(req.body);

  // Create inquiry
  const inquiry = await Inquiry.create({
    ...data,
    source: 'website_form',
    status: 'pending',
  });

  // Upsert customer record
  await Customer.findOneAndUpdate(
    { phone: data.phone },
    {
      $set: { name: data.name, wechatId: data.wechatId },
      $setOnInsert: {
        level: 'lead',
        source: 'website_form',
        tags: ['官网咨询'],
      },
    },
    { upsert: true },
  );

  const response: ApiResponse<{ id: string }> = {
    success: true,
    data: { id: inquiry._id.toString() },
  };
  res.status(201).json(response);
});

/** GET /api/v1/inquiries - List inquiries (admin) */
export const listInquiries = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const [inquiries, total] = await Promise.all([
    Inquiry.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Inquiry.countDocuments(),
  ]);

  const response: ApiResponse<any[]> = {
    success: true,
    data: inquiries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
  res.json(response);
});
