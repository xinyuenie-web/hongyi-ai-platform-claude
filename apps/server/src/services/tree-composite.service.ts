import fs from 'fs';
import path from 'path';

export interface TreeCompositeItem {
  treeName: string;
  imageUrl: string; // tree cover image URL or path (e.g. /images/trees/HY0001.jpg)
  x: number;        // 0-1 ratio, CENTER x of placement area
  y: number;        // 0-1 ratio, BOTTOM edge of tree (ground level)
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
      console.log(`[TreeComposite] Reading from local: ${localPath}`);
      return fs.readFileSync(localPath);
    }
    // In Docker, fetch from website service or nginx
    const urls = [
      `http://website:3000${imageUrl}`,
      `http://nginx:80${imageUrl}`,
    ];
    for (const url of urls) {
      try {
        console.log(`[TreeComposite] Fetching: ${url}`);
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          console.log(`[TreeComposite] Fetched ${buf.length} bytes from ${url}`);
          return buf;
        }
        console.warn(`[TreeComposite] HTTP ${res.status} from ${url}`);
      } catch (err: any) {
        console.warn(`[TreeComposite] Fetch failed: ${url} - ${err.message}`);
      }
    }
    throw new Error(`Cannot fetch tree image: ${imageUrl}`);
  }

  // /uploads/ path
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
    throw new Error(`Upload not found: ${imageUrl}`);
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

  throw new Error(`Failed to download: ${imageUrl.slice(0, 80)}`);
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

  // Proxy first — server is in China, direct fal.run may be blocked or rate-limited
  const endpoints: Array<{ name: string; url: string }> = [];
  if (proxyUrl) {
    endpoints.push({ name: 'proxy', url: `${proxyUrl}/fal-sync/fal-ai/birefnet` });
  }
  endpoints.push({ name: 'direct', url: 'https://fal.run/fal-ai/birefnet' });

  for (const ep of endpoints) {
    try {
      console.log(`[TreeComposite] BiRefNet via ${ep.name} (${ep.url.slice(0, 60)})...`);
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falKey}`,
        },
        body: JSON.stringify({ image_url: base64 }),
        signal: AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.warn(`[TreeComposite] BiRefNet ${ep.name} error ${res.status}: ${errBody.slice(0, 300)}`);
        continue;
      }

      const data: any = await res.json();
      console.log(`[TreeComposite] BiRefNet ${ep.name} response keys: ${Object.keys(data).join(',')}`);
      const resultUrl = data.image?.url;
      if (!resultUrl) {
        console.warn(`[TreeComposite] BiRefNet ${ep.name}: no image.url in response. data.image=${JSON.stringify(data.image)?.slice(0, 200)}`);
        continue;
      }

      console.log(`[TreeComposite] BiRefNet succeeded via ${ep.name}, downloading result...`);
      return await downloadFalResult(resultUrl);
    } catch (err: any) {
      console.warn(`[TreeComposite] BiRefNet ${ep.name} failed: ${err.message} ${err.cause || ''}`);
    }
  }

  throw new Error('Background removal failed on all endpoints');
}

/**
 * Create a soft-edge version of an image (fallback when BiRefNet fails).
 * Adds a feathered elliptical mask so the tree blends into the garden.
 */
async function createSoftEdgeOverlay(
  sharp: any,
  imageBuffer: Buffer,
  targetW: number,
  targetH: number,
): Promise<Buffer> {
  // Resize image
  const resized = await sharp(imageBuffer)
    .resize(targetW, targetH, { fit: 'cover' })
    .png()
    .toBuffer();

  // Create an elliptical alpha mask with feathered edges
  const cx = Math.round(targetW / 2);
  const cy = Math.round(targetH / 2);
  const rx = Math.round(targetW * 0.45);
  const ry = Math.round(targetH * 0.48);
  // Use radial gradient for soft edges via SVG
  const maskSvg = Buffer.from(
    `<svg width="${targetW}" height="${targetH}">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" rx="50%" ry="50%">
          <stop offset="60%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#g)"/>
    </svg>`,
  );

  // Apply the mask as alpha channel
  const mask = await sharp(maskSvg).resize(targetW, targetH).greyscale().png().toBuffer();

  return sharp(resized)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/**
 * Composite real tree photos onto a garden photo.
 *
 * Flow:
 * 1. Read garden photo, resize if too large
 * 2. For each tree (SEQUENTIAL to avoid rate limiting):
 *    a. Read tree's cover image
 *    b. Try BiRefNet for background removal → transparent PNG
 *    c. If BiRefNet fails, create soft-edge overlay as fallback
 *    d. Resize to fit placement area
 * 3. Composite all tree overlays onto garden photo
 * 4. Save result
 *
 * Coordinate convention:
 * - x: center of tree (0-1), y: bottom of tree / ground level (0-1)
 * - width/height: tree dimensions (0-1 ratio of image size)
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

  console.log(`[TreeComposite] Processing ${options.trees.length} trees on ${baseW}x${baseH} garden...`);

  // Sort trees by y coordinate (ascending) — far trees first, near trees on top
  const sortedTrees = [...options.trees].sort((a, b) => a.y - b.y);

  // 2. Process trees SEQUENTIALLY (avoids BiRefNet rate limiting)
  const overlays: Array<{ input: Buffer; left: number; top: number; y: number }> = [];

  for (let idx = 0; idx < sortedTrees.length; idx++) {
    const tree = sortedTrees[idx];
    console.log(`[TreeComposite] Tree ${idx + 1}/${sortedTrees.length}: ${tree.treeName} (${tree.imageUrl})`);

    // Delay between BiRefNet API calls to avoid rate limiting
    if (idx > 0) {
      console.log(`[TreeComposite] Waiting 2s before next BiRefNet call...`);
      await new Promise(r => setTimeout(r, 2000));
    }

    try {
      // Read tree image
      const treeImgBuf = await readTreeImage(tree.imageUrl);
      console.log(`[TreeComposite] Tree ${idx + 1} image: ${treeImgBuf.length} bytes`);

      // Perspective scaling: trees further away (smaller y) appear smaller
      const perspectiveScale = 0.6 + (tree.y - 0.5) * 0.8; // y=0.5→60%, y=1.0→100%
      const clampedScale = Math.max(0.5, Math.min(1.0, perspectiveScale));

      // Calculate target dimensions with perspective
      const rawW = Math.max(40, Math.round(tree.width * baseW));
      const rawH = Math.max(60, Math.round(tree.height * baseH));
      const targetW = Math.round(rawW * clampedScale);
      const targetH = Math.round(rawH * clampedScale);

      // Position: x is center of tree, y is bottom of tree (ground level)
      const targetX = Math.max(0, Math.min(baseW - targetW, Math.round(tree.x * baseW - targetW / 2)));
      const targetY = Math.max(0, Math.min(baseH - targetH, Math.round(tree.y * baseH - targetH)));

      let overlayBuf: Buffer;

      // Try BiRefNet background removal
      try {
        const cutoutBuf = await removeBackground(treeImgBuf);
        console.log(`[TreeComposite] Tree ${idx + 1} BiRefNet cutout: ${cutoutBuf.length} bytes`);

        // Crop bottom 20% to remove pot/container
        const cutoutMeta = await sharp(cutoutBuf).metadata();
        const cropH = Math.round(cutoutMeta.height! * 0.80);
        const croppedCutout = await sharp(cutoutBuf)
          .extract({ left: 0, top: 0, width: cutoutMeta.width!, height: cropH })
          .png()
          .toBuffer();
        console.log(`[TreeComposite] Tree ${idx + 1} pot cropped: ${cutoutMeta.height}→${cropH}px`);

        // Resize cropped cutout to target dimensions
        overlayBuf = await sharp(croppedCutout)
          .resize(targetW, targetH, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
      } catch (bgErr: any) {
        // Fallback: soft-edge overlay (still shows the tree, just with blended edges)
        console.warn(`[TreeComposite] Tree ${idx + 1} BiRefNet failed: ${bgErr.message}, using soft-edge fallback`);
        overlayBuf = await createSoftEdgeOverlay(sharp, treeImgBuf, targetW, targetH);
      }

      // Generate shadow (elliptical, semi-transparent, below tree)
      const shadowW = Math.round(targetW * 0.6);
      const shadowH = Math.round(shadowW * 0.2);
      const shadowX = Math.max(0, Math.min(baseW - shadowW, targetX + Math.round((targetW - shadowW) / 2)));
      const shadowY = Math.min(baseH - shadowH, targetY + targetH - Math.round(shadowH * 0.3));
      const shadowSvg = Buffer.from(
        `<svg width="${shadowW}" height="${shadowH}">
          <defs>
            <radialGradient id="sg" cx="50%" cy="50%" rx="50%" ry="50%">
              <stop offset="0%" stop-color="black" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="black" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <ellipse cx="${shadowW / 2}" cy="${shadowH / 2}" rx="${shadowW / 2}" ry="${shadowH / 2}" fill="url(#sg)"/>
        </svg>`,
      );
      const shadowBuf = await sharp(shadowSvg).png().toBuffer();

      // Shadow first (behind tree), then tree on top
      overlays.push({ input: shadowBuf, left: shadowX, top: shadowY, y: tree.y - 0.001 });
      console.log(`[TreeComposite] Tree ${idx + 1} overlay: ${targetW}x${targetH} at (${targetX},${targetY}) scale=${clampedScale.toFixed(2)}`);
      overlays.push({ input: overlayBuf, left: targetX, top: targetY, y: tree.y });
    } catch (err: any) {
      console.error(`[TreeComposite] Tree ${idx + 1} (${tree.treeName}) FAILED entirely: ${err.message}`);
    }
  }

  if (overlays.length === 0) {
    throw new Error('所有树木图片处理失败，无法生成效果图');
  }

  // Sort overlays by y (far→near) for correct depth layering
  overlays.sort((a, b) => a.y - b.y);

  console.log(`[TreeComposite] Compositing ${overlays.length} layers onto garden...`);

  // 3. Composite all overlays onto garden photo
  const result = await sharp(baseBuffer)
    .composite(overlays.map(o => ({ input: o.input, left: o.left, top: o.top })))
    .jpeg({ quality: 90 })
    .toBuffer();

  // 4. Save result
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `ai-garden-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), result);
  console.log(`[TreeComposite] Saved: ${filename} (${result.length} bytes, ${overlays.length} trees)`);

  return { imageUrl: `/api/v1/ai/image/${filename}` };
}
