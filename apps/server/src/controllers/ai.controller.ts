import type { Request, Response } from 'express';
import { analyzeGarden } from '../services/garden-ai.service.js';

/**
 * POST /api/v1/ai/analyze-garden
 * Body: { message: string, photos?: string[] }
 * or multipart with photos field
 */
export async function analyzeGardenHandler(req: Request, res: Response) {
  try {
    const { message, photos } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供您的庭院需求描述' },
      });
    }

    // Collect photo URLs from uploaded files or body
    let photoUrls: string[] = [];
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      photoUrls = files.map((f) => `/uploads/inquiries/${f.filename}`);
    } else if (Array.isArray(photos)) {
      photoUrls = photos;
    }

    const result = await analyzeGarden(message.trim(), photoUrls);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: 'AI分析服务暂时不可用，请稍后重试' },
    });
  }
}
