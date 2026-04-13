import fs from 'fs';
import path from 'path';

// Cutout cache directories (server-local storage)
const SERVER_CUTOUTS_DIR = path.join(process.cwd(), 'uploads', 'cutouts');
const LOCAL_WEBSITE_CUTOUTS_DIR = path.join(process.cwd(), '..', 'website', 'public', 'images', 'trees', 'cutouts');

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
    // Short timeouts — tree images should be available locally in Docker
    const urls = [
      `http://website:3000${imageUrl}`,
      `http://nginx:80${imageUrl}`,
    ];
    for (const url of urls) {
      try {
        console.log(`[TreeComposite] Fetching: ${url}`);
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) }); // 3s timeout (was 10s)
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
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    throw new Error(`Failed to fetch: ${imageUrl} (${res.status})`);
  }

  throw new Error(`Unknown image URL format: ${imageUrl}`);
}

/**
 * Try to load a pre-processed cutout from cache.
 * Returns transparent PNG buffer if cached, null otherwise.
 * Checks local filesystem first, then Docker website service.
 */
async function tryLoadCachedCutout(imageUrl: string): Promise<Buffer | null> {
  // Extract tree ID from URL (e.g. /images/trees/HY0001.jpg → HY0001)
  const match = imageUrl.match(/\/(HY\d+)\.\w+$/i);
  if (!match) return null;
  const treeId = match[1].toUpperCase();
  const filename = `${treeId}.png`;

  // Check server-local uploads/cutouts directory (Docker persistent volume)
  const serverPath = path.join(SERVER_CUTOUTS_DIR, filename);
  if (fs.existsSync(serverPath)) {
    const stat = fs.statSync(serverPath);
    if (stat.size > 1000) {
      console.log(`[TreeComposite] Cache HIT (server): ${treeId} (${(stat.size / 1024).toFixed(0)}KB)`);
      return fs.readFileSync(serverPath);
    }
  }

  // Check website public directory (dev mode)
  const localPath = path.join(LOCAL_WEBSITE_CUTOUTS_DIR, filename);
  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    if (stat.size > 1000) {
      console.log(`[TreeComposite] Cache HIT (local): ${treeId} (${(stat.size / 1024).toFixed(0)}KB)`);
      return fs.readFileSync(localPath);
    }
  }

  // In Docker: fetch pre-built cutouts from website container
  const cutoutUrls = [
    `http://website:3000/images/trees/cutouts/${filename}`,
    `http://nginx:80/images/trees/cutouts/${filename}`,
  ];
  for (const url of cutoutUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000) {
          console.log(`[TreeComposite] Cache HIT (website): ${treeId} (${(buf.length / 1024).toFixed(0)}KB)`);
          // Save locally for faster access next time
          try {
            fs.mkdirSync(SERVER_CUTOUTS_DIR, { recursive: true });
            fs.writeFileSync(path.join(SERVER_CUTOUTS_DIR, filename), buf);
          } catch {}
          return buf;
        }
      }
    } catch {}
  }

  console.log(`[TreeComposite] Cache MISS: ${treeId}`);
  return null;
}

/**
 * Save a cropped cutout to cache for future use (fire-and-forget).
 * Called after successful BiRefNet removal during compositing.
 */
function saveCutoutToCache(imageUrl: string, cutoutBuf: Buffer): void {
  try {
    const match = imageUrl.match(/\/(HY\d+)\.\w+$/i);
    if (!match) return;
    const treeId = match[1].toUpperCase();
    fs.mkdirSync(SERVER_CUTOUTS_DIR, { recursive: true });
    const cachePath = path.join(SERVER_CUTOUTS_DIR, `${treeId}.png`);
    if (!fs.existsSync(cachePath) || fs.statSync(cachePath).size < 1000) {
      fs.writeFileSync(cachePath, cutoutBuf);
      console.log(`[TreeComposite] Cached cutout: ${treeId} (${(cutoutBuf.length / 1024).toFixed(0)}KB)`);
    }
  } catch (err: any) {
    console.warn(`[TreeComposite] Failed to cache cutout: ${err.message}`);
  }
}

