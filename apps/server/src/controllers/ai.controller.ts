import type { Request, Response } from 'express';
import { analyzeGarden } from '../services/garden-ai.service.js';
import { gardenPhotoToBase64 } from '../services/doubao-vision.service.js';
import { Tree } from '../models/tree.model.js';
import { GardenStyle } from '../models/garden-style.model.js';
import { Inquiry } from '../models/inquiry.model.js';
import * as inT from '../services/int-transformer.service.js';
import * as ouT from '../services/out-transformer.service.js';

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
      DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY ? `${process.env.DASHSCOPE_API_KEY.slice(0, 8)}...` : 'NOT SET',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.slice(0, 8)}...` : 'NOT SET',
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

  // Model router health (inT layer)
  results.modelRouter = inT.getModelHealthStatus();

  // Cutout cache status
  try {
    const fs = await import('fs');
    const path = await import('path');
    const cutoutsDir = path.join(process.cwd(), 'uploads', 'cutouts');
    const cached = fs.existsSync(cutoutsDir)
      ? fs.readdirSync(cutoutsDir).filter((f: string) => /^HY\d+\.png$/i.test(f) && fs.statSync(path.join(cutoutsDir, f)).size > 1000).length
      : 0;
    results.cutoutCache = { total: 10, cached, missing: 10 - cached, dir: cutoutsDir };
  } catch {}

  const allOk = Object.values(results.checks).every((c: any) => c.status === 'OK' || c.status === 'SKIP');
  results.overall = allOk ? 'ALL_OK' : 'ISSUES_FOUND';

  return res.json(results);
}

/**
 * GET /api/v1/ai/test-flux
 * End-to-end test of Flux Fill pipeline using a tiny synthetic image.
 * Returns detailed step-by-step results for debugging.
 */
export async function testFluxHandler(_req: Request, res: Response) {
  const steps: Array<{ step: string; status: string; detail?: string; ms?: number }> = [];
  const start = Date.now();

  try {
    // Step 1: Check env
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      steps.push({ step: 'env', status: 'FAIL', detail: 'FAL_KEY not set' });
      return res.json({ success: false, steps });
    }
    steps.push({ step: 'env', status: 'OK', detail: `FAL_KEY: ${falKey.slice(0, 8)}...` });

    // Step 2: Create a tiny test image (64x64 green square) using sharp
    const sharp = (await import('sharp')).default;
    const t2 = Date.now();
    const testImage = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 34, g: 139, b: 34 } },
    }).jpeg().toBuffer();
    const testMask = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 0, b: 0 } },
    }).composite([{
      input: Buffer.from('<svg width="30" height="30"><rect width="30" height="30" fill="white"/></svg>'),
      left: 17, top: 17,
    }]).png().toBuffer();
    steps.push({ step: 'create-test-images', status: 'OK', detail: `image:${testImage.length}b mask:${testMask.length}b`, ms: Date.now() - t2 });

    const imageBase64 = `data:image/jpeg;base64,${testImage.toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${testMask.toString('base64')}`;
    const proxyUrl = process.env.FAL_PROXY_URL;
    const modelId = 'fal-ai/flux-pro/v1/fill';
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Key ${falKey}` };
    const body = JSON.stringify({
      prompt: 'A small green tree with natural leaves',
      image_url: imageBase64,
      mask_url: maskBase64,
      num_images: 1,
      output_format: 'jpeg',
    });

    // Step 3: Try direct fal.run
    const t3 = Date.now();
    let generatedImageUrl: string | null = null;
    try {
      const r = await fetch(`https://fal.run/${modelId}`, {
        method: 'POST', headers, body,
        signal: AbortSignal.timeout(120000),
      });
      const rBody = await r.text();
      if (r.ok) {
        const data = JSON.parse(rBody);
        generatedImageUrl = data.images?.[0]?.url || null;
        steps.push({ step: 'fal-direct', status: 'OK', detail: `Image URL: ${generatedImageUrl?.slice(0, 60)}...`, ms: Date.now() - t3 });
      } else {
        steps.push({ step: 'fal-direct', status: 'FAIL', detail: `HTTP ${r.status}: ${rBody.slice(0, 200)}`, ms: Date.now() - t3 });
      }
    } catch (err: any) {
      steps.push({ step: 'fal-direct', status: 'FAIL', detail: err.message, ms: Date.now() - t3 });
    }

    // Step 3b: Try via proxy if direct failed
    if (!generatedImageUrl && proxyUrl) {
      const t3b = Date.now();
      try {
        const r = await fetch(`${proxyUrl}/fal-sync/${modelId}`, {
          method: 'POST', headers, body,
          signal: AbortSignal.timeout(120000),
        });
        const rBody = await r.text();
        if (r.ok) {
          const data = JSON.parse(rBody);
          generatedImageUrl = data.images?.[0]?.url || null;
          steps.push({ step: 'fal-proxy', status: 'OK', detail: `Image URL: ${generatedImageUrl?.slice(0, 60)}...`, ms: Date.now() - t3b });
        } else {
          steps.push({ step: 'fal-proxy', status: 'FAIL', detail: `HTTP ${r.status}: ${rBody.slice(0, 200)}`, ms: Date.now() - t3b });
        }
      } catch (err: any) {
        steps.push({ step: 'fal-proxy', status: 'FAIL', detail: err.message, ms: Date.now() - t3b });
      }
    }

    if (!generatedImageUrl) {
      steps.push({ step: 'generate', status: 'FAIL', detail: 'No image generated from any endpoint' });
      return res.json({ success: false, steps, totalMs: Date.now() - start });
    }

    // Step 4: Download generated image
    const t4 = Date.now();
    let downloadedSize = 0;

    // Try direct download
    try {
      const r = await fetch(generatedImageUrl, { signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        downloadedSize = buf.length;
        steps.push({ step: 'download-direct', status: 'OK', detail: `${downloadedSize} bytes`, ms: Date.now() - t4 });
      } else {
        steps.push({ step: 'download-direct', status: 'FAIL', detail: `HTTP ${r.status}`, ms: Date.now() - t4 });
      }
    } catch (err: any) {
      steps.push({ step: 'download-direct', status: 'FAIL', detail: err.message, ms: Date.now() - t4 });
    }

    // Try proxy download if direct failed
    if (downloadedSize === 0 && proxyUrl) {
      const t4b = Date.now();
      try {
        const urlObj = new URL(generatedImageUrl);
        const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
        const r = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          downloadedSize = buf.length;
          steps.push({ step: 'download-proxy', status: 'OK', detail: `${downloadedSize} bytes`, ms: Date.now() - t4b });
        } else {
          steps.push({ step: 'download-proxy', status: 'FAIL', detail: `HTTP ${r.status}`, ms: Date.now() - t4b });
        }
      } catch (err: any) {
        steps.push({ step: 'download-proxy', status: 'FAIL', detail: err.message, ms: Date.now() - t4b });
      }
    }

    const allOk = downloadedSize > 0;
    return res.json({ success: allOk, steps, totalMs: Date.now() - start });
  } catch (err: any) {
    steps.push({ step: 'unexpected', status: 'FAIL', detail: err.message });
    return res.json({ success: false, steps, totalMs: Date.now() - start });
  }
}

