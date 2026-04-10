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
 * Call Flux Fill API using SYNCHRONOUS mode (no polling needed).
 *
 * Uses fal.ai synchronous endpoint: POST https://fal.run/...
 * This blocks until the result is ready (~30-60s), avoiding polling issues.
 * Through proxy: POST http://proxy:8462/fal-sync/...
 *
 * If sync API fails, falls back to QUEUE API (submit + poll).
 */
async function callFluxFillAPI(
  prompt: string,
  imageBase64: string,
  maskBase64: string,
): Promise<string> {
  const falKey = process.env.FAL_KEY!;
  const proxyUrl = process.env.FAL_PROXY_URL; // e.g., http://43.129.236.142:8462
  const modelId = 'fal-ai/flux-pro/v1/fill';

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

  // Try sync API with each available endpoint
  // Strategy 1: Direct fal.run (sometimes works from China!)
  // Strategy 2: Via HK proxy /fal-sync/
  const syncEndpoints: Array<{ name: string; url: string }> = [];
  // Always try direct first (it's faster when it works)
  syncEndpoints.push({ name: 'direct fal.run', url: `https://fal.run/${modelId}` });
  if (proxyUrl) {
    syncEndpoints.push({ name: 'HK proxy fal-sync', url: `${proxyUrl}/fal-sync/${modelId}` });
  }

  for (const endpoint of syncEndpoints) {
    console.log(`[Flux Fill] Trying sync: ${endpoint.name} → ${endpoint.url.slice(0, 80)}...`);
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(300000), // 5 min timeout
      });

      if (res.ok) {
        const data: any = await res.json();
        console.log(`[Flux Fill] ${endpoint.name} response keys:`, Object.keys(data));
        const imageUrl = data.images?.[0]?.url;
        if (imageUrl) {
          console.log(`[Flux Fill] Image generated via ${endpoint.name}: ${imageUrl.slice(0, 80)}...`);
          return imageUrl;
        }
        console.error(`[Flux Fill] ${endpoint.name}: no image in response`);
      } else {
        const errBody = await res.text().catch(() => 'unknown');
        console.error(`[Flux Fill] ${endpoint.name} error ${res.status}:`, errBody.slice(0, 300));
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Flux Fill认证失败(${res.status}): 请检查FAL_KEY是否有效、余额是否充足`);
        }
      }
    } catch (err: any) {
      if (err.message.includes('认证失败')) throw err;
      console.warn(`[Flux Fill] ${endpoint.name} failed: ${err.message}`);
    }
  }

  // Strategy 3: Queue API (submit + poll) — last resort
  const queueEndpoints: Array<{ name: string; base: string }> = [];
  queueEndpoints.push({ name: 'direct queue', base: 'https://queue.fal.run' });
  if (proxyUrl) {
    queueEndpoints.push({ name: 'proxy queue', base: `${proxyUrl}/fal` });
  }

  const queueBase = queueEndpoints[0].base;
  const submitUrl = `${queueBase}/${modelId}`;

  console.log(`[Flux Fill] Strategy 2: Queue API via ${submitUrl.slice(0, 80)}...`);
  try {
    // Submit job
    const submitRes = await fetch(submitUrl, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(30000),
    });

    if (!submitRes.ok) {
      const errBody = await submitRes.text().catch(() => 'unknown');
      throw new Error(`Queue submit failed (${submitRes.status}): ${errBody.slice(0, 200)}`);
    }

    const submitData: any = await submitRes.json();
    const requestId = submitData.request_id;
    if (!requestId) {
      throw new Error('Queue API returned no request_id');
    }
    console.log(`[Flux Fill] Job submitted: ${requestId}`);

    // Poll for result (up to 5 min, every 5s)
    const statusBase = proxyUrl
      ? `${proxyUrl}/fal`
      : 'https://queue.fal.run';
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusUrl = `${statusBase}/${modelId}/requests/${requestId}/status`;
      try {
        const statusRes = await fetch(statusUrl, {
          headers: { 'Authorization': `Key ${falKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!statusRes.ok) continue;

        const statusData: any = await statusRes.json();
        console.log(`[Flux Fill] Poll ${i + 1}: status=${statusData.status}`);

        if (statusData.status === 'COMPLETED') {
          // Fetch result
          const resultUrl = `${statusBase}/${modelId}/requests/${requestId}`;
          const resultRes = await fetch(resultUrl, {
            headers: { 'Authorization': `Key ${falKey}` },
            signal: AbortSignal.timeout(15000),
          });
          if (resultRes.ok) {
            const resultData: any = await resultRes.json();
            const imageUrl = resultData.images?.[0]?.url;
            if (imageUrl) {
              console.log(`[Flux Fill] Image generated via queue: ${imageUrl.slice(0, 80)}...`);
              return imageUrl;
            }
          }
        } else if (statusData.status === 'FAILED') {
          throw new Error(`Flux Fill job failed: ${JSON.stringify(statusData).slice(0, 200)}`);
        }
      } catch (pollErr: any) {
        if (pollErr.message.includes('job failed')) throw pollErr;
        console.warn(`[Flux Fill] Poll error: ${pollErr.message}`);
      }
    }
    throw new Error('Flux Fill queue timeout: job did not complete in 5 minutes');
  } catch (err: any) {
    console.error(`[Flux Fill] Queue API also failed: ${err.message}`);
    throw new Error(`Flux Fill全部策略失败。同步API和队列API均不可用。请检查: 1) 香港代理是否运行 2) fal.ai余额 3) 网络连通性。错误: ${err.message}`);
  }
}