/**
 * Download image from fal.ai CDN (handles China blocking via proxy).
 */
async function downloadFalResult(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Try direct download first (short timeout — if it doesn't work quickly, skip)
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
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
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(10000) });
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

// BiRefNet circuit breaker — skip API calls after repeated failures
// Aggressive: open after just 1 failure (BiRefNet is consistently unreliable from China)
let birefnetFailCount = 0;
let birefnetLastSuccess = 0;
const BIREFNET_MAX_FAILS = 3; // Open circuit after 3 failures (was 1 — too aggressive)
const BIREFNET_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown

/**
 * Remove background from a tree image using fal.ai BiRefNet.
 * Returns a PNG buffer with transparent background.
 * Includes circuit breaker to skip after repeated failures.
 */
async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  // Circuit breaker: skip BiRefNet if it keeps failing
  if (birefnetFailCount >= BIREFNET_MAX_FAILS) {
    const elapsed = Date.now() - birefnetLastSuccess;
    if (elapsed < BIREFNET_COOLDOWN_MS) {
      throw new Error(`BiRefNet circuit open (${birefnetFailCount} failures, cooldown ${Math.round((BIREFNET_COOLDOWN_MS - elapsed) / 1000)}s)`);
    }
    // Cooldown expired, reset and retry
    console.log('[TreeComposite] BiRefNet circuit reset after cooldown');
    birefnetFailCount = 0;
  }
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not configured');

  const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Direct first (faster), proxy as fallback (China may block fal.ai intermittently)
  const endpoints: Array<{ name: string; url: string }> = [
    { name: 'direct', url: 'https://fal.run/fal-ai/birefnet' },
  ];
  if (proxyUrl) {
    endpoints.push({ name: 'proxy', url: `${proxyUrl}/fal-sync/fal-ai/birefnet` });
  }

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
        signal: AbortSignal.timeout(10000), // 10s timeout (was 20s)
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
      const result = await downloadFalResult(resultUrl);
      birefnetFailCount = 0;
      birefnetLastSuccess = Date.now();
      return result;
    } catch (err: any) {
      console.warn(`[TreeComposite] BiRefNet ${ep.name} failed: ${err.message} ${err.cause || ''}`);
    }
  }

  birefnetFailCount++;
  console.warn(`[TreeComposite] BiRefNet failed on all endpoints (failure #${birefnetFailCount}/${BIREFNET_MAX_FAILS})`);
  throw new Error('Background removal failed on all endpoints');
}

/**
 * Create a background-removed version of a tree image.
 *
 * HYBRID APPROACH:
 * 1. Sample corner pixels to determine background type
 * 2. WHITE background → RGB+saturation color-key removal
 * 3. NON-WHITE background → center-weighted oval mask with heavy gaussian blur
 *
 * Most tree product photos are shot in outdoor nurseries with complex backgrounds,
 * so the oval mask is the primary fallback. BiRefNet cached cutouts are always preferred.
 */
