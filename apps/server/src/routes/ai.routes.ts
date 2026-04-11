import { Router } from 'express';
import { analyzeGardenHandler, generatePlanHandler, diagnosticsHandler, testFluxHandler, testKontextHandler } from '../controllers/ai.controller.js';
import { uploadPhotos } from '../middleware/upload.js';
import { generateCarePlan, getAllCareGuides, getCareGuide } from '../services/care-ai.service.js';

export const aiRouter = Router();

// AI diagnostics — check all service dependencies
aiRouter.get('/diagnostics', diagnosticsHandler);

// Serve AI-generated images via /api/v1/ai/image/:filename
// nginx ^~ /api prefix ensures this reaches Express even for .jpg URLs
aiRouter.get('/image/:filename', (req, res) => {
  const { filename } = req.params;
  if (!/^[\w.-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = require('path').join(process.cwd(), 'uploads', 'ai-generated', filename);
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(filePath, (err: any) => {
    if (err) res.status(404).json({ error: 'Image not found' });
  });
});

// Serve debug images (mask, input, output, reference) for troubleshooting
aiRouter.get('/debug/:filename', (req, res) => {
  const { filename } = req.params;
  if (!/^[\w.-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = require('path').join(process.cwd(), 'uploads', 'ai-debug', filename);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(filePath, (err: any) => {
    if (err) res.status(404).json({ error: 'Debug image not found' });
  });
});

// List all debug images
aiRouter.get('/debug', (_req, res) => {
  const debugDir = require('path').join(process.cwd(), 'uploads', 'ai-debug');
  const fs = require('fs');
  try {
    if (!fs.existsSync(debugDir)) {
      return res.json({ files: [], hint: 'No debug images yet. Generate a plan first.' });
    }
    const files = fs.readdirSync(debugDir)
      .filter((f: string) => /\.(jpg|png)$/.test(f))
      .map((f: string) => ({
        name: f,
        url: `/api/v1/ai/debug/${f}`,
        size: fs.statSync(require('path').join(debugDir, f)).size,
      }));
    return res.json({ files });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Flux Fill end-to-end test (tiny image, ~$0.001 cost)
aiRouter.get('/test-flux', testFluxHandler);

// Kontext inpaint end-to-end test (uses HY0001 tree as reference, ~$0.03 cost)
aiRouter.get('/test-kontext', testKontextHandler);

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
