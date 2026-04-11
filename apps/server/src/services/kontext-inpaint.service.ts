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
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
    // Docker: fetch from website or nginx
    for (const host of ['website:3000', 'nginx:80']) {
      try {
        const res = await fetch(`http://${host}${imagePath}`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          console.log(`[Kontext] Loaded ${imagePath} from ${host} (${buf.length}b)`);
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
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
 */
async function generateMask(
  w: number, h: number, p: KontextTreePlacement,
): Promise<string> {
  const sharp = (await import('sharp')).default;

  const treeW = Math.max(20, Math.round(p.width * w));
  const treeH = Math.max(30, Math.round(p.height * h));
  const left = Math.max(0, Math.min(w - treeW, Math.round(p.x * w - treeW / 2)));
  const top = Math.max(0, Math.min(h - treeH, Math.round(p.y * h - treeH)));

  // Elliptical tree shape
  const cx = Math.round(treeW / 2);
  const cy = Math.round(treeH * 0.4);
  const rx = Math.round(treeW / 2);
  const ry = Math.round(treeH * 0.45);
  const trunkW = Math.max(Math.round(treeW * 0.2), 4);
  const trunkX = Math.round((treeW - trunkW) / 2);
  const trunkTop = Math.round(treeH * 0.5);

  const svg = Buffer.from(
    `<svg width="${treeW}" height="${treeH}">` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>` +
    `<rect x="${trunkX}" y="${trunkTop}" width="${trunkW}" height="${treeH - trunkTop}" fill="white"/>` +
    `</svg>`,
  );

  const buf = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).composite([{ input: svg, left, top }]).png().toBuffer();

  return `data:image/png;base64,${buf.toString('base64')}`;
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
}): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not set');

  const payload = {
    image_url: params.imageBase64,
    mask_url: params.maskBase64,
    reference_image_url: params.refBase64,
    prompt: params.prompt,
    num_images: 1,
    output_format: 'jpeg',
    strength: 0.85,
    guidance_scale: 3.0,
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
      console.log(`[Kontext] API call via ${ep.name}...`);
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
        console.warn(`[Kontext] ${ep.name}: no image in response`);
        continue;
      }

      console.log(`[Kontext] ${ep.name} success in ${Date.now() - t}ms`);

      // With sync_mode=true, imageUrl is a data URI (data:image/jpeg;base64,...)
      // With sync_mode=false, it's a URL (https://fal.media/...)
      if (imageUrl.startsWith('data:')) {
        return imageUrl; // Already base64, no download needed!
      }

      // Fallback: if sync_mode didn't work, download from URL
      console.log(`[Kontext] sync_mode returned URL instead of data URI, downloading...`);
      try {
        const dlRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
        if (dlRes.ok) {
          const buf = Buffer.from(await dlRes.arrayBuffer());
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      } catch { /* try proxy */ }

      if (proxyUrl) {
        const urlObj = new URL(imageUrl);
        const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
        const dlRes = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
        if (dlRes.ok) {
          const buf = Buffer.from(await dlRes.arrayBuffer());
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
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

  const garden = await prepareGardenPhoto(options.gardenPhotoPath);
  let currentBase64 = garden.base64;
  let currentW = garden.width;
  let currentH = garden.height;
  let succeeded = 0;

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    console.log(`[Kontext] Tree ${i + 1}/${trees.length}: ${tree.treeName} (${tree.treeImageUrl})`);

    try {
      const refBase64 = await imageToBase64(tree.treeImageUrl);
      const maskBase64 = await generateMask(currentW, currentH, tree);
      const prompt = `A ${tree.treeName} ornamental tree naturally planted in the ground. Realistic proportions, natural lighting, proper shadows. Photorealistic.`;

      const resultBase64 = await callKontext({
        imageBase64: currentBase64,
        maskBase64,
        refBase64,
        prompt,
      });

      // Update current image for next iteration
      currentBase64 = resultBase64;
      // Get dimensions from result
      const resultBuf = Buffer.from(resultBase64.split(',')[1], 'base64');
      const meta = await sharp(resultBuf).metadata();
      currentW = meta.width!;
      currentH = meta.height!;
      succeeded++;
      console.log(`[Kontext] Tree ${i + 1} done: ${currentW}x${currentH}`);
    } catch (err: any) {
      console.error(`[Kontext] Tree ${i + 1} failed: ${err.message}`);
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
