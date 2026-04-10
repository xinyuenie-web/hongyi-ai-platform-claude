import fs from 'fs';
import path from 'path';

export interface TreePlacement {
  treeName: string;
  x: number;      // top-left x (0-1 ratio)
  y: number;      // top-left y (0-1 ratio)
  width: number;  // width (0-1 ratio)
  height: number; // height (0-1 ratio)
}

/**
 * Generate a mask image using Sharp.
 * Black (0,0,0) = preserve original, White (255,255,255) = AI generates here.
 */
async function generateMask(
  imageWidth: number,
  imageHeight: number,
  placements: TreePlacement[],
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  // Create all-black base image (preserve everything)
  const base = sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  });

  // Build white rectangle overlays for each tree placement
  const overlays = placements.map((p) => {
    const x = Math.max(0, Math.round(p.x * imageWidth));
    const y = Math.max(0, Math.round(p.y * imageHeight));
    const w = Math.min(Math.round(p.width * imageWidth), imageWidth - x);
    const h = Math.min(Math.round(p.height * imageHeight), imageHeight - y);

    // Create white rectangle SVG with soft rounded corners for natural blending
    const rx = Math.round(Math.min(w, h) * 0.08);
    const svg = Buffer.from(
      `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white" rx="${rx}" ry="${rx}"/></svg>`,
    );
    return { input: svg, left: x, top: y };
  });

  if (overlays.length === 0) {
    throw new Error('No tree placement regions specified');
  }

  return base.composite(overlays).png().toBuffer();
}

/**
 * Build the inpainting prompt for Flux Fill.
 * Describes what to generate in the masked white areas.
 */
function buildFluxPrompt(
  placements: TreePlacement[],
  styleName: string,
  userMessage: string,
): string {
  const treeNames = placements.map((p) => p.treeName).join(', ');
  const userDesc = userMessage?.trim() ? ` ${userMessage.trim()}.` : '';

  return `Beautiful ornamental ${treeNames} trees naturally planted in a garden. The trees should have realistic proportions, natural lighting matching the scene, proper shadows on the ground, and blend seamlessly with the existing garden environment. ${styleName} garden style.${userDesc} Photorealistic, high quality, natural daylight.`;
}

export interface FluxFillOptions {
  gardenPhotoPath: string;
  treePlacements: TreePlacement[];
  styleName: string;
  userMessage: string;
}

export interface FluxFillResult {
  imageUrl: string;   // local URL path (e.g. /uploads/ai-generated/xxx.jpg)
  prompt: string;
  maskSaved?: string; // optional: saved mask path for debugging
}

/**
 * Rewrite a fal.ai URL to go through our HK proxy.
 * e.g., https://queue.fal.run/xxx → http://proxy:8462/fal/xxx
 */
function rewriteUrlForProxy(url: string, proxyUrl: string): string {
  return url
    .replace('https://queue.fal.run/', `${proxyUrl}/fal/`)
    .replace('https://fal.run/', `${proxyUrl}/fal-api/`);
}

/**
 * Call Flux Fill API directly via HTTP (through HK proxy if configured).
 *
 * Uses fal.ai queue API:
 *   POST  — submit job → returns { request_id, status_url, response_url }
 *   GET status_url — poll status
 *   GET response_url — get result
 */
