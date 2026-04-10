import type { Request, Response } from 'express';
import { analyzeGarden } from '../services/garden-ai.service.js';
import { analyzeGardenWithAI, gardenPhotoToBase64 } from '../services/doubao-vision.service.js';
import { fluxFillAddTrees } from '../services/flux-fill.service.js';
import { Tree } from '../models/tree.model.js';
import { GardenStyle } from '../models/garden-style.model.js';
import { Inquiry } from '../models/inquiry.model.js';

/**
 * GET /api/v1/ai/diagnostics
 * Check all AI service dependencies and report their status.
 * No auth required — useful for quick troubleshooting.
 */
export async function diagnosticsHandler(_req: Request, res: Response) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      FAL_KEY: process.env.FAL_KEY ? `${process.env.FAL_KEY.slice(0, 8)}...` : 'NOT SET',
      FAL_PROXY_URL: process.env.FAL_PROXY_URL || 'NOT SET',
      DOUBAO_VISION_API_KEY: process.env.DOUBAO_VISION_API_KEY || process.env.DOUBAO_API_KEY ? 'SET' : 'NOT SET',
      DOUBAO_VISION_MODEL: process.env.DOUBAO_VISION_MODEL || 'doubao-seed-2-0-pro-260215 (default)',
    },
    checks: {} as Record<string, any>,
  };

  // Check 1: HK Proxy health (longer timeout - proxy can be slow to connect)
  const proxyUrl = process.env.FAL_PROXY_URL;
  if (proxyUrl) {
    try {
      const r = await fetch(`${proxyUrl}/health`, { signal: AbortSignal.timeout(15000) });
      const body = await r.text();
      results.checks.hkProxy = { status: 'OK', response: body, url: proxyUrl };
    } catch (err: any) {
      results.checks.hkProxy = { status: 'FAIL', error: err.message, url: proxyUrl,
        hint: '香港代理不可达。请检查: 1) HK服务器nginx是否运行 2) 腾讯云安全组是否开放8462端口 3) 防火墙设置' };
    }
  } else {
    results.checks.hkProxy = { status: 'SKIP', hint: 'FAL_PROXY_URL not configured' };
  }

  // Check 2a: fal.ai via proxy
  if (process.env.FAL_KEY && proxyUrl) {
    const proxyTestUrl = `${proxyUrl}/fal-sync/fal-ai/flux-pro/v1/fill`;
    try {
      const r = await fetch(proxyTestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${process.env.FAL_KEY}` },
        body: JSON.stringify({ prompt: 'test' }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await r.text().catch(() => '');
      if (r.status === 422) {
        results.checks.falViaProxy = { status: 'OK', detail: 'Proxy→fal.run works (422 = expected)' };
      } else if (r.status === 401 || r.status === 403) {
        results.checks.falViaProxy = { status: 'AUTH_FAIL', httpStatus: r.status, body: body.slice(0, 200) };
      } else {
        results.checks.falViaProxy = { status: 'UNEXPECTED', httpStatus: r.status, body: body.slice(0, 200) };
      }
    } catch (err: any) {
      results.checks.falViaProxy = { status: 'FAIL', error: err.message, hint: '通过HK代理访问fal.ai失败' };
    }
  }

  // Check 2b: fal.ai DIRECT (without proxy — test if accessible from China)
  if (process.env.FAL_KEY) {
    try {
      const r = await fetch('https://fal.run/fal-ai/flux-pro/v1/fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${process.env.FAL_KEY}` },
        body: JSON.stringify({ prompt: 'test' }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await r.text().catch(() => '');
      if (r.status === 422) {
        results.checks.falDirect = { status: 'OK', detail: 'Direct fal.run works! Proxy may not be needed.' };
      } else if (r.status === 401 || r.status === 403) {
        results.checks.falDirect = { status: 'AUTH_FAIL', httpStatus: r.status, body: body.slice(0, 200) };
      } else {
        results.checks.falDirect = { status: 'UNEXPECTED', httpStatus: r.status, body: body.slice(0, 200) };
      }
    } catch (err: any) {
      results.checks.falDirect = { status: 'FAIL', error: err.message, hint: '直连fal.ai不可用(预期, 中国需代理)' };
    }
  } else {
    results.checks.falDirect = { status: 'SKIP', hint: 'FAL_KEY not configured' };
  }

  // Check 3: Doubao Vision API
  const doubaoKey = process.env.DOUBAO_VISION_API_KEY || process.env.DOUBAO_API_KEY;
  if (doubaoKey) {
    try {
      const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doubaoKey}` },
        body: JSON.stringify({ model: process.env.DOUBAO_VISION_MODEL || 'doubao-seed-2-0-pro-260215', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        results.checks.doubaoVision = { status: 'OK' };
      } else {
        const body = await r.text().catch(() => '');
        results.checks.doubaoVision = { status: 'FAIL', httpStatus: r.status, body: body.slice(0, 200) };
      }
    } catch (err: any) {
      results.checks.doubaoVision = { status: 'FAIL', error: err.message };
    }
  } else {
    results.checks.doubaoVision = { status: 'SKIP', hint: 'DOUBAO_VISION_API_KEY not configured' };
  }

  const allOk = Object.values(results.checks).every((c: any) => c.status === 'OK' || c.status === 'SKIP');
  results.overall = allOk ? 'ALL_OK' : 'ISSUES_FOUND';

  return res.json(results);
}

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

// Simple in-memory rate limiter: phone -> [timestamps]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 3; // max 3 per day per phone
const RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(phone) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  rateLimitMap.set(phone, recent);
  return recent.length < RATE_LIMIT;
}

function recordUsage(phone: string) {
  const timestamps = rateLimitMap.get(phone) || [];
  timestamps.push(Date.now());
  rateLimitMap.set(phone, timestamps);
}

/**
 * POST /api/v1/ai/generate-plan
 * Multipart form data:
 *  - name (string, required)
 *  - phone (string, required)
 *  - styleId (string, optional)
 *  - photos (file, required — garden photo)
 *  - treeIds (JSON string array, required)
 *  - message (string, optional)
 *
 * NEW FLOW (serial, because Flux Fill depends on AI analysis results):
 * 1. Parallel: Seed-2.0-pro analysis (with coordinates) + rule-based analysis (fallback)
 * 2. Extract tree placement coordinates from AI analysis
 * 3. Call Flux Fill (original photo + mask from coordinates + prompt) — TRUE inpainting
 * 4. Return: effect image (original preserved!) + analysis report
 */
export async function generatePlanHandler(req: Request, res: Response) {
  try {
    const { name, phone, styleId, treeIds: treeIdsStr, message } = req.body;

    // --- Validation ---
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请输入您的姓名' },
      });
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请输入正确的手机号' },
      });
    }
    let treeIds: string[];
    try {
      treeIds = JSON.parse(treeIdsStr || '[]');
      if (!Array.isArray(treeIds) || treeIds.length === 0) {
        throw new Error();
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请选择至少一棵树木' },
      });
    }

    // Check garden photo
    const files = req.files as Express.Multer.File[] | undefined;
    const gardenPhoto = files?.[0];
    if (!gardenPhoto) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请上传庭院照片' },
      });
    }

    // Rate limit
    if (!checkRateLimit(phone)) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT', message: '每天最多生成3次AI方案，请明天再试' },
      });
    }

    // --- Fetch data ---
    const [selectedTrees, style] = await Promise.all([
      Tree.find({ treeId: { $in: treeIds } }).lean(),
      styleId ? GardenStyle.findOne({ styleId }).lean() : Promise.resolve(null),
    ]);

    const styleName = (style as any)?.name || '自然';
    const styleType = (style as any)?.type || 'chinese';

    if (selectedTrees.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到所选树木' },
      });
    }

    // --- Save inquiry (留资) ---
    const gardenPhotoUrl = `/uploads/inquiries/${gardenPhoto.filename}`;
    Inquiry.create({
      name: name.trim(),
      phone,
      message: message || `AI方案生成 - ${styleName} - ${selectedTrees.map((t: any) => t.name).join('、')}`,
      photos: [gardenPhotoUrl],
      source: 'website_form',
    }).catch((err: Error) => console.error('Failed to save inquiry:', err));

    // --- Prepare data ---
    const treeInfos = selectedTrees.map((t: any) => ({
      name: t.name,
      species: t.species,
      height: t.specs?.height || 200,
      crown: t.specs?.crown || 150,
    }));

    const analysisMessage = message || `${styleName}风格庭院，选择了${selectedTrees.map((t: any) => t.name).join('、')}`;

    // Prepare garden photo base64 for vision model
    let gardenPhotoBase64: string;
    try {
      gardenPhotoBase64 = gardenPhotoToBase64(gardenPhoto.path);
    } catch (err) {
      console.error('Failed to read garden photo for vision:', err);
      gardenPhotoBase64 = '';
    }

    // ============================================================
    // STEP 1: Parallel — AI vision analysis + rule-based analysis
    // ============================================================
    console.log('[GeneratePlan] Step 1: Running AI analysis + rule-based analysis in parallel...');
    const [visionResult, ruleResult] = await Promise.allSettled([
      gardenPhotoBase64
        ? analyzeGardenWithAI({
            gardenPhotoBase64,
            treeInfos,
            styleName,
            userMessage: message || '',
          })
        : Promise.reject(new Error('Garden photo not available for vision')),
      analyzeGarden(analysisMessage, [gardenPhotoUrl]),
    ]);

    const response: any = {
      generatedImage: null,
      analysis: null,
      aiAnalysis: null,
      prompt: null,
    };

    // AI vision analysis result
    if (visionResult.status === 'fulfilled') {
      response.aiAnalysis = visionResult.value;
      console.log('[GeneratePlan] Seed-2.0-pro AI analysis succeeded');
    } else {
      console.error('[GeneratePlan] Seed-2.0-pro analysis failed:', visionResult.reason?.message || visionResult.reason);
    }

    // Rule-based analysis (always useful as fallback)
    if (ruleResult.status === 'fulfilled') {
      response.analysis = ruleResult.value;
      console.log('[GeneratePlan] Rule-based analysis succeeded');
    } else {
      console.error('[GeneratePlan] Rule-based analysis failed:', ruleResult.reason?.message || ruleResult.reason);
    }

    // ============================================================
    // STEP 2: Extract tree placement coordinates for Flux Fill
    // ============================================================
    let treePlacements: Array<{ treeName: string; x: number; y: number; width: number; height: number }> = [];

    if (visionResult.status === 'fulfilled' && visionResult.value.treePlacement) {
      // Use AI-analyzed coordinates
      treePlacements = visionResult.value.treePlacement
        .filter((tp) => typeof tp.x === 'number' && typeof tp.y === 'number' && typeof tp.width === 'number' && typeof tp.height === 'number')
        .map((tp) => ({
          treeName: tp.treeName,
          x: Math.max(0, Math.min(1, tp.x)),
          y: Math.max(0, Math.min(1, tp.y)),
          width: Math.max(0.05, Math.min(0.5, tp.width)),
          height: Math.max(0.1, Math.min(0.6, tp.height)),
        }));
      console.log(`[GeneratePlan] Got ${treePlacements.length} tree placements from AI analysis`);
    }

    // Fallback: if AI didn't provide coordinates, generate default placements
    if (treePlacements.length === 0) {
      console.log('[GeneratePlan] No AI coordinates, using default placements');
      const count = treeInfos.length;
      treePlacements = treeInfos.map((t, i) => ({
        treeName: t.name,
        // Distribute trees evenly across the lower portion of the image
        x: 0.1 + (0.7 / (count + 1)) * (i + 1) - 0.1,
        y: 0.35,
        width: 0.2,
        height: 0.45,
      }));
    }

    // ============================================================
    // STEP 3: Call Flux Fill (inpainting) — preserves original photo!
    // ============================================================
    if (process.env.FAL_KEY) {
      console.log('[GeneratePlan] Step 3: Calling Flux Fill for inpainting...');
      try {
        const fluxResult = await fluxFillAddTrees({
          gardenPhotoPath: gardenPhoto.path,
          treePlacements,
          styleName,
          userMessage: message || '',
        });
        response.generatedImage = fluxResult.imageUrl;
        response.prompt = fluxResult.prompt;
        console.log('[GeneratePlan] Flux Fill image generated successfully!');
      } catch (fluxErr: any) {
        console.error('[GeneratePlan] Flux Fill failed:', fluxErr.message || fluxErr);
        // Flux Fill failed, but we still have analysis results
      }
    } else {
      console.warn('[GeneratePlan] FAL_KEY not configured, skipping image generation');
    }

    // Record usage
    recordUsage(phone);

    // At least one result should be available
    if (!response.generatedImage && !response.aiAnalysis && !response.analysis) {
      return res.status(500).json({
        success: false,
        error: { code: 'AI_ERROR', message: 'AI服务暂时不可用，请稍后重试' },
      });
    }

    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Generate plan error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: 'AI方案生成失败，请稍后重试' },
    });
  }
}