/**
 * Download an image from fal.ai CDN (through proxy if needed).
 * fal.ai image URLs expire in ~10 minutes and are inaccessible from China.
 *
 * Uses HK proxy's /fal-download/ endpoint which accepts the full URL as query param,
 * avoiding hostname mismatch issues (v3.fal.media vs v3b.fal.media etc.)
 */
async function downloadFalImage(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Strategy 1: Direct download (try first — sometimes works from China, and it's faster)
  console.log(`[Flux Fill] Download strategy 1: direct → ${imageUrl.slice(0, 100)}...`);
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`[Flux Fill] Direct download succeeded (${buf.length} bytes)`);
      return buf;
    }
    console.warn(`[Flux Fill] Direct download HTTP ${res.status}`);
  } catch (err: any) {
    console.warn(`[Flux Fill] Direct download failed: ${err.message}`);
  }

  // Strategy 2: Download through HK proxy (fal.media is blocked in China)
  if (proxyUrl) {
    try {
      const urlObj = new URL(imageUrl);
      const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
      console.log(`[Flux Fill] Download strategy 2: proxy → ${cdnUrl.slice(0, 120)}...`);
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(60000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        console.log(`[Flux Fill] Proxy download succeeded (${buf.length} bytes)`);
        return buf;
      }
      console.warn(`[Flux Fill] Proxy download HTTP ${res.status}`);
    } catch (err: any) {
      console.warn(`[Flux Fill] Proxy download error: ${err.message}`);
    }
  }

  throw new Error(`图片下载失败: 直连和代理均不可用。图片URL: ${imageUrl.slice(0, 80)}`);
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
  const rawBuffer = fs.readFileSync(absPath);
  const rawMeta = await sharp(rawBuffer).metadata();
  const rawWidth = rawMeta.width!;
  const rawHeight = rawMeta.height!;
  console.log(`[Flux Fill] Original image: ${rawWidth}x${rawHeight} (${rawBuffer.length} bytes)`);

  // Resize if too large — fal.ai works best with images ≤1536px, and base64 payload
  // must stay reasonable (<10MB). Resize to max 1024px on longest side for reliability.
  const MAX_DIM = 1024;
  let imageBuffer: Buffer;
  let width: number;
  let height: number;

  if (rawWidth > MAX_DIM || rawHeight > MAX_DIM) {
    const resized = sharp(rawBuffer).resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 });
    imageBuffer = await resized.toBuffer();
    const newMeta = await sharp(imageBuffer).metadata();
    width = newMeta.width!;
    height = newMeta.height!;
    console.log(`[Flux Fill] Resized to: ${width}x${height} (${imageBuffer.length} bytes, was ${rawBuffer.length})`);
  } else {
    imageBuffer = rawBuffer;
    width = rawWidth;
    height = rawHeight;
  }

  console.log(`[Flux Fill] Tree placements: ${options.treePlacements.length}`);

  // 2. Generate mask (must match resized dimensions)
  const maskBuffer = await generateMask(width, height, options.treePlacements);
  console.log(`[Flux Fill] Mask generated (${maskBuffer.length} bytes)`);

  // Save mask for debugging
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const maskFilename = `mask-${Date.now()}.png`;
  fs.writeFileSync(path.join(outputDir, maskFilename), maskBuffer);
  console.log(`[Flux Fill] Mask saved: ${maskFilename}`);

  // 3. Convert to base64 data URIs (always jpeg for smaller payload)
  const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const maskBase64 = `data:image/png;base64,${maskBuffer.toString('base64')}`;
  const payloadSizeMB = ((imageBase64.length + maskBase64.length) / 1024 / 1024).toFixed(1);
  console.log(`[Flux Fill] Base64 payload: ~${payloadSizeMB}MB (image: ${imageBase64.length}, mask: ${maskBase64.length})`);

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