async function createSoftEdgeOverlay(
  sharp: any,
  imageBuffer: Buffer,
  targetW: number,
  targetH: number,
): Promise<Buffer> {
  // Step 1: Crop bottom 25% to remove pot/container
  const origMeta = await sharp(imageBuffer).metadata();
  const origW = origMeta.width || 500;
  const origH = origMeta.height || 500;
  const cropH = Math.round(origH * 0.75);
  const cropped = await sharp(imageBuffer)
    .extract({ left: 0, top: 0, width: origW, height: cropH })
    .toBuffer();

  // Step 2: Resize to target
  const resized = await sharp(cropped)
    .resize(targetW, targetH, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Step 3: Detect background type by sampling corner pixels
  const rawBuf = await sharp(resized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: rgbaData, info } = rawBuf;
  const w = info.width;
  const h = info.height;

  // Sample corners (top-left, top-right, bottom-left, bottom-right) — 5x5 areas
  const cornerSamples: Array<{ r: number; g: number; b: number; a: number }> = [];
  const sampleSize = 5;
  const corners = [
    [0, 0], [w - sampleSize, 0],
    [0, h - sampleSize], [w - sampleSize, h - sampleSize],
  ];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        const px = Math.min(cx + dx, w - 1);
        const py = Math.min(cy + dy, h - 1);
        const idx = (py * w + px) * 4;
        cornerSamples.push({
          r: rgbaData[idx], g: rgbaData[idx + 1],
          b: rgbaData[idx + 2], a: rgbaData[idx + 3],
        });
      }
    }
  }

  // Check if corners are predominantly white/light (studio photo)
  const opaqueSamples = cornerSamples.filter(s => s.a > 200);
  const whiteSamples = opaqueSamples.filter(s => {
    const brightness = (s.r + s.g + s.b) / 3;
    const maxC = Math.max(s.r, s.g, s.b);
    const minC = Math.min(s.r, s.g, s.b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    return brightness > 200 && sat < 0.15;
  });
  const isWhiteBackground = opaqueSamples.length > 0 &&
    (whiteSamples.length / opaqueSamples.length) > 0.6;

  console.log(`[TreeComposite] Background detection: ${isWhiteBackground ? 'WHITE' : 'COMPLEX'} (${whiteSamples.length}/${opaqueSamples.length} white corners)`);

  if (isWhiteBackground) {
    // === WHITE BACKGROUND: color-key removal ===
    return createColorKeyOverlay(sharp, resized, rgbaData, w, h);
  } else {
    // === COMPLEX BACKGROUND: oval vignette mask ===
    return createOvalMaskOverlay(sharp, resized, w, h);
  }
}

/** Color-key removal for white/light backgrounds */
async function createColorKeyOverlay(
  sharp: any, resizedBuf: Buffer, rgbaData: Buffer, w: number, h: number,
): Promise<Buffer> {
  const pixelCount = w * h;
  const maskData = Buffer.alloc(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const r = rgbaData[i * 4];
    const g = rgbaData[i * 4 + 1];
    const b = rgbaData[i * 4 + 2];
    const a = rgbaData[i * 4 + 3];

    if (a < 10) { maskData[i] = 0; continue; }

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
    const brightness = maxC;

    if (brightness >= 240 && saturation < 0.06) {
      maskData[i] = 0;
    } else if (brightness >= 220 && saturation < 0.10) {
      const bFade = (brightness - 220) / 35;
      const sFade = 1 - saturation / 0.10;
      maskData[i] = Math.round(255 * (1 - Math.min(1, bFade * sFade)));
    } else if (brightness >= 200 && saturation < 0.05) {
      const fade = (brightness - 200) / 55;
      maskData[i] = Math.round(255 * (1 - fade * 0.7));
    } else {
      maskData[i] = 255;
    }
  }

  const maskImg = await sharp(maskData, { raw: { width: w, height: h, channels: 1 } })
    .blur(2.0).png().toBuffer();

  const masked = await sharp(resizedBuf)
    .ensureAlpha()
    .composite([{ input: maskImg, blend: 'dest-in' }])
    .png().toBuffer();

  // Suppress white fringe on semi-transparent edges
  const finalRaw = await sharp(masked).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { data: fd, info: fi } = finalRaw;
  for (let i = 0; i < fi.width * fi.height; i++) {
    const fa = fd[i * 4 + 3];
    if (fa > 10 && fa < 200) {
      const f = fa / 255;
      fd[i * 4]     = Math.round(fd[i * 4]     * (0.5 + 0.5 * f));
      fd[i * 4 + 1] = Math.round(fd[i * 4 + 1] * (0.5 + 0.5 * f));
      fd[i * 4 + 2] = Math.round(fd[i * 4 + 2] * (0.5 + 0.5 * f));
    }
  }
  return sharp(fd, { raw: { width: fi.width, height: fi.height, channels: 4 } })
    .png().toBuffer();
}

