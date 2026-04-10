import { Router } from 'express';
import { analyzeGardenHandler, generatePlanHandler, diagnosticsHandler, testFluxHandler } from '../controllers/ai.controller.js';
import { uploadPhotos } from '../middleware/upload.js';
import { generateCarePlan, getAllCareGuides, getCareGuide } from '../services/care-ai.service.js';

export const aiRouter = Router();

// AI diagnostics — check all service dependencies
aiRouter.get('/diagnostics', diagnosticsHandler);

// Flux Fill end-to-end test (tiny image, ~$0.001 cost)
aiRouter.get('/test-flux', testFluxHandler);

// AI garden analysis (supports optional photo upload)
aiRouter.post('/analyze-garden', uploadPhotos, analyzeGardenHandler);

// AI garden plan generation with Doubao image generation
aiRouter.post('/generate-plan', uploadPhotos, generatePlanHandler);

// AI care guides
aiRouter.get('/care', async (_req, res) => {
  try {
    const guides = getAllCareGuides();
    res.json({ success: true, data: guides });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
});

aiRouter.get('/care/:species', async (req, res) => {
  try {
    const plan = generateCarePlan(req.params.species);
    if (!plan) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '未找到该树种养护指南' } });
    }
    res.json({ success: true, data: plan });
  } catch {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器错误' } });
  }
});
