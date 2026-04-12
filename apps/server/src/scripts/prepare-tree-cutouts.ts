/**
 * Pre-process all tree product photos through BiRefNet → transparent PNG cutouts.
 * Run once (or when new trees are added) to eliminate runtime BiRefNet calls.
 *
 * Usage: tsx apps/server/src/scripts/prepare-tree-cutouts.ts
 *
 * Reads tree images from website/public/images/trees/*.jpg
 * Writes cutouts to website/public/images/trees/cutouts/*.png
 */
import fs from 'fs';
import path from 'path';

const TREES_DIR = path.join(process.cwd(), '..', 'website', 'public', 'images', 'trees');
const CUTOUTS_DIR = path.join(TREES_DIR, 'cutouts');

// In Docker, tree images are served by the website container
const DOCKER_TREES_DIR = '/app/apps/website/public/images/trees';
const DOCKER_CUTOUTS_DIR = path.join(DOCKER_TREES_DIR, 'cutouts');

function getTreesDir(): string {
  if (fs.existsSync(TREES_DIR)) return TREES_DIR;
  if (fs.existsSync(DOCKER_TREES_DIR)) return DOCKER_TREES_DIR;
  throw new Error(`Trees directory not found: tried ${TREES_DIR} and ${DOCKER_TREES_DIR}`);
}

function getCutoutsDir(): string {
  const treesDir = getTreesDir();
  const cutoutsDir = path.join(treesDir, 'cutouts');
  fs.mkdirSync(cutoutsDir, { recursive: true });
  return cutoutsDir;
}

async function downloadFalResult(imageUrl: string): Promise<Buffer> {
  const proxyUrl = process.env.FAL_PROXY_URL;

  // Try direct first
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {}

  // Try proxy
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

async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
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
      console.log(`  BiRefNet via ${ep.name}...`);
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${falKey}` },
        body: JSON.stringify({ image_url: base64 }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        console.warn(`  ${ep.name} error ${res.status}`);
        continue;
      }

      const data: any = await res.json();
      const resultUrl = data.image?.url;
      if (!resultUrl) continue;

      return await downloadFalResult(resultUrl);
    } catch (err: any) {
      console.warn(`  ${ep.name} failed: ${err.message}`);
    }
  }

  throw new Error('BiRefNet failed on all endpoints');
}

async function cropPot(sharp: any, cutoutBuf: Buffer): Promise<Buffer> {
  const meta = await sharp(cutoutBuf).metadata();
  const cropH = Math.round(meta.height! * 0.85);
  return sharp(cutoutBuf)
    .extract({ left: 0, top: 0, width: meta.width!, height: cropH })
    .png()
    .toBuffer();
}

async function main() {
  const sharp = (await import('sharp')).default;
  const treesDir = getTreesDir();
  const cutoutsDir = getCutoutsDir();

  console.log(`Trees dir: ${treesDir}`);
  console.log(`Cutouts dir: ${cutoutsDir}`);

  const treeFiles = fs.readdirSync(treesDir)
    .filter(f => /^HY\d+\.jpg$/i.test(f))
    .sort();

  console.log(`Found ${treeFiles.length} tree images`);

  let success = 0;
  let failed = 0;

  for (const file of treeFiles) {
    const treeId = file.replace('.jpg', '');
    const cutoutPath = path.join(cutoutsDir, `${treeId}.png`);

    // Skip if already processed
    if (fs.existsSync(cutoutPath)) {
      const stat = fs.statSync(cutoutPath);
      if (stat.size > 1000) {
        console.log(`[${treeId}] Already cached (${(stat.size / 1024).toFixed(0)}KB), skipping`);
        success++;
        continue;
      }
    }

    console.log(`[${treeId}] Processing...`);
    const t0 = Date.now();

    try {
      const imgBuf = fs.readFileSync(path.join(treesDir, file));
      const cutoutBuf = await removeBackground(imgBuf);
      const croppedBuf = await cropPot(sharp, cutoutBuf);

      fs.writeFileSync(cutoutPath, croppedBuf);
      const elapsed = Date.now() - t0;
      console.log(`[${treeId}] OK — ${(croppedBuf.length / 1024).toFixed(0)}KB in ${elapsed}ms`);
      success++;

      // Small delay between API calls
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error(`[${treeId}] FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} success, ${failed} failed out of ${treeFiles.length}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