/**
 * GET /api/v1/ai/test-kontext
 * End-to-end test of Flux Kontext reference-image inpainting pipeline.
 * Uses a tiny synthetic garden image + HY0001 tree photo as reference.
 * Returns detailed step-by-step results for debugging.
 */
export async function testKontextHandler(_req: Request, res: Response) {
  const steps: Array<{ step: string; status: string; detail?: string; ms?: number }> = [];
  const start = Date.now();

  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      steps.push({ step: 'env', status: 'FAIL', detail: 'FAL_KEY not set' });
      return res.json({ success: false, steps });
    }
    steps.push({ step: 'env', status: 'OK' });

    // Step 1: Create a tiny test garden image (128x96 — ground + sky)
    const sharp = (await import('sharp')).default;
    const t1 = Date.now();
    // Sky (top half) + ground (bottom half)
    const skyBuf = await sharp({
      create: { width: 128, height: 48, channels: 3, background: { r: 135, g: 206, b: 235 } },
    }).png().toBuffer();
    const groundBuf = await sharp({
      create: { width: 128, height: 48, channels: 3, background: { r: 139, g: 119, b: 101 } },
    }).png().toBuffer();
    const gardenBuf = await sharp(skyBuf)
      .extend({ bottom: 48, background: { r: 139, g: 119, b: 101 } })
      .jpeg({ quality: 80 })
      .toBuffer();
    steps.push({ step: 'create-garden', status: 'OK', detail: `${gardenBuf.length}b`, ms: Date.now() - t1 });

    // Step 2: Load tree reference image (HY0001)
    const t2 = Date.now();
    let treeBase64: string;
    const fs = await import('fs');
    const path = await import('path');
    // Try local first, then Docker website
    const localPath = path.join(process.cwd(), '..', 'website', 'public', '/images/trees/HY0001.jpg');
    if (fs.existsSync(localPath)) {
      const buf = fs.readFileSync(localPath);
      treeBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
      steps.push({ step: 'load-tree-image', status: 'OK', detail: `local ${buf.length}b`, ms: Date.now() - t2 });
    } else {
      // Fetch from website container
      const fetchRes = await fetch('http://website:3000/images/trees/HY0001.jpg', { signal: AbortSignal.timeout(10000) });
      if (!fetchRes.ok) {
        steps.push({ step: 'load-tree-image', status: 'FAIL', detail: `HTTP ${fetchRes.status} from website:3000` });
        return res.json({ success: false, steps, totalMs: Date.now() - start });
      }
      const buf = Buffer.from(await fetchRes.arrayBuffer());
      treeBase64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
      steps.push({ step: 'load-tree-image', status: 'OK', detail: `docker ${buf.length}b`, ms: Date.now() - t2 });
    }

    // Step 3: Create mask (white rectangle on bottom-right area)
    const t3 = Date.now();
    const maskSvg = Buffer.from(
      `<svg width="128" height="96"><rect width="128" height="96" fill="black"/><ellipse cx="90" cy="55" rx="25" ry="30" fill="white"/></svg>`,
    );
    const maskBuf = await sharp(maskSvg).png().toBuffer();
    steps.push({ step: 'create-mask', status: 'OK', detail: `${maskBuf.length}b`, ms: Date.now() - t3 });

    // Step 4: Call Kontext inpaint
    const t4 = Date.now();
    const gardenBase64 = `data:image/jpeg;base64,${gardenBuf.toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${maskBuf.toString('base64')}`;

    const body = JSON.stringify({
      image_url: gardenBase64,
      mask_url: maskBase64,
      reference_image_url: treeBase64,
      prompt: 'A small ornamental tree naturally planted in the ground',
      num_images: 1,
      output_format: 'jpeg',
      strength: 0.85,
      num_inference_steps: 20,
      sync_mode: true,  // Return image as data URI — no CDN download needed
    });

    let resultData: string | null = null;

    // Try direct fal.run with sync_mode
    try {
      const apiRes = await fetch('https://fal.run/fal-ai/flux-kontext-lora/inpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${falKey}` },
        body,
        signal: AbortSignal.timeout(120000),
      });
      const apiBody = await apiRes.text();
      if (apiRes.ok) {
        const data = JSON.parse(apiBody);
        const imgUrl = data.images?.[0]?.url || '';
        const isDataUri = imgUrl.startsWith('data:');
        const size = isDataUri ? Math.round(imgUrl.length * 0.75) : 0;
        resultData = imgUrl;
        steps.push({ step: 'kontext-sync', status: 'OK', detail: `dataURI:${isDataUri} size:~${size}b`, ms: Date.now() - t4 });
      } else {
        steps.push({ step: 'kontext-sync', status: 'FAIL', detail: `HTTP ${apiRes.status}: ${apiBody.slice(0, 300)}`, ms: Date.now() - t4 });
      }
    } catch (err: any) {
      steps.push({ step: 'kontext-sync', status: 'FAIL', detail: err.message, ms: Date.now() - t4 });
    }

    if (resultData) {
      steps.push({ step: 'result', status: 'OK', detail: 'No CDN download needed (sync_mode)' });
    }

    const allOk = steps.every((s) => s.status === 'OK');
    return res.json({ success: allOk, steps, totalMs: Date.now() - start });
  } catch (err: any) {
    steps.push({ step: 'unexpected', status: 'FAIL', detail: err.message });
    return res.json({ success: false, steps, totalMs: Date.now() - start });
  }
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
 * NEW FLOW:
 * 1. Parallel: Seed-2.0-pro analysis (with coordinates) + rule-based analysis (fallback)
 * 2. Extract tree placement coordinates from AI analysis
 * 3. BiRefNet background removal + Sharp compositing — real tree photos on garden
 * 4. Return: effect image (garden 100% preserved, trees 100% match product photos) + analysis report
 */

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
 * NEW ARCHITECTURE: inT (Input Transformer) + ouT (Output Transformer)
 * 1. inT: Photo + trees + message → Model Router → DesignPlan (standardized JSON)
 * 2. ouT: DesignPlan + garden photo → BiRefNet + Sharp → Effect image
 * 3. Fallback: rule-based analysis if all AI models fail
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

    const files = req.files as Express.Multer.File[] | undefined;
    const gardenPhoto = files?.[0];
    if (!gardenPhoto) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请上传庭院照片' },
      });
    }

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

    // --- Prepare garden photo base64 ---
    let gardenPhotoBase64: string;
    try {
      gardenPhotoBase64 = gardenPhotoToBase64(gardenPhoto.path);
    } catch (err) {
      console.error('Failed to read garden photo for vision:', err);
      gardenPhotoBase64 = '';
    }

    const response: any = {
      generatedImage: null,
      analysis: null,
      aiAnalysis: null,
      modelUsed: null,
    };

    // ============================================================
    // STEP 1: inT — Input Transformer (AI vision + layout preferences)
    // Run in parallel with rule-based analysis as fallback
    // ============================================================
    const analysisMessage = message || `${styleName}风格庭院，选择了${selectedTrees.map((t: any) => t.name).join('、')}`;

    const [intResult, ruleResult] = await Promise.allSettled([
      gardenPhotoBase64
        ? inT.transform({
            gardenPhotoBase64,
            selectedTrees: selectedTrees.map((t: any) => ({
              treeId: t.treeId,
              name: t.name,
              species: t.species,
              coverImage: t.coverImage || '',
              height: t.specs?.height || 200,
              crown: t.specs?.crown || 150,
            })),
            styleName,
            userMessage: message || '',
          })
        : Promise.reject(new Error('Garden photo not available')),
      analyzeGarden(analysisMessage, [gardenPhotoUrl]),
    ]);

    let designPlan: inT.DesignPlan | null = null;

    if (intResult.status === 'fulfilled') {
      designPlan = intResult.value;
      response.aiAnalysis = {
        designSummary: designPlan.designSummary,
        spaceAnalysis: designPlan.spaceAnalysis,
        treePlacement: designPlan.placements,
        styleAdvice: designPlan.styleAdvice,
        fengshuiTip: designPlan.fengshuiTip,
        budgetEstimate: designPlan.budgetEstimate,
        groundTreatment: designPlan.groundTreatment,
      };
      response.modelUsed = designPlan.modelId;
      console.log(`[GeneratePlan] inT succeeded: model=${designPlan.modelId}, ${designPlan.processingMs}ms, ${designPlan.placements.length} placements`);
    } else {
      console.error('[GeneratePlan] inT failed:', intResult.reason?.message || intResult.reason);
    }

    if (ruleResult.status === 'fulfilled') {
      response.analysis = ruleResult.value;
    }

    // ============================================================
    // STEP 2: ouT — Output Transformer (BiRefNet + Sharp compositing)
    // ============================================================
    if (designPlan && process.env.FAL_KEY) {
      try {
        const outResult = await ouT.transform({
          gardenPhotoPath: gardenPhoto.path,
          designPlan,
        });
        response.generatedImage = outResult.imageUrl;
        console.log(`[GeneratePlan] ouT succeeded: ${outResult.strategy}, ${outResult.treeCount} trees, ${outResult.processingMs}ms`);
      } catch (outErr: any) {
        console.error('[GeneratePlan] ouT failed:', outErr.message);
        response.imageError = outErr.message;
      }
    } else if (!designPlan) {
      // Fallback: no AI analysis, use default placements with ouT
      const fallbackPlan = buildFallbackDesignPlan(selectedTrees as any[]);
      if (process.env.FAL_KEY) {
        try {
          const outResult = await ouT.transform({
            gardenPhotoPath: gardenPhoto.path,
            designPlan: fallbackPlan,
          });
          response.generatedImage = outResult.imageUrl;
          console.log(`[GeneratePlan] ouT fallback succeeded: ${outResult.treeCount} trees`);
        } catch (outErr: any) {
          console.error('[GeneratePlan] ouT fallback failed:', outErr.message);
          response.imageError = outErr.message;
        }
      }
    }

    recordUsage(phone);

    if (!response.generatedImage && !response.aiAnalysis && !response.analysis) {
      return res.status(500).json({
        success: false,
        error: { code: 'AI_ERROR', message: 'AI服务暂时不可用，请稍后重试' },
      });
    }

    return res.json({ success: true, data: response });
  } catch (error: any) {
    const errDetail = error?.message || String(error);
    console.error('Generate plan error:', errDetail);
    return res.status(500).json({
      success: false,
      error: { code: 'AI_ERROR', message: `AI方案生成失败: ${errDetail}` },
    });
  }
}

/** Build a fallback DesignPlan when all AI models fail */
function buildFallbackDesignPlan(trees: any[]): inT.DesignPlan {
  const count = Math.min(trees.length, 5);
  const treesToPlace = trees.slice(0, count);
  return {
    modelId: 'fallback',
    processingMs: 0,
    designSummary: '使用默认布局',
    spaceAnalysis: '',
    placements: treesToPlace.map((t, i) => ({
      treeName: t.name,
      treeId: t.treeId,
      coverImage: t.coverImage || '',
      x: 0.1 + (0.8 / (count + 1)) * (i + 1),
      y: 0.82,
      width: 0.22,
      height: 0.35,
      position: '自动分配',
      reason: '默认均匀布局',
    })),
    styleAdvice: '',
    fengshuiTip: '',
    budgetEstimate: '',
  };
}
