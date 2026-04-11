/**
 * Flux Kontext Lora Inpaint Service
 *
 * Uses fal.ai's Flux Kontext model for reference-image-guided inpainting.
 * Given a garden photo + tree product photo + mask, the AI generates
 * the tree naturally INTO the scene with proper lighting and perspective.
 *
 * KEY: Uses sync_mode=true so the API returns image data directly in the
 * response (as data URI). This eliminates the need to download from
 * fal.media CDN, which is unreliable from China.
 *
 * DEBUG: Saves mask/input/output images to uploads/ai-debug/ for inspection.
 */

import fs from 'fs';
import path from 'path';

const MODEL_ID = 'fal-ai/flux-kontext-lora/inpaint';

export interface KontextTreePlacement {
  treeName: string;
  treeImageUrl: string;
  x: number;    // center x (0-1)
  y: number;    // ground level / bottom of tree (0-1)
  width: number;
  height: number;
}

/**
 * Load image from path/URL and return as base64 data URI.
 */
async function imageToBase64(imagePath: string): Promise<string> {
  // /images/ path — served by Next.js in Docker
  if (imagePath.startsWith('/images/')) {
    // Try local filesystem (dev mode)
    const localPath = path.join(process.cwd(), '..', 'website', 'public', imagePath);
    if (fs.existsSync(localPath)) {
      const buf = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
    // Docker: fetch from website or nginx
    for (const host of ['website:3000', 'nginx:80']) {
      try {
        const res = await fetch(`http://${host}${imagePath}`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          console.log(`[Kontext] Loaded ${imagePath} from ${host} (${buf.length}b)`);
          const ext = path.extname(imagePath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
          return `data:${mime};base64,${buf.toString('base64')}`;
        }
      } catch { /* try next */ }
    }
    throw new Error(`Cannot fetch: ${imagePath}`);
  }

  // /uploads/ path — local file
  if (imagePath.startsWith('/uploads/')) {
    const buf = fs.readFileSync(path.join(process.cwd(), imagePath));
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  // Already base64
  if (imagePath.startsWith('data:')) return imagePath;

  // Full URL
  if (imagePath.startsWith('http')) {
    const res = await fetch(imagePath, { signal: AbortSignal.timeout(15000) });
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  throw new Error(`Unknown path: ${imagePath}`);
}

/**
 * Resize garden photo to max 1024px and return as base64 + dimensions.
 */
async function prepareGardenPhoto(filePath: string): Promise<{
  width: number; height: number; base64: string;
}> {
  const sharp = (await import('sharp')).default;
  let absPath = filePath;
  if (!path.isAbsolute(absPath)) absPath = path.join(process.cwd(), absPath);
  const rawBuf = fs.readFileSync(absPath);
  const meta = await sharp(rawBuf).metadata();
  const rawW = meta.width!;
  const rawH = meta.height!;

  const MAX_DIM = 1024;
  if (rawW > MAX_DIM || rawH > MAX_DIM) {
    const scale = MAX_DIM / Math.max(rawW, rawH);
    const w = Math.round(rawW * scale);
    const h = Math.round(rawH * scale);
    const buf = await sharp(rawBuf).resize(w, h).jpeg({ quality: 90 }).toBuffer();
    console.log(`[Kontext] Garden: ${rawW}x${rawH} → ${w}x${h}`);
    return { width: w, height: h, base64: `data:image/jpeg;base64,${buf.toString('base64')}` };
  }
  return { width: rawW, height: rawH, base64: `data:image/jpeg;base64,${rawBuf.toString('base64')}` };
}

/**
 * Generate mask for a single tree placement.
 * White = area to regenerate, Black = preserve.
 *
 * Uses a large rectangular region with rounded corners.
 * Previous elliptical mask was too small — larger mask gives the AI
 * more room to generate the tree naturally.
 */
async function generateMask(
  w: number, h: number, p: KontextTreePlacement,
): Promise<string> {
  const sharp = (await import('sharp')).default;

  // Ensure minimum viable mask size
  const minW = Math.max(60, Math.round(w * 0.10));
  const minH = Math.max(80, Math.round(h * 0.12));
  let treeW = Math.max(minW, Math.round(p.width * w));
  let treeH = Math.max(minH, Math.round(p.height * h));

  // p.x = center, p.y = bottom/ground level
  // CRITICAL: The mask must NOT extend above the ground area.
  // In most garden photos, buildings occupy y=0 to ~0.55, ground is y=0.55+.
  // If the mask goes above y=0.50, it overlaps the building and the model
  // refuses to generate anything there.
  const groundTop = Math.round(h * 0.50); // nothing above 50% of image
  let top = Math.max(0, Math.round(p.y * h - treeH));

  // If mask would extend above ground area, shrink it
  if (top < groundTop) {
    top = groundTop;
    treeH = Math.round(p.y * h) - top; // fit between groundTop and ground level
    if (treeH < minH) treeH = minH;    // enforce minimum
  }

  const left = Math.max(0, Math.min(w - treeW, Math.round(p.x * w - treeW / 2)));

  // Rounded rectangle mask
  const rx = Math.round(treeW * 0.12);
  const ry = Math.round(treeH * 0.06);

  const svg = Buffer.from(
    `<svg width="${treeW}" height="${treeH}">` +
    `<rect width="${treeW}" height="${treeH}" rx="${rx}" ry="${ry}" fill="white"/>` +
    `</svg>`,
  );

  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).composite([{ input: svg, left, top }]).png().toBuffer();

  const maskBottom = top + treeH;
  console.log(`[Kontext] Mask: image ${w}x${h}, tree: left=${left} top=${top} ${treeW}x${treeH} bottom=${maskBottom} (${(treeW*treeH/(w*h)*100).toFixed(1)}% area, top@${(top/h*100).toFixed(0)}%)`);

  return `data:image/png;base64,${buf.toString('base64')}`;
}

/**
 * Save a base64 data URI to disk for debugging.
 */
function saveDebugImage(base64DataUri: string, name: string): void {
  try {
    const debugDir = path.join(process.cwd(), 'uploads', 'ai-debug');
    fs.mkdirSync(debugDir, { recursive: true });
    const data = base64DataUri.split(',')[1];
    if (!data) return;
    const ext = base64DataUri.includes('image/png') ? 'png' : 'jpg';
    const filePath = path.join(debugDir, `${name}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`[Kontext] Debug saved: ${filePath} (${Buffer.from(data, 'base64').length}b)`);
  } catch (err) {
    console.warn(`[Kontext] Debug save failed for ${name}:`, err);
  }
}

/**
 * Call Kontext API with sync_mode=true.
 * Returns image as base64 data URI directly — NO CDN download needed.
 */
async function callKontext(params: {
  imageBase64: string;
  maskBase64: string;
  refBase64: string;
  prompt: string;
  treeIndex: number;
}): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not set');

  // Save debug images before API call
  saveDebugImage(params.imageBase64, `tree${params.treeIndex}-input`);
  saveDebugImage(params.maskBase64, `tree${params.treeIndex}-mask`);
  saveDebugImage(params.refBase64, `tree${params.treeIndex}-reference`);

  const payload = {
    image_url: params.imageBase64,
    mask_url: params.maskBase64,
    reference_image_url: params.refBase64,
    prompt: params.prompt,
    num_images: 1,
    output_format: 'jpeg',
    strength: 0.95,
    guidance_scale: 5.5,    // Balanced: higher than default(2.5) for better reference matching, but not so high it kills generation
    num_inference_steps: 28,
    sync_mode: true,  // KEY: return image data in response, no CDN download
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Key ${falKey}`,
  };

  const proxyUrl = process.env.FAL_PROXY_URL;
  const endpoints = [
    { name: 'direct', url: `https://fal.run/${MODEL_ID}` },
  ];
  if (proxyUrl) {
    endpoints.push({ name: 'proxy', url: `${proxyUrl}/fal-sync/${MODEL_ID}` });
  }

  for (const ep of endpoints) {
    try {
      console.log(`[Kontext] API call via ${ep.name}... (strength=${payload.strength}, guidance=${payload.guidance_scale})`);
      const t = Date.now();
      const res = await fetch(ep.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(180000), // 3 min timeout for large images
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn(`[Kontext] ${ep.name} HTTP ${res.status}: ${errBody.slice(0, 300)}`);
        continue;
      }

      const data: any = await res.json();
      const imageUrl = data.images?.[0]?.url;
      if (!imageUrl) {
        console.warn(`[Kontext] ${ep.name}: no image in response. Keys: ${Object.keys(data).join(',')}`);
        console.warn(`[Kontext] Response snippet: ${JSON.stringify(data).slice(0, 500)}`);
        continue;
      }

      const elapsed = Date.now() - t;
      console.log(`[Kontext] ${ep.name} success in ${elapsed}ms`);

      // With sync_mode=true, imageUrl is a data URI (data:image/jpeg;base64,...)
      // With sync_mode=false, it's a URL (https://fal.media/...)
      if (imageUrl.startsWith('data:')) {
        // Verify the result is actually different from input
        const inputSize = params.imageBase64.length;
        const outputSize = imageUrl.length;
        const sizeDiff = Math.abs(outputSize - inputSize);
        const pctDiff = (sizeDiff / inputSize * 100).toFixed(1);
        console.log(`[Kontext] Input base64: ${inputSize} chars, Output base64: ${outputSize} chars, Diff: ${pctDiff}%`);

        if (sizeDiff < 100) {
          console.warn(`[Kontext] WARNING: Output nearly identical to input! The inpainting may not have worked.`);
        }

        // Save output for debugging
        saveDebugImage(imageUrl, `tree${params.treeIndex}-output`);
        return imageUrl;
      }

      // Fallback: if sync_mode didn't work, download from URL
      console.log(`[Kontext] sync_mode returned URL instead of data URI, downloading...`);
      try {
        const dlRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (dlRes.ok) {
          const buf = Buffer.from(await dlRes.arrayBuffer());
          const result = `data:image/jpeg;base64,${buf.toString('base64')}`;
          saveDebugImage(result, `tree${params.treeIndex}-output`);
          return result;
        }
      } catch { /* try proxy */ }

      if (proxyUrl) {
        const urlObj = new URL(imageUrl);
        const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
        const dlRes = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
        if (dlRes.ok) {
          const buf = Buffer.from(await dlRes.arrayBuffer());
          const result = `data:image/jpeg;base64,${buf.toString('base64')}`;
          saveDebugImage(result, `tree${params.treeIndex}-output`);
          return result;
        }
      }

      throw new Error('Generated image but failed to retrieve it');
    } catch (err: any) {
      console.warn(`[Kontext] ${ep.name} failed: ${err.message}`);
      if (ep === endpoints[endpoints.length - 1]) throw err;
    }
  }

  throw new Error('Kontext API failed on all endpoints');
}

/**
 * Species → visual description mapping.
 * Critical for AI to match the tree's actual appearance (color, shape, foliage).
 * The reference_image_url alone is unreliable — the text prompt must describe
 * the tree's distinctive visual features explicitly.
 */
const SPECIES_VISUAL: Record<string, string> = {
  '罗汉松': 'dark green layered cloud-shaped canopy with thick brown trunk, evergreen pine-like foliage arranged in horizontal tiers',
  '黑松': 'dark green pine needles, rugged dark bark, spreading irregular branches with dense needle clusters',
  '五针松': 'soft blue-green short pine needles, elegant upright form with layered branches',
  '榆树': 'small bright green leaves, twisted gnarled trunk, umbrella-shaped canopy',
  '红花檵木': 'DEEP CRIMSON RED leaves covering the entire tree, vivid red-purple foliage, layered branch structure with striking red color throughout',
  '对节白蜡': 'bright green compound leaves, smooth pale gray bark, graceful spreading form',
  '紫薇': 'pink-purple flower clusters, smooth mottled bark, vase-shaped canopy',
  '大阪松': 'green pine needles in horizontal layered tiers, compact bonsai-like form with clearly defined branch layers',
  '黄杨': 'very dense tiny dark green leaves, compact rounded ball shape, tight foliage',
  '枸骨': 'glossy dark green holly-like spiny leaves, dense compact form',
};

function getTreeVisualDescription(treeName: string): string {
  // Try exact species match first, then partial match
  for (const [species, desc] of Object.entries(SPECIES_VISUAL)) {
    if (treeName.includes(species)) return desc;
  }
  return 'ornamental tree with natural foliage';
}

/**
 * Add trees to garden photo using Flux Kontext.
 *
 * Sequential process (each tree builds on previous result):
 * 1. Prepare garden photo (resize to 1024px max)
 * 2. For each tree:
 *    a. Load tree product photo as reference
 *    b. Generate mask for placement area
 *    c. Call Kontext API (sync_mode=true → returns base64 directly)
 *    d. Use result as base for next tree
 * 3. Save final result to disk
 */
export async function kontextAddTrees(options: {
  gardenPhotoPath: string;
  trees: KontextTreePlacement[];
}): Promise<{ imageUrl: string }> {
  const sharp = (await import('sharp')).default;
  const trees = options.trees.slice(0, 3);
  console.log(`[Kontext] Starting: ${trees.length} trees`);
  console.log(`[Kontext] Trees:`, trees.map(t => `${t.treeName} @(${t.x.toFixed(2)},${t.y.toFixed(2)} ${t.width.toFixed(2)}x${t.height.toFixed(2)}) img:${t.treeImageUrl}`));

  // Clean up old debug images
  const debugDir = path.join(process.cwd(), 'uploads', 'ai-debug');
  try {
    if (fs.existsSync(debugDir)) {
      const files = fs.readdirSync(debugDir);
      for (const f of files) {
        fs.unlinkSync(path.join(debugDir, f));
      }
    }
  } catch { /* ignore */ }

  const garden = await prepareGardenPhoto(options.gardenPhotoPath);
  let currentBase64 = garden.base64;
  let currentW = garden.width;
  let currentH = garden.height;
  let succeeded = 0;

  console.log(`[Kontext] Garden prepared: ${currentW}x${currentH}, base64 length: ${currentBase64.length}`);

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    console.log(`[Kontext] Tree ${i + 1}/${trees.length}: ${tree.treeName}`);
    console.log(`[Kontext]   Image: ${tree.treeImageUrl}`);
    console.log(`[Kontext]   Position: center=(${tree.x.toFixed(2)},${tree.y.toFixed(2)}) size=${tree.width.toFixed(2)}x${tree.height.toFixed(2)}`);

    try {
      const refBase64 = await imageToBase64(tree.treeImageUrl);
      console.log(`[Kontext]   Reference image loaded: ${refBase64.length} chars`);

      const maskBase64 = await generateMask(currentW, currentH, tree);
      console.log(`[Kontext]   Mask generated: ${maskBase64.length} chars`);

      // Prompt: visual description of the specific species + reference matching
      const visualDesc = getTreeVisualDescription(tree.treeName);
      const prompt = `Add the tree from the reference image into this garden, planted directly in the ground without any pot or container. The tree has ${visualDesc}. Match the reference image exactly in color and shape. Photorealistic outdoor garden photography, natural lighting, soft ground shadows beneath the tree.`;

      const resultBase64 = await callKontext({
        imageBase64: currentBase64,
        maskBase64,
        refBase64,
        prompt,
        treeIndex: i + 1,
      });

      // Update current image for next iteration
      currentBase64 = resultBase64;
      // Get dimensions from result
      const resultBuf = Buffer.from(resultBase64.split(',')[1], 'base64');
      const meta = await sharp(resultBuf).metadata();
      currentW = meta.width!;
      currentH = meta.height!;
      succeeded++;
      console.log(`[Kontext] Tree ${i + 1} done: ${currentW}x${currentH}, result: ${resultBase64.length} chars`);
    } catch (err: any) {
      console.error(`[Kontext] Tree ${i + 1} failed: ${err.message}`);
      console.error(`[Kontext] Tree ${i + 1} stack: ${err.stack?.slice(0, 300)}`);
    }
  }

  if (succeeded === 0) {
    throw new Error('所有树木生成失败');
  }

  // Save final image
  const finalBuf = Buffer.from(currentBase64.split(',')[1], 'base64');
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `ai-garden-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), finalBuf);
  console.log(`[Kontext] Saved: ${filename} (${finalBuf.length}b, ${succeeded}/${trees.length} trees)`);

  return { imageUrl: `/api/v1/ai/image/${filename}` };
}
