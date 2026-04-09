import type { Request, Response } from 'express';
import { z } from 'zod';
import { Appointment } from '../models/appointment.model.js';

const createSchema = z.object({
  name: z.string().min(1, '请输入姓名'),
  phone: z.string().min(1, '请输入手机号'),
  wechatId: z.string().optional(),
  type: z.enum(['view_tree', 'live_stream', 'site_visit', 'consultation']).default('view_tree'),
  date: z.string().min(1, '请选择预约日期'),
  timeSlot: z.string().min(1, '请选择预约时段'),
  treeIds: z.array(z.string()).optional(),
  message: z.string().optional(),
});

/** POST /api/v1/appointments - Create appointment (public) */
export async function createAppointment(req: Request, res: Response) {
  try {
    const data = createSchema.parse(req.body);
    const appointment = await Appointment.create({ ...data, status: 'pending' });
    res.status(201).json({ success: true, data: appointment });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message || '输入验证失败' },
      });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** GET /api/v1/appointments - List appointments (admin) */
export async function listAppointments(req: Request, res: Response) {
  try {
    const { status, date, page = '1', limit = '20' } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (date) filter.date = date;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [appointments, total] = await Promise.all([
      Appointment.find(filter).sort({ date: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit as string)).lean(),
      Appointment.countDocuments(filter),
    ]);

    res.json({ success: true, data: appointments, pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** PUT /api/v1/appointments/:id - Update appointment (admin) */
export async function updateAppointment(req: Request, res: Response) {
  try {
    const updated = await Appointment.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '预约不存在' } });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}

/** GET /api/v1/appointments/available-slots?date=2026-04-15 - Get available time slots */
export async function getAvailableSlots(req: Request, res: Response) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: { code: 'MISSING_DATE', message: '请提供日期' } });

    const allSlots = [
      '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00',
    ];

    // Count bookings per slot
    const bookings = await Appointment.find({
      date: date as string,
      status: { $in: ['pending', 'confirmed'] },
    }).lean();

    const slotCounts: Record<string, number> = {};
    bookings.forEach((b) => {
      slotCounts[b.timeSlot] = (slotCounts[b.timeSlot] || 0) + 1;
    });

    const maxPerSlot = 3; // max 3 appointments per slot
    const slots = allSlots.map((slot) => ({
      time: slot,
      available: (slotCounts[slot] || 0) < maxPerSlot,
      remaining: maxPerSlot - (slotCounts[slot] || 0),
    }));

    res.json({ success: true, data: slots });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
}
