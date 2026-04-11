import type { Request, Response } from 'express';
import { analyzeGarden } from '../services/garden-ai.service.js';
import { analyzeGardenWithAI, gardenPhotoToBase64 } from '../services/doubao-vision.service.js';
import { fluxFillAddTrees } from '../services/flux-fill.service.js';
import { compositeTreesOnGarden } from '../services/tree-composite.service.js';
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
    // STEP 2: Build tree placements with coordinates + cover images
    // ============================================================
    // Each placement needs: treeName, coverImage, x, y, width, height
    // We build a unified list that has both coordinates AND image URLs
    // so we don't need to match names later (which is error-prone).
    interface TreePlacement {
      treeName: string;
      coverImage: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }

    // Helper: fuzzy match AI tree name to our selected trees
    function findTreeByName(aiName: string): any {
      // Exact match
      let tree = selectedTrees.find((t: any) => t.name === aiName);
      if (tree) return tree;
      // Partial match: AI name contains DB name or vice versa
      tree = selectedTrees.find((t: any) => t.name.includes(aiName) || aiName.includes(t.name));
      if (tree) return tree;
      // Species match
      tree = selectedTrees.find((t: any) => t.species === aiName || aiName.includes(t.species));
      return tree || null;
    }

    let treePlacements: TreePlacement[] = [];
    const usedTreeIds = new Set<string>(); // prevent duplicates

    if (visionResult.status === 'fulfilled' && visionResult.value.treePlacement) {
      // Use AI-analyzed coordinates — enrich with cover images immediately
      for (const tp of visionResult.value.treePlacement) {
        if (typeof tp.x !== 'number' || typeof tp.y !== 'number' ||
            typeof tp.width !== 'number' || typeof tp.height !== 'number') continue;

        const tree = findTreeByName(tp.treeName);
        const treeId = (tree as any)?.treeId;
        if (treeId && usedTreeIds.has(treeId)) continue; // skip duplicate
        if (treeId) usedTreeIds.add(treeId);

        // AI returns x,y as top-left corner. Convert to our convention:
        // x = center of tree, y = ground level (bottom of tree)
        const clampedW = Math.max(0.05, Math.min(0.18, tp.width));
        const clampedH = Math.max(0.08, Math.min(0.40, tp.height));
        const centerX = Math.max(0.05, Math.min(0.95, tp.x + clampedW / 2));
        const groundY = Math.max(0.60, Math.min(0.92, tp.y + clampedH));

        treePlacements.push({
          treeName: (tree as any)?.name || tp.treeName,
          coverImage: (tree as any)?.coverImage || '',
          x: centerX,
          y: groundY,
          width: clampedW,
          height: clampedH,
        });
      }
      console.log(`[GeneratePlan] Got ${treePlacements.length} tree placements from AI (matched ${treePlacements.filter(p => p.coverImage).length} images)`);

      // If AI didn't place all selected trees, add remaining with auto coordinates
      for (const t of selectedTrees as any[]) {
        if (usedTreeIds.has(t.treeId)) continue;
        if (treePlacements.length >= 5) break;
        usedTreeIds.add(t.treeId);
        const idx = treePlacements.length;
        treePlacements.push({
          treeName: t.name,
          coverImage: t.coverImage || '',
          // x = center of tree, y = ground level (bottom of tree)
          x: 0.05 + (0.85 / 6) * (idx + 1),
          y: 0.82,   // ground level — most garden photos have ground at ~80% height
          width: 0.15,
          height: 0.35,
        });
      }
    }

    // Limit to max 5 placements
    if (treePlacements.length > 5) {
      treePlacements = treePlacements.slice(0, 5);
    }

    // Fallback: if no AI coordinates at all, generate default placements
    if (treePlacements.length === 0) {
      console.log('[GeneratePlan] No AI coordinates, using default placements');
      const count = Math.min(selectedTrees.length, 5);
      const treesToPlace = (selectedTrees as any[]).slice(0, count);
      treePlacements = treesToPlace.map((t, i) => ({
        treeName: t.name,
        coverImage: t.coverImage || '',
        // x = center of tree, y = ground level (bottom of tree)
        x: 0.1 + (0.8 / (count + 1)) * (i + 1),
        y: 0.82,
        width: 0.15,
        height: 0.35,
      }));
    }

    console.log('[GeneratePlan] Final placements:', treePlacements.map(p =>
      `${p.treeName} (img:${p.coverImage ? 'yes' : 'NO'}) @(${p.x.toFixed(2)},${p.y.toFixed(2)} ${p.width.toFixed(2)}x${p.height.toFixed(2)})`
    ));

    // ============================================================
    // STEP 3: Generate effect image
    // Strategy A (primary): Composite real tree photos onto garden
    //   — removes background from each tree's product photo, overlays on garden
    //   — shows the ACTUAL trees the user selected
    // Strategy B (fallback): Flux Fill inpainting
    //   — AI generates trees from text description
    // ============================================================
    if (process.env.FAL_KEY) {
      // Filter placements that have cover images for composite
      const compositeItems = treePlacements
        .filter((tp) => tp.coverImage)
        .map((tp) => ({
          treeName: tp.treeName,
          imageUrl: tp.coverImage,
          x: tp.x,
          y: tp.y,
          width: tp.width,
          height: tp.height,
        }));

      // Strategy A: Tree photo composite (primary)
      if (compositeItems.length > 0) {
        console.log(`[GeneratePlan] Step 3A: Compositing ${compositeItems.length} real tree photos...`);
        try {
          const compositeResult = await compositeTreesOnGarden({
            gardenPhotoPath: gardenPhoto.path,
            trees: compositeItems,
          });
          response.generatedImage = compositeResult.imageUrl;
          console.log('[GeneratePlan] Tree composite succeeded!');
        } catch (compositeErr: any) {
          console.error('[GeneratePlan] Tree composite failed:', compositeErr.message);
          console.error('[GeneratePlan] Falling back to Flux Fill...');
        }
      }

      // Strategy B: Flux Fill fallback (if composite failed or no tree images)
      if (!response.generatedImage) {
        console.log('[GeneratePlan] Step 3B: Calling Flux Fill for inpainting...');
        try {
          const fluxResult = await fluxFillAddTrees({
            gardenPhotoPath: gardenPhoto.path,
            treePlacements: treePlacements.map(({ coverImage, ...rest }) => rest),
            styleName,
            userMessage: message || '',
          });
          response.generatedImage = fluxResult.imageUrl;
          response.prompt = fluxResult.prompt;
          console.log('[GeneratePlan] Flux Fill image generated successfully!');
        } catch (fluxErr: any) {
          const errMsg = fluxErr.message || String(fluxErr);
          console.error('[GeneratePlan] Flux Fill also failed:', errMsg);
          response.imageError = errMsg;
        }
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
