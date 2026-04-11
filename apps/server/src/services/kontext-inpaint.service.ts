/**
 * Flux Kontext Lora Inpaint Service
 *
 * Uses fal.ai's Flux Kontext model for reference-image-guided inpainting.
 * Given a garden photo + tree product photo + mask, the AI generates
 * the tree naturally INTO the scene with proper lighting and perspective.
 *
 * Key difference from previous approaches:
 * - NOT a crude paste/overlay — AI understands the scene and generates the tree in context
 * - Reference image guides the output — shows the ACTUAL tree species
 * - Proper shadows, lighting, perspective matching
 */

import fs from 'fs';
import path from 'path';

const MODEL_ID = 'fal-ai/flux-kontext-lora/inpaint';

export interface KontextTreePlacement {
  treeName: string;
  treeImageUrl: string;  // cover image URL or path (e.g. /images/trees/HY0001.jpg)
  x: number;             // center x of tree (0-1)
  y: number;             // ground level / bottom of tree (0-1)
  width: number;         // tree width (0-1)
  height: number;        // tree height (0-1)
}

/**
 * Read an image and convert to base64 data URI.
 */
async function imageToBase64(imagePath: string): Promise<string> {
  // Local file
  if (imagePath.startsWith('/') && !imagePath.startsWith('/images/') && !imagePath.startsWith('/uploads/')) {
    // Absolute local path
    const buf = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  // /images/ path — served by Next.js
  if (imagePath.startsWith('/images/')) {
    const localPath = path.join(process.cwd(), '..', 'website', 'public', imagePath);
    if (fs.existsSync(localPath)) {
      const buf = fs.readFileSync(localPath);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
    // Docker: fetch from website service
    const urls = [`http://website:3000${imagePath}`, `http://nginx:80${imagePath}`];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      } catch { /* try next */ }
    }
    throw new Error(`Cannot fetch image: ${imagePath}`);
  }

  // /uploads/ path
  if (imagePath.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), imagePath);
    const buf = fs.readFileSync(localPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  // Full URL or already base64
  if (imagePath.startsWith('http')) {
    const res = await fetch(imagePath, { signal: AbortSignal.timeout(15000) });
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  if (imagePath.startsWith('data:')) return imagePath;

  throw new Error(`Unknown image path format: ${imagePath}`);
}

/**
 * Read a local file and return as base64 data URI.
 */
function localFileToBase64(filePath: string): string {
  let absPath = filePath;
  if (!path.isAbsolute(absPath)) absPath = path.join(process.cwd(), absPath);
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Generate a mask for a single tree placement.
 * White = where to generate, Black = preserve original.
 * Uses an elliptical shape (tree-like silhouette).
 */
async function generateSingleTreeMask(
  imageWidth: number,
  imageHeight: number,
  placement: KontextTreePlacement,
): Promise<string> {
  const sharp = (await import('sharp')).default;

  const w = Math.max(20, Math.round(placement.width * imageWidth));
  const h = Math.max(30, Math.round(placement.height * imageHeight));

  // x = center, y = ground level (bottom of tree)
  const centerX = Math.round(placement.x * imageWidth);
  const left = Math.max(0, Math.min(imageWidth - w, centerX - Math.round(w / 2)));
  const top = Math.max(0, Math.min(imageHeight - h, Math.round(placement.y * imageHeight) - h));

  // Create elliptical mask (tree crown shape)
  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.4); // crown center is in upper portion
  const rx = Math.round(w / 2);
  const ry = Math.round(h * 0.45);
  const trunkW = Math.max(Math.round(w * 0.2), 4);
  const trunkX = Math.round((w - trunkW) / 2);
  const trunkTop = Math.round(h * 0.5);
  const trunkH = h - trunkTop;

  const treeSvg = Buffer.from(
    `<svg width="${w}" height="${h}">` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>` +
    `<rect x="${trunkX}" y="${trunkTop}" width="${trunkW}" height="${trunkH}" fill="white"/>` +
    `</svg>`,
  );

  // Create full-size black mask, composite white tree shape
  const maskBuf = await sharp({
    create: { width: imageWidth, height: imageHeight, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: treeSvg, left, top }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${maskBuf.toString('base64')}`;
}

/**
 * Resize garden photo to max dimensions suitable for API.
 * Returns { buffer, width, height, base64 }.
 */
async function prepareGardenPhoto(filePath: string): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  base64: string;
}> {
  const sharp = (await import('sharp')).default;

  let absPath = filePath;
  if (!path.isAbsolute(absPath)) absPath = path.join(process.cwd(), absPath);
  const rawBuf = fs.readFileSync(absPath);
  const meta = await sharp(rawBuf).metadata();
  const rawW = meta.width!;
  const rawH = meta.height!;

  const MAX_DIM = 1024;
  let buffer: Buffer;
  let width: number;
  let height: number;

  if (rawW > MAX_DIM || rawH > MAX_DIM) {
    const scale = MAX_DIM / Math.max(rawW, rawH);
    width = Math.round(rawW * scale);
    height = Math.round(rawH * scale);
    buffer = await sharp(rawBuf).resize(width, height).jpeg({ quality: 90 }).toBuffer();
    console.log(`[Kontext] Garden resized: ${rawW}x${rawH} → ${width}x${height}`);
  } else {
    buffer = rawBuf;
    width = rawW;
    height = rawH;
  }

  const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  return { buffer, width, height, base64 };
}

/**
 * Call Flux Kontext Inpaint API.
 * Tries direct fal.run first, then proxy.
 */
async function callKontextInpaint(params: {
  imageBase64: string;
  maskBase64: string;
  referenceImageBase64: string;
  prompt: string;
}): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not configured');

  const proxyUrl = process.env.FAL_PROXY_URL;
  const body = JSON.stringify({
    image_url: params.imageBase64,
    mask_url: params.maskBase64,
    reference_image_url: params.referenceImageBase64,
    prompt: params.prompt,
    num_images: 1,
    output_format: 'jpeg',
    strength: 0.85,
    guidance_scale: 3.0,
    num_inference_steps: 30,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Key ${falKey}`,
  };

  // Strategy 1: Direct fal.run
  try {
    console.log('[Kontext] Calling direct fal.run...');
    const res = await fetch(`https://fal.run/${MODEL_ID}`, {
      method: 'POST', headers, body,
      signal: AbortSignal.timeout(120000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const imageUrl = data.images?.[0]?.url;
      if (imageUrl) {
        console.log(`[Kontext] Direct success! Image: ${imageUrl.slice(0, 60)}...`);
        return imageUrl;
      }
    } else {
      const errBody = await res.text().catch(() => '');
      console.warn(`[Kontext] Direct error ${res.status}: ${errBody.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.warn(`[Kontext] Direct failed: ${err.message}`);
  }

  // Strategy 2: Via HK proxy
  if (proxyUrl) {
    try {
      console.log('[Kontext] Calling via HK proxy...');
      const res = await fetch(`${proxyUrl}/fal-sync/${MODEL_ID}`, {
        method: 'POST', headers, body,
        signal: AbortSignal.timeout(120000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const imageUrl = data.images?.[0]?.url;
        if (imageUrl) {
          console.log(`[Kontext] Proxy success! Image: ${imageUrl.slice(0, 60)}...`);
          return imageUrl;
        }
      } else {
        const errBody = await res.text().catch(() => '');
        console.warn(`[Kontext] Proxy error ${res.status}: ${errBody.slice(0, 200)}`);
      }
    } catch (err: any) {
      console.warn(`[Kontext] Proxy failed: ${err.message}`);
    }
  }

  throw new Error('Flux Kontext inpaint failed on all endpoints');
}

/**
 * Download result image from fal.ai CDN (handles China blocking).
 */
async function downloadResult(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Try direct
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch { /* try proxy */ }

  // Try proxy
  if (proxyUrl) {
    try {
      const urlObj = new URL(imageUrl);
      const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* fail */ }
  }

  throw new Error(`Failed to download result image`);
}

/**
 * Main function: Add trees to garden photo using Flux Kontext.
 *
 * For each tree (sequential, max 3):
 * 1. Use current image as base (starts with original garden photo)
 * 2. Generate mask for this tree's placement area
 * 3. Use tree's product photo as reference image
 * 4. Call Flux Kontext → AI generates the tree IN the scene
 * 5. Download result → becomes base for next tree
 *
 * This produces a realistic effect where each tree looks naturally planted,
 * with proper lighting, shadows, and perspective matching the scene.
 */
export async function kontextAddTrees(options: {
  gardenPhotoPath: string;
  trees: KontextTreePlacement[];
}): Promise<{ imageUrl: string }> {
  const sharp = (await import('sharp')).default;

  // Limit to 3 trees max (quality + speed)
  const trees = options.trees.slice(0, 3);
  console.log(`[Kontext] Adding ${trees.length} trees to garden photo...`);

  // Prepare garden photo
  const garden = await prepareGardenPhoto(options.gardenPhotoPath);
  console.log(`[Kontext] Garden photo: ${garden.width}x${garden.height}`);

  let currentImageBase64 = garden.base64;
  let currentWidth = garden.width;
  let currentHeight = garden.height;
  let lastResultUrl: string | null = null;

  // Process each tree sequentially
  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    console.log(`[Kontext] Tree ${i + 1}/${trees.length}: ${tree.treeName}`);

    try {
      // 1. Load tree reference image
      const referenceBase64 = await imageToBase64(tree.treeImageUrl);
      console.log(`[Kontext] Tree ${i + 1} reference image loaded`);

      // 2. Generate mask for this tree
      const maskBase64 = await generateSingleTreeMask(currentWidth, currentHeight, tree);
      console.log(`[Kontext] Tree ${i + 1} mask generated`);

      // 3. Build prompt
      const prompt = `Add a ${tree.treeName} ornamental tree naturally planted in the ground of this garden. The tree should have realistic proportions, natural lighting matching the scene, and cast proper shadows. Photorealistic, high quality.`;

      // 4. Call Kontext API
      const resultUrl = await callKontextInpaint({
        imageBase64: currentImageBase64,
        maskBase64,
        referenceImageBase64: referenceBase64,
        prompt,
      });
      lastResultUrl = resultUrl;

      // 5. Download result and use as base for next tree
      if (i < trees.length - 1) {
        // More trees to add — download and convert to base64
        const resultBuf = await downloadResult(resultUrl);
        currentImageBase64 = `data:image/jpeg;base64,${resultBuf.toString('base64')}`;
        const meta = await sharp(resultBuf).metadata();
        currentWidth = meta.width!;
        currentHeight = meta.height!;
        console.log(`[Kontext] Tree ${i + 1} done, result: ${currentWidth}x${currentHeight}`);
      } else {
        console.log(`[Kontext] Tree ${i + 1} done (last tree)`);
      }
    } catch (err: any) {
      console.error(`[Kontext] Tree ${i + 1} (${tree.treeName}) failed: ${err.message}`);
      // Continue with remaining trees using current image
    }
  }

  if (!lastResultUrl) {
    throw new Error('所有树木生成失败');
  }

  // Download final result and save locally
  const finalBuf = await downloadResult(lastResultUrl);

  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `ai-garden-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), finalBuf);
  console.log(`[Kontext] Final image saved: ${filename} (${finalBuf.length} bytes, ${trees.length} trees)`);

  return { imageUrl: `/api/v1/ai/image/${filename}` };
}