async function callFluxFillAPI(
  prompt: string,
  imageBase64: string,
  maskBase64: string,
): Promise<string> {
  const falKey = process.env.FAL_KEY!;
  const proxyUrl = process.env.FAL_PROXY_URL; // e.g., http://43.129.236.142:8462

  // Base URL: use proxy or direct fal.ai
  const queueBase = proxyUrl
    ? `${proxyUrl}/fal`     // proxy: /fal/ -> https://queue.fal.run/
    : 'https://queue.fal.run';

  const modelId = 'fal-ai/flux-pro/v1/fill';

  // Step 1: Submit the job
  console.log(`[Flux Fill] Submitting job to ${proxyUrl ? 'proxy' : 'fal.ai'}...`);
  const submitRes = await fetch(`${queueBase}/${modelId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${falKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_url: imageBase64,
      mask_url: maskBase64,
      num_images: 1,
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!submitRes.ok) {
    const errBody = await submitRes.text().catch(() => 'unknown');
    console.error(`[Flux Fill] Submit error ${submitRes.status}:`, errBody);
    throw new Error(`Flux Fill submit failed: ${submitRes.status}`);
  }

  const submitData: any = await submitRes.json();
  console.log(`[Flux Fill] Submit response keys:`, Object.keys(submitData));

  // Check if result is returned directly (synchronous)
  if (submitData.images?.[0]?.url) {
    console.log(`[Flux Fill] Got synchronous result`);
    return submitData.images[0].url;
  }

  const requestId = submitData.request_id;
  if (!requestId) {
    console.error('[Flux Fill] No request_id in response:', JSON.stringify(submitData).slice(0, 500));
    throw new Error('Flux Fill: no request_id returned');
  }

  // Use the URLs from the response (fal.ai provides them)
  let statusUrl = submitData.status_url;
  let responseUrl = submitData.response_url;

  // If we're using a proxy, rewrite the URLs
  if (proxyUrl && statusUrl) {
    statusUrl = rewriteUrlForProxy(statusUrl, proxyUrl);
    responseUrl = rewriteUrlForProxy(responseUrl, proxyUrl);
  }

  // Fallback: construct URLs manually if not provided
  if (!statusUrl) {
    statusUrl = `${queueBase}/${modelId}/requests/${requestId}/status`;
    responseUrl = `${queueBase}/${modelId}/requests/${requestId}`;
  }

  console.log(`[Flux Fill] Job submitted, request_id: ${requestId}`);
  console.log(`[Flux Fill] Status URL: ${statusUrl}`);
  console.log(`[Flux Fill] Response URL: ${responseUrl}`);

  // Step 2: Poll for completion (max 5 minutes)
  const maxWait = 300000; // 5 minutes
  const pollInterval = 3000; // 3 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    try {
      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!statusRes.ok) {
        const errText = await statusRes.text().catch(() => '');
        console.warn(`[Flux Fill] Status check ${statusRes.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const statusData: any = await statusRes.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Flux Fill] Status: ${statusData.status} (${elapsed}s)`);

      if (statusData.status === 'COMPLETED') {
        break;
      } else if (statusData.status === 'FAILED') {
        throw new Error(`Flux Fill job failed: ${statusData.error || 'unknown error'}`);
      }
    } catch (err: any) {
      if (err.message?.includes('job failed')) throw err;
      console.warn(`[Flux Fill] Poll error: ${err.message}`);
    }
  }

  // Step 3: Get result
  console.log(`[Flux Fill] Fetching result from: ${responseUrl}`);
  const resultRes = await fetch(responseUrl, {
    headers: { 'Authorization': `Key ${falKey}` },
    signal: AbortSignal.timeout(30000),
  });

  if (!resultRes.ok) {
    const errText = await resultRes.text().catch(() => '');
    console.error(`[Flux Fill] Result fetch ${resultRes.status}: ${errText.slice(0, 300)}`);
    throw new Error(`Flux Fill result fetch failed: ${resultRes.status}`);
  }

  const resultData: any = await resultRes.json();
  const imageUrl = resultData.images?.[0]?.url;

  if (!imageUrl) {
    console.error('[Flux Fill] No image in result:', JSON.stringify(resultData).slice(0, 500));
    throw new Error('Flux Fill returned no image');
  }

  return imageUrl;
}

/**
 * Download an image from fal.ai CDN (through proxy if needed).
 * fal.ai image URLs expire in ~10 minutes and are inaccessible from China.
 */
async function downloadFalImage(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;

  // If we have a proxy, rewrite the URL to go through it
  let downloadUrl = imageUrl;
  if (proxyUrl && imageUrl.includes('fal.media')) {
    // Replace https://v3.fal.media/... with proxy/fal-media/...
    downloadUrl = imageUrl.replace(/https?:\/\/[^/]*fal\.media\//, `${proxyUrl}/fal-media/`);
  }

  console.log(`[Flux Fill] Downloading from: ${downloadUrl.slice(0, 100)}...`);
  const res = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    // If proxy download fails, try direct
    if (downloadUrl !== imageUrl) {
      console.warn(`[Flux Fill] Proxy download failed, trying direct...`);
      const directRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60000) });
      if (!directRes.ok) throw new Error(`Download failed: ${directRes.status}`);
      return Buffer.from(await directRes.arrayBuffer());
    }
    throw new Error(`Download failed: ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Call Flux Fill (fal.ai) to inpaint trees onto a garden photo.
 *
 * Flow:
 * 1. Read original photo + get dimensions
 * 2. Generate mask from tree placement coordinates
 * 3. Call Flux Fill API (original + mask + prompt)
 * 4. Download result (fal URLs expire in ~10min, inaccessible from China)
 * 5. Save to local uploads directory
 */
export async function fluxFillAddTrees(
  options: FluxFillOptions,
): Promise<FluxFillResult> {
  const sharp = (await import('sharp')).default;

  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured');
  }

  // 1. Read original photo
  let absPath = options.gardenPhotoPath;
  if (!path.isAbsolute(absPath)) {
    absPath = path.join(process.cwd(), absPath);
  }
  const imageBuffer = fs.readFileSync(absPath);
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  console.log(`[Flux Fill] Original image: ${width}x${height}`);
  console.log(`[Flux Fill] Tree placements: ${options.treePlacements.length}`);

  // 2. Generate mask
  const maskBuffer = await generateMask(width, height, options.treePlacements);
  console.log(`[Flux Fill] Mask generated (${maskBuffer.length} bytes)`);

  // Save mask for debugging
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const maskFilename = `mask-${Date.now()}.png`;
  fs.writeFileSync(path.join(outputDir, maskFilename), maskBuffer);
  console.log(`[Flux Fill] Mask saved: ${maskFilename}`);

  // 3. Convert to base64 data URIs
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  const imageBase64 = `data:${mime};base64,${imageBuffer.toString('base64')}`;
  const maskBase64 = `data:image/png;base64,${maskBuffer.toString('base64')}`;

  // 4. Build prompt
  const prompt = buildFluxPrompt(options.treePlacements, options.styleName, options.userMessage);
  console.log(`[Flux Fill] Prompt: ${prompt.slice(0, 150)}...`);

  // 5. Call Flux Fill API
  const generatedUrl = await callFluxFillAPI(prompt, imageBase64, maskBase64);
  console.log(`[Flux Fill] Generated URL: ${generatedUrl.slice(0, 80)}...`);

  // 6. Download the image
  const imageData = await downloadFalImage(generatedUrl);

  // 7. Save to local uploads
  const filename = `ai-garden-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), imageData);
  console.log(`[Flux Fill] Saved: ${filename} (${imageData.length} bytes)`);

  return {
    imageUrl: `/uploads/ai-generated/${filename}`,
    prompt,
    maskSaved: `/uploads/ai-generated/${maskFilename}`,
  };
}
