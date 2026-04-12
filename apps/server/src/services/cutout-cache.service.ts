/**
 * Background tree cutout cache service.
 * On server startup, checks for missing cutouts and generates them via BiRefNet.
 * Cutouts are saved to uploads/cutouts/ (server-local, Docker volume persistent).
 */
import fs from 'fs';
import path from 'path';

// Server-local cutout storage (persists via Docker uploads volume)
const CUTOUTS_DIR = path.join(process.cwd(), 'uploads', 'cutouts');

// Tree source directories
const LOCAL_TREES_DIR = path.join(process.cwd(), '..', 'website', 'public', 'images', 'trees');

function getTreeFileList(): string[] {
  // Try local filesystem first (dev mode)
  if (fs.existsSync(LOCAL_TREES_DIR)) {
    return fs.readdirSync(LOCAL_TREES_DIR)
      .filter(f => /^HY\d+\.jpg$/i.test(f))
      .sort();
  }
  // In Docker, we know the tree IDs from HY0001-HY0010
  // (they're served by the website container, not on our filesystem)
  return Array.from({ length: 10 }, (_, i) => `HY${String(i + 1).padStart(4, '0')}.jpg`);
}

async function readTreeImage(treeId: string): Promise<Buffer> {
  // Try local filesystem (dev mode)
  const localPath = path.join(LOCAL_TREES_DIR, `${treeId}.jpg`);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  // In Docker, fetch from website service
  const urls = [
    `http://website:3000/images/trees/${treeId}.jpg`,
    `http://nginx:80/images/trees/${treeId}.jpg`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
  }
  throw new Error(`Cannot read tree image: ${treeId}`);
}

async function downloadFalResult(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {}
  if (proxyUrl) {
    try {
      const urlObj = new URL(imageUrl);
      const cdnUrl = `${proxyUrl}/fal-cdn/${urlObj.host}${urlObj.pathname}`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(30000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
  }
  throw new Error(`Failed to download: ${imageUrl.slice(0, 80)}`);
}

async function removeBackgroundBiRefNet(imageBuffer: Buffer): Promise<Buffer> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not set');

  const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const proxyUrl = process.env.FAL_PROXY_URL;

  const endpoints = [
    { name: 'direct', url: 'https://fal.run/fal-ai/birefnet' },
    ...(proxyUrl ? [{ name: 'proxy', url: `${proxyUrl}/fal-sync/fal-ai/birefnet` }] : []),
  ];

  for (const ep of endpoints) {
    try {
      console.log(`[CutoutCache]   BiRefNet via ${ep.name}...`);
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${falKey}` },
        body: JSON.stringify({ image_url: base64 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        console.warn(`[CutoutCache]   ${ep.name} error ${res.status}`);
        continue;
      }
      const data: any = await res.json();
      const resultUrl = data.image?.url;
      if (!resultUrl) continue;
      return await downloadFalResult(resultUrl);
    } catch (err: any) {
      console.warn(`[CutoutCache]   ${ep.name} failed: ${err.message}`);
    }
  }
  throw new Error('BiRefNet failed on all endpoints');
}

/**
 * Run in background after server startup.
 * Checks for missing cutouts and generates them one at a time.
 * Saves to uploads/cutouts/ which persists via Docker volume.
 */
export async function prepareTreeCutoutsBackground(): Promise<void> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.log('[CutoutCache] FAL_KEY not set, skipping cutout preparation');
    return;
  }

  // Wait 10s for website container to be ready
  await new Promise(r => setTimeout(r, 10000));

  fs.mkdirSync(CUTOUTS_DIR, { recursive: true });

  const treeFiles = getTreeFileList();
  console.log(`[CutoutCache] Found ${treeFiles.length} tree images to check`);

  // Count how many need processing
  const missing: string[] = [];
  for (const file of treeFiles) {
    const treeId = file.replace(/\.jpg$/i, '');
    const cutoutPath = path.join(CUTOUTS_DIR, `${treeId}.png`);
    if (fs.existsSync(cutoutPath) && fs.statSync(cutoutPath).size > 1000) continue;
    missing.push(file);
  }

  if (missing.length === 0) {
    console.log(`[CutoutCache] All ${treeFiles.length} cutouts cached, nothing to do`);
    return;
  }

  console.log(`[CutoutCache] ${missing.length}/${treeFiles.length} cutouts missing, generating in background...`);

  let sharp: any;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('[CutoutCache] Sharp not available, skipping');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const file of missing) {
    const treeId = file.replace(/\.jpg$/i, '');
    const cutoutPath = path.join(CUTOUTS_DIR, `${treeId}.png`);

    try {
      console.log(`[CutoutCache] Processing ${treeId}...`);
      const t0 = Date.now();
      const imgBuf = await readTreeImage(treeId);
      const cutoutBuf = await removeBackgroundBiRefNet(imgBuf);

      // Crop bottom 15% to remove pot
      const meta = await sharp(cutoutBuf).metadata();
      const cropH = Math.round(meta.height! * 0.85);
      const croppedBuf = await sharp(cutoutBuf)
        .extract({ left: 0, top: 0, width: meta.width!, height: cropH })
        .png()
        .toBuffer();

      fs.writeFileSync(cutoutPath, croppedBuf);
      const elapsed = Date.now() - t0;
      console.log(`[CutoutCache] ${treeId} OK — ${(croppedBuf.length / 1024).toFixed(0)}KB in ${elapsed}ms`);
      success++;

      // 2s delay between API calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`[CutoutCache] ${treeId} FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`[CutoutCache] Done: ${success} generated, ${failed} failed, ${treeFiles.length - missing.length} already cached`);
}
