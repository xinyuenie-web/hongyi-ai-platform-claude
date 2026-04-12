/**
 * ouT（输出转换工具）— 将 DesignPlan 转换为最终效果图。
 *
 * 策略：
 * 1. 树木合成策略（BiRefNet + Sharp）— 树木 = 产品照片100%匹配
 * 2. 地面处理策略（Flux Fill）— 铺草皮/石板/鹅卵石
 * 3. 混合策略 — 先合成树，再处理地面
 */
import fs from 'fs';
import path from 'path';
import type { DesignPlan } from './int-transformer.service.js';
import { compositeTreesOnGarden } from './tree-composite.service.js';

export interface OutInput {
  gardenPhotoPath: string;
  designPlan: DesignPlan;
}

export interface OutResult {
  imageUrl: string;
  strategy: string;
  treeCount: number;
  processingMs: number;
  groundTreated?: boolean;
}

/**
 * Generate a ground mask for Flux Fill inpainting.
 * White = area to regenerate (ground), Black = preserve (trees, buildings, sky).
 * Excludes tree placement areas to avoid overwriting composited trees.
 */
async function generateGroundMask(
  imageWidth: number,
  imageHeight: number,
  groundRegion: { yStart: number; yEnd: number },
  treePlacements: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  const yStart = Math.round(groundRegion.yStart * imageHeight);
  const yEnd = Math.round(groundRegion.yEnd * imageHeight);
  const groundH = yEnd - yStart;

  if (groundH <= 0) throw new Error('Invalid ground region');

  // White rectangle for the ground area
  const groundSvg = Buffer.from(
    `<svg width="${imageWidth}" height="${groundH}"><rect width="${imageWidth}" height="${groundH}" fill="white"/></svg>`,
  );

  // Create black rectangles for tree base areas (preserve trees)
  const treeExclusions = treePlacements.map(t => {
    const treeLeft = Math.max(0, Math.round((t.x - t.width / 2) * imageWidth));
    const treeRight = Math.min(imageWidth, Math.round((t.x + t.width / 2) * imageWidth));
    const treeBottom = Math.round(t.y * imageHeight);
    const protectTop = Math.max(yStart, treeBottom - Math.round(t.height * imageHeight));
    const protectW = treeRight - treeLeft;
    const protectH = treeBottom - protectTop;
    if (protectW <= 0 || protectH <= 0) return null;
    return {
      input: Buffer.from(
        `<svg width="${protectW}" height="${protectH}"><rect width="${protectW}" height="${protectH}" fill="black"/></svg>`,
      ),
      left: treeLeft,
      top: protectTop,
    };
  }).filter((e): e is NonNullable<typeof e> => e !== null && e.top >= yStart);

  // Start with black canvas, add white ground region
  let maskBuf = await sharp({
    create: { width: imageWidth, height: imageHeight, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).composite([{ input: groundSvg, left: 0, top: yStart }]).png().toBuffer();

  // Add black tree exclusion zones
  if (treeExclusions.length > 0) {
    maskBuf = await sharp(maskBuf)
      .composite(treeExclusions.map(e => ({
        input: e.input,
        left: e.left,
        top: e.top,
      })))
      .png()
      .toBuffer();
  }

  console.log(`[ouT] Ground mask: ${imageWidth}x${imageHeight}, region y=${yStart}-${yEnd}, ${treeExclusions.length} tree exclusions`);
  return maskBuf;
}

/**
 * Call Flux Fill API for ground treatment inpainting.
 * Reuses the same fal.ai infrastructure as flux-fill.service.ts.
 */
async function callFluxFillForGround(
  imageBuffer: Buffer,
  maskBuffer: Buffer,
  prompt: string,
): Promise<Buffer> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not set');

  const proxyUrl = process.env.FAL_PROXY_URL;
  const modelId = 'fal-ai/flux-pro/v1/fill';

  const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const maskBase64 = `data:image/png;base64,${maskBuffer.toString('base64')}`;

  const payload = JSON.stringify({
    prompt,
    image_url: imageBase64,
    mask_url: maskBase64,
    num_images: 1,
    output_format: 'jpeg',
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Key ${falKey}`,
  };

  // Try direct first, then proxy
  const endpoints = [
    { name: 'direct', url: `https://fal.run/${modelId}` },
    ...(proxyUrl ? [{ name: 'proxy', url: `${proxyUrl}/fal-sync/${modelId}` }] : []),
  ];

  for (const ep of endpoints) {
    try {
      console.log(`[ouT] Flux Fill ground via ${ep.name}...`);
      const res = await fetch(ep.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(120000), // 2 min for ground treatment
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn(`[ouT] Flux Fill ${ep.name} error ${res.status}: ${errBody.slice(0, 200)}`);
        continue;
      }

      const data: any = await res.json();
      const imageUrl = data.images?.[0]?.url;
      if (!imageUrl) continue;

      console.log(`[ouT] Flux Fill ground succeeded via ${ep.name}, downloading...`);

      // Download result
      try {
        const dlRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (dlRes.ok) return Buffer.from(await dlRes.arrayBuffer());
      } catch {}

      // Try proxy download
      if (proxyUrl) {
        try {
          const urlObj = new URL(imageUrl);
          const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
          const dlRes = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
          if (dlRes.ok) return Buffer.from(await dlRes.arrayBuffer());
        } catch {}
      }
    } catch (err: any) {
      console.warn(`[ouT] Flux Fill ${ep.name} failed: ${err.message}`);
    }
  }

  throw new Error('Flux Fill ground treatment failed on all endpoints');
}

/**
 * Apply ground treatment to an already-composited image.
 * Generates a mask for the ground region, then uses Flux Fill to inpaint.
 */
async function applyGroundTreatment(
  compositeImagePath: string,
  groundTreatment: NonNullable<DesignPlan['groundTreatment']>,
  treePlacements: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<string> {
  const sharp = (await import('sharp')).default;

  // Read the composited image
  const imgBuf = fs.readFileSync(compositeImagePath);
  const meta = await sharp(imgBuf).metadata();
  const w = meta.width!;
  const h = meta.height!;

  // Resize to max 1024px for Flux Fill API payload
  const MAX_DIM = 1024;
  let processBuffer: Buffer;
  let processW: number;
  let processH: number;

  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = MAX_DIM / Math.max(w, h);
    processW = Math.round(w * scale);
    processH = Math.round(h * scale);
    processBuffer = await sharp(imgBuf).resize(processW, processH).jpeg({ quality: 85 }).toBuffer();
  } else {
    processBuffer = await sharp(imgBuf).jpeg({ quality: 85 }).toBuffer();
    processW = w;
    processH = h;
  }

  // Generate ground mask
  const maskBuf = await generateGroundMask(processW, processH, groundTreatment.groundRegion, treePlacements);

  // Save mask for debugging
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  const maskFile = `ground-mask-${Date.now()}.png`;
  fs.writeFileSync(path.join(outputDir, maskFile), maskBuf);

  // Build prompt for ground treatment
  const prompt = groundTreatment.prompt || buildGroundPrompt(groundTreatment.type);
  console.log(`[ouT] Ground treatment: type=${groundTreatment.type}, prompt="${prompt.slice(0, 100)}"`);

  // Call Flux Fill
  const resultBuf = await callFluxFillForGround(processBuffer, maskBuf, prompt);

  // Save result
  const filename = `ai-garden-ground-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), resultBuf);
  console.log(`[ouT] Ground treatment saved: ${filename} (${resultBuf.length} bytes)`);

  return `/api/v1/ai/image/${filename}`;
}

/**
 * Build a default English prompt for ground treatment based on type.
 */
function buildGroundPrompt(type: string): string {
  switch (type) {
    case 'grass':
      return 'lush green grass lawn covering the ground area, well-maintained natural turf, seamlessly blending with the existing garden scene, photorealistic, natural lighting';
    case 'stone':
      return 'natural stone paving covering the ground area, clean flagstone pavement, elegant garden path stones, seamlessly blending with the existing scene, photorealistic';
    case 'gravel':
      return 'decorative gravel and pebbles covering the ground area, Japanese zen garden style gravel, smooth river pebbles, seamlessly blending with the existing scene, photorealistic';
    default:
      return 'well-maintained garden ground surface, seamlessly blending with the existing scene, photorealistic, natural lighting';
  }
}

/**
 * ouT 主转换函数 — 将 DesignPlan + 庭院照片转换为效果图。
 *
 * Flow:
 * 1. Composite trees onto garden photo (BiRefNet + Sharp)
 * 2. If ground treatment requested, apply Flux Fill inpainting on composited result
 */
export async function transform(input: OutInput): Promise<OutResult> {
  const t0 = Date.now();
  const { designPlan, gardenPhotoPath } = input;

  // Build composite items from DesignPlan placements
  const compositeItems = designPlan.placements
    .filter(p => p.coverImage)
    .slice(0, 5)
    .map(p => ({
      treeName: p.treeName,
      imageUrl: p.coverImage,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    }));

  if (compositeItems.length === 0) {
    throw new Error('所选树木没有产品照片，无法生成效果图');
  }

  console.log(`[ouT] Compositing ${compositeItems.length} trees onto garden...`);

  // Step 1: BiRefNet + Sharp compositing (trees)
  const compositeResult = await compositeTreesOnGarden({
    gardenPhotoPath,
    trees: compositeItems,
  });

  let finalImageUrl = compositeResult.imageUrl;
  let groundTreated = false;
  let strategy = 'composite';

  // Step 2: Ground treatment via Flux Fill (if requested)
  if (designPlan.groundTreatment && process.env.FAL_KEY) {
    try {
      console.log(`[ouT] Applying ground treatment: ${designPlan.groundTreatment.type}...`);

      // Resolve the composited image path
      const compositeFilename = compositeResult.imageUrl.replace('/api/v1/ai/image/', '');
      const compositeImagePath = path.join(process.cwd(), 'uploads', 'ai-generated', compositeFilename);

      if (!fs.existsSync(compositeImagePath)) {
        console.warn(`[ouT] Composite image not found at ${compositeImagePath}, skipping ground treatment`);
      } else {
        const treePlacementsForMask = compositeItems.map(t => ({
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
        }));

        finalImageUrl = await applyGroundTreatment(
          compositeImagePath,
          designPlan.groundTreatment,
          treePlacementsForMask,
        );
        groundTreated = true;
        strategy = 'composite+ground';
        console.log(`[ouT] Ground treatment complete`);
      }
    } catch (err: any) {
      console.warn(`[ouT] Ground treatment failed (non-fatal): ${err.message}`);
      // Fall back to tree-only composite — ground treatment failure is non-fatal
    }
  }

  const processingMs = Date.now() - t0;
  console.log(`[ouT] ${strategy} complete in ${processingMs}ms`);

  return {
    imageUrl: finalImageUrl,
    strategy,
    treeCount: compositeItems.length,
    processingMs,
    groundTreated,
  };
}