/**
 * Oval vignette mask for complex (non-white) backgrounds.
 * Keeps the center 60% fully opaque, fades to transparent at edges.
 * Uses heavy gaussian blur for natural, seamless blending.
 */
async function createOvalMaskOverlay(
  sharp: any, resizedBuf: Buffer, w: number, h: number,
): Promise<Buffer> {
  const cx = w / 2;
  const cy = h * 0.40; // center slightly above middle (tree crown is usually top-heavy)
  const rx = w * 0.30;  // horizontal radius: 30% of width (was 38% — tighter to cut more background)
  const ry = h * 0.40;  // vertical radius: 40% of height (was 46% — tighter)

  const maskData = Buffer.alloc(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalized distance from center (1.0 = on ellipse boundary)
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let alpha: number;
      if (dist <= 0.50) {
        alpha = 255; // fully opaque core (was 0.65 — tighter core)
      } else if (dist <= 0.85) {
        // Steep cosine falloff from 0.50 to 0.85 (was 0.65-1.0 — faster fade)
        const t = (dist - 0.50) / 0.35;
        alpha = Math.round(255 * (0.5 + 0.5 * Math.cos(Math.PI * t)));
      } else {
        alpha = 0; // fully transparent outside
      }

      maskData[y * w + x] = alpha;
    }
  }

  // Heavy gaussian blur on the mask for very soft, natural edges
  const maskImg = await sharp(maskData, { raw: { width: w, height: h, channels: 1 } })
    .blur(Math.max(5, Math.round(Math.min(w, h) * 0.06))) // 6% of image size, min 5px (was 4%/3px)
    .png()
    .toBuffer();

  return sharp(resizedBuf)
    .ensureAlpha()
    .composite([{ input: maskImg, blend: 'dest-in' }])
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

  // 2. Process ALL trees in PARALLEL (critical for speed — each BiRefNet call takes 15-45s)
  console.log(`[TreeComposite] Processing ${sortedTrees.length} trees in PARALLEL...`);
  const overlays: Array<{ input: Buffer; left: number; top: number; y: number }> = [];

  async function processOneTree(tree: TreeCompositeItem, idx: number): Promise<Array<{ input: Buffer; left: number; top: number; y: number }>> {
    const results: Array<{ input: Buffer; left: number; top: number; y: number }> = [];
    try {
      const treeImgBuf = await readTreeImage(tree.imageUrl);
      console.log(`[TreeComposite] Tree ${idx + 1} image: ${treeImgBuf.length} bytes`);

      // Perspective scaling: trees further away (smaller y) appear noticeably smaller
      const perspectiveScale = 0.55 + (tree.y - 0.5) * 0.9; // steeper curve for better depth
      const clampedScale = Math.max(0.5, Math.min(1.0, perspectiveScale));

      const rawTreeW = Math.max(40, Math.round(tree.width * baseW));
      const rawTreeH = Math.max(60, Math.round(tree.height * baseH));
      const targetW = Math.round(rawTreeW * clampedScale);
      const targetH = Math.round(rawTreeH * clampedScale);

      // Position: x is center of tree, y is bottom of tree (ground level)
      const targetX = Math.max(0, Math.min(baseW - targetW, Math.round(tree.x * baseW - targetW / 2)));
      const targetY = Math.max(0, Math.min(baseH - targetH, Math.round(tree.y * baseH - targetH)));

      let overlayBuf: Buffer;

      // Step 1: Try cached cutout (pre-processed, instant)
      const cachedCutout = await tryLoadCachedCutout(tree.imageUrl);

      if (cachedCutout) {
        // Cache hit — crop bottom 12% to ensure pot/container is fully removed
        const cachedMeta = await sharp(cachedCutout).metadata();
        const cachedH = cachedMeta.height || 500;
        const cachedW = cachedMeta.width || 500;
        const safeH = Math.round(cachedH * 0.88);
        const croppedCutout = await sharp(cachedCutout)
          .extract({ left: 0, top: 0, width: cachedW, height: safeH })
          .resize(targetW, targetH, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .ensureAlpha()
          .png()
          .toBuffer();

        // Refine edges: suppress white fringing on semi-transparent pixels
        const cachedRaw = await sharp(croppedCutout).ensureAlpha().raw()
          .toBuffer({ resolveWithObject: true });
        const { data: cd, info: ci } = cachedRaw;
        for (let px = 0; px < ci.width * ci.height; px++) {
          const ca = cd[px * 4 + 3];
          if (ca > 10 && ca < 200) {
            const f = ca / 255;
            cd[px * 4]     = Math.round(cd[px * 4]     * (0.5 + 0.5 * f));
            cd[px * 4 + 1] = Math.round(cd[px * 4 + 1] * (0.5 + 0.5 * f));
            cd[px * 4 + 2] = Math.round(cd[px * 4 + 2] * (0.5 + 0.5 * f));
          }
        }
        overlayBuf = await sharp(cd, { raw: { width: ci.width, height: ci.height, channels: 4 } })
          .png().toBuffer();
        console.log(`[TreeComposite] Tree ${idx + 1} using CACHED cutout (cropped ${cachedW}x${cachedH}→${cachedW}x${safeH}) → ${targetW}x${targetH}`);
      } else {
        // No cache — use soft-edge fallback IMMEDIATELY (BiRefNet is unreliable from China)
        // BiRefNet is only used by background cutout-cache.service.ts (async, non-blocking)
        console.log(`[TreeComposite] Tree ${idx + 1} no cache → instant soft-edge fallback`);
        overlayBuf = await createSoftEdgeOverlay(sharp, treeImgBuf, targetW, targetH);
      }

      // Generate shadow
      const shadowW = Math.round(targetW * 0.6);
      const shadowH = Math.round(shadowW * 0.2);
      const shadowX = Math.max(0, Math.min(baseW - shadowW, targetX + Math.round((targetW - shadowW) / 2)));
      const shadowY = Math.min(baseH - shadowH, targetY + targetH - Math.round(shadowH * 0.3));
      const shadowSvg = Buffer.from(
        `<svg width="${shadowW}" height="${shadowH}">
          <defs>
            <radialGradient id="sg${idx}" cx="50%" cy="50%" rx="50%" ry="50%">
              <stop offset="0%" stop-color="black" stop-opacity="0.40"/>
              <stop offset="100%" stop-color="black" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <ellipse cx="${shadowW / 2}" cy="${shadowH / 2}" rx="${shadowW / 2}" ry="${shadowH / 2}" fill="url(#sg${idx})"/>
        </svg>`,
      );
      const shadowBuf = await sharp(shadowSvg).png().toBuffer();

      results.push({ input: shadowBuf, left: shadowX, top: shadowY, y: tree.y - 0.001 });
      console.log(`[TreeComposite] Tree ${idx + 1} overlay: ${targetW}x${targetH} at (${targetX},${targetY}) scale=${clampedScale.toFixed(2)}`);
      results.push({ input: overlayBuf, left: targetX, top: targetY, y: tree.y });
    } catch (err: any) {
      console.error(`[TreeComposite] Tree ${idx + 1} (${tree.treeName}) FAILED: ${err.message}`);
    }
    return results;
  }

  const treeResults = await Promise.all(
    sortedTrees.map((tree, idx) => processOneTree(tree, idx))
  );
  for (const r of treeResults) {
    overlays.push(...r);
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
