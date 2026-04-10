import fs from 'fs';
import path from 'path';

export interface TreeCompositeItem {
  treeName: string;
  imageUrl: string; // tree cover image URL or path (e.g. /images/trees/HY0001.jpg)
  x: number;        // 0-1 ratio, left edge of placement area
  y: number;        // 0-1 ratio, top edge of placement area
  width: number;    // 0-1 ratio
  height: number;   // 0-1 ratio
}

/**
 * Read a tree image from its URL/path.
 * Handles local paths (/images/..., /uploads/...) and full URLs.
 * In Docker, fetches from the website service for /images/ paths.
 */
async function readTreeImage(imageUrl: string): Promise<Buffer> {
  if (!imageUrl) throw new Error('No image URL provided');

  // /images/ path — served by Next.js website container
  if (imageUrl.startsWith('/images/')) {
    // Try local filesystem first (works in dev)
    const localPath = path.join(process.cwd(), '..', 'website', 'public', imageUrl);
    if (fs.existsSync(localPath)) {
      console.log(`[TreeComposite] Reading tree image from local: ${localPath}`);
      return fs.readFileSync(localPath);
    }
    // In Docker, fetch from website service
    const dockerUrl = `http://website:3000${imageUrl}`;
    console.log(`[TreeComposite] Fetching tree image from Docker: ${dockerUrl}`);
    const res = await fetch(dockerUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // Fallback: try nginx
    const nginxUrl = `http://nginx:80${imageUrl}`;
    const res2 = await fetch(nginxUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
    if (res2?.ok) return Buffer.from(await res2.arrayBuffer());
    throw new Error(`Cannot fetch tree image: ${imageUrl}`);
  }

  // /uploads/ path
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
    throw new Error(`Upload file not found: ${imageUrl}`);
  }

  // Full URL
  if (imageUrl.startsWith('http')) {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    throw new Error(`Failed to fetch: ${imageUrl} (${res.status})`);
  }

  throw new Error(`Unknown image URL format: ${imageUrl}`);
}

/**
 * Remove background from a tree image using fal.ai BiRefNet.
 * Returns a PNG buffer with transparent background.
 */
async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not configured');

  const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Try direct fal.run first (works from China for API calls)
  const endpoints = [
    { name: 'direct', url: 'https://fal.run/fal-ai/birefnet' },
  ];
  if (proxyUrl) {
    endpoints.push({ name: 'proxy', url: `${proxyUrl}/fal-sync/fal-ai/birefnet` });
  }

  for (const ep of endpoints) {
    try {
      console.log(`[TreeComposite] BiRefNet via ${ep.name}...`);
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falKey}`,
        },
        body: JSON.stringify({ image_url: base64 }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn(`[TreeComposite] BiRefNet ${ep.name} error ${res.status}: ${errBody.slice(0, 200)}`);
        continue;
      }

      const data: any = await res.json();
      const resultUrl = data.image?.url;
      if (!resultUrl) {
        console.warn(`[TreeComposite] BiRefNet ${ep.name}: no image in response`);
        continue;
      }

      console.log(`[TreeComposite] BiRefNet succeeded, downloading result...`);
      // Download the result PNG (transparent background)
      return await downloadFalResult(resultUrl);
    } catch (err: any) {
      console.warn(`[TreeComposite] BiRefNet ${ep.name} failed: ${err.message}`);
    }
  }

  throw new Error('Background removal failed on all endpoints');
}

/**
 * Download image from fal.ai CDN (handles China blocking via proxy).
 */
async function downloadFalResult(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Try direct download first
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`[TreeComposite] Direct download: ${buf.length} bytes`);
      return buf;
    }
  } catch (err: any) {
    console.warn(`[TreeComposite] Direct download failed: ${err.message}`);
  }

  // Try proxy
  if (proxyUrl) {
    try {
      const urlObj = new URL(imageUrl);
      const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        console.log(`[TreeComposite] Proxy download: ${buf.length} bytes`);
        return buf;
      }
    } catch (err: any) {
      console.warn(`[TreeComposite] Proxy download failed: ${err.message}`);
    }
  }

  throw new Error(`Failed to download fal result: ${imageUrl.slice(0, 80)}`);
}

/**
 * Composite real tree photos onto a garden photo.
 *
 * Flow:
 * 1. Read garden photo, resize if too large
 * 2. For each tree (parallel):
 *    a. Read tree's cover image
 *    b. Remove background via fal.ai BiRefNet → transparent PNG
 *    c. Resize to fit placement area
 * 3. Composite all cutout trees onto garden photo with sharp
 * 4. Add subtle drop shadows for realism
 * 5. Save result
 */
export async function compositeTreesOnGarden(options: {
  gardenPhotoPath: string;
  trees: TreeCompositeItem[];
}): Promise<{ imageUrl: string }> {
  const sharp = (await import('sharp')).default;

  // 1. Read and resize garden photo
  let absPath = options.gardenPhotoPath;
  if (!path.isAbsolute(absPath)) absPath = path.join(process.cwd(), absPath);
  const rawBuffer = fs.readFileSync(absPath);
  const rawMeta = await sharp(rawBuffer).metadata();
  const rawW = rawMeta.width!;
  const rawH = rawMeta.height!;

  const MAX_DIM = 1200;
  let baseBuffer: Buffer;
  let baseW: number;
  let baseH: number;

  if (rawW > MAX_DIM || rawH > MAX_DIM) {
    const scale = MAX_DIM / Math.max(rawW, rawH);
    baseW = Math.round(rawW * scale);
    baseH = Math.round(rawH * scale);
    baseBuffer = await sharp(rawBuffer).resize(baseW, baseH).jpeg({ quality: 92 }).toBuffer();
    console.log(`[TreeComposite] Garden resized: ${rawW}x${rawH} → ${baseW}x${baseH}`);
  } else {
    baseBuffer = rawBuffer;
    baseW = rawW;
    baseH = rawH;
  }

  console.log(`[TreeComposite] Processing ${options.trees.length} trees...`);

  // 2. Process all trees in parallel: read → remove bg → resize
  const treeResults = await Promise.allSettled(
    options.trees.map(async (tree, idx) => {
      console.log(`[TreeComposite] Tree ${idx + 1}/${options.trees.length}: ${tree.treeName} (${tree.imageUrl})`);

      // Read tree image
      const treeImgBuf = await readTreeImage(tree.imageUrl);
      console.log(`[TreeComposite] Tree ${idx + 1} image: ${treeImgBuf.length} bytes`);

      // Remove background → transparent PNG
      const cutoutBuf = await removeBackground(treeImgBuf);
      console.log(`[TreeComposite] Tree ${idx + 1} cutout: ${cutoutBuf.length} bytes`);

      // Calculate target dimensions and position
      const targetW = Math.max(20, Math.round(tree.width * baseW));
      const targetH = Math.max(30, Math.round(tree.height * baseH));
      const targetX = Math.max(0, Math.min(baseW - targetW, Math.round(tree.x * baseW)));
      const targetY = Math.max(0, Math.min(baseH - targetH, Math.round(tree.y * baseH)));

      // Resize cutout to fit placement area (contain = preserve aspect ratio)
      const resized = await sharp(cutoutBuf)
        .resize(targetW, targetH, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      console.log(`[TreeComposite] Tree ${idx + 1} resized to ${targetW}x${targetH} at (${targetX},${targetY})`);

      return {
        input: resized,
        left: targetX,
        top: targetY,
        treeName: tree.treeName,
      };
    }),
  );

  // Collect successful results
  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const result of treeResults) {
    if (result.status === 'fulfilled') {
      overlays.push(result.value);
    } else {
      console.error(`[TreeComposite] Tree processing failed:`, result.reason?.message || result.reason);
    }
  }

  if (overlays.length === 0) {
    throw new Error('所有树木图片处理失败，无法生成效果图');
  }

  console.log(`[TreeComposite] Compositing ${overlays.length} trees onto garden...`);

  // 3. Composite all tree cutouts onto garden photo
  const result = await sharp(baseBuffer)
    .composite(overlays)
    .jpeg({ quality: 90 })
    .toBuffer();

  // 4. Save result
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `ai-garden-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), result);
  console.log(`[TreeComposite] Saved: ${filename} (${result.length} bytes)`);

  return { imageUrl: `/api/v1/ai/image/${filename}` };
}
