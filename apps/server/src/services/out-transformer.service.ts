/**
 * ouT（输出转换工具）— 将 DesignPlan 转换为最终效果图。
 *
 * 策略：
 * 1. 树木合成策略（BiRefNet + Sharp）— 树木 = 产品照片100%匹配
 * 2. 地面处理策略（Sharp叠加）— 铺草皮/石板/鹅卵石，即时完成
 * 3. 混合策略 — 先合成树，再处理地面
 */
import fs from 'fs';
import path from 'path';
import type { DesignPlan } from './int-transformer.service.js';
import { compositeTreesOnGarden } from './tree-composite.service.js';

export interface OutInput {
  gardenPhotoPath: string;
  designPlan: DesignPlan;
}

export interface OutResult {
  imageUrl: string;
  strategy: string;
  treeCount: number;
  processingMs: number;
  groundTreated?: boolean;
  _outTiming?: Record<string, number>; // debug timing breakdown
}

/**
 * Apply ground treatment using Sharp overlay (instant, no API call).
 * Creates a semi-transparent colored texture overlay on the ground region,
 * avoiding tree placement areas.
 */
async function applyGroundTreatmentSharp(
  compositeImagePath: string,
  groundTreatment: NonNullable<DesignPlan['groundTreatment']>,
  treePlacements: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<string> {
  const sharp = (await import('sharp')).default;

  const imgBuf = fs.readFileSync(compositeImagePath);
  const meta = await sharp(imgBuf).metadata();
  const w = meta.width!;
  const h = meta.height!;

  const yStart = Math.round(groundTreatment.groundRegion.yStart * h);
  const yEnd = Math.round(groundTreatment.groundRegion.yEnd * h);
  const groundH = yEnd - yStart;

  if (groundH <= 10) {
    console.warn('[ouT] Ground region too small, skipping');
    throw new Error('Ground region too small');
  }

  // Choose color scheme based on type
  let baseColor: string;
  let gradientStops: string;
  let opacity: number;

  switch (groundTreatment.type) {
    case 'grass':
      baseColor = 'rgb(45,140,35)';
      gradientStops = `
        <stop offset="0%" stop-color="rgb(50,150,35)" stop-opacity="0.65"/>
        <stop offset="40%" stop-color="rgb(40,135,28)" stop-opacity="0.60"/>
        <stop offset="80%" stop-color="rgb(35,120,22)" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="rgb(30,100,18)" stop-opacity="0.45"/>`;
      opacity = 0.6;
      break;
    case 'stone':
      baseColor = 'rgb(150,145,140)';
      gradientStops = `
        <stop offset="0%" stop-color="rgb(160,155,150)" stop-opacity="0.50"/>
        <stop offset="50%" stop-color="rgb(140,135,130)" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="rgb(120,115,110)" stop-opacity="0.35"/>`;
      opacity = 0.45;
      break;
    case 'gravel':
      baseColor = 'rgb(185,175,160)';
      gradientStops = `
        <stop offset="0%" stop-color="rgb(195,185,170)" stop-opacity="0.45"/>
        <stop offset="50%" stop-color="rgb(175,165,150)" stop-opacity="0.40"/>
        <stop offset="100%" stop-color="rgb(160,150,135)" stop-opacity="0.30"/>`;
      opacity = 0.4;
      break;
    default:
      baseColor = 'rgb(45,140,35)';
      gradientStops = `
        <stop offset="0%" stop-color="rgb(55,160,40)" stop-opacity="0.50"/>
        <stop offset="100%" stop-color="rgb(35,120,25)" stop-opacity="0.35"/>`;
      opacity = 0.45;
  }

  // Build tree exclusion masks (only protect trunk/base area, not full canopy)
  const treeExclusions = treePlacements.map(t => {
    // Only exclude trunk area (narrow column at base), not full tree width
    const trunkW = t.width * 0.35; // trunk is ~35% of canopy width
    const treeLeft = Math.max(0, Math.round((t.x - trunkW / 2) * w));
    const treeRight = Math.min(w, Math.round((t.x + trunkW / 2) * w));
    const treeBottom = Math.round(t.y * h);
    // Only protect bottom 30% of tree (trunk area touching ground)
    const protectH = Math.round(t.height * h * 0.3);
    const treeTop = Math.max(yStart, treeBottom - protectH);
    const pw = treeRight - treeLeft;
    const ph = treeBottom - treeTop;
    if (pw <= 0 || ph <= 0 || treeTop >= yEnd) return '';
    const rx = Math.round(pw * 0.4);
    return `<rect x="${treeLeft}" y="${treeTop - yStart}" width="${pw}" height="${ph}" rx="${rx}" fill="black"/>`;
  }).filter(Boolean).join('\n');

  // Create ground overlay with gradient + texture dots
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // Add texture dots for more natural look
  const dots: string[] = [];
  const dotCount = groundTreatment.type === 'gravel' ? 500 : groundTreatment.type === 'grass' ? 400 : 250;
  for (let i = 0; i < dotCount; i++) {
    const dx = rand() * w;
    const dy = rand() * groundH;
    const dr = 1 + rand() * (groundTreatment.type === 'gravel' ? 4 : 2);
    const dOpacity = 0.1 + rand() * 0.2;
    const shade = groundTreatment.type === 'grass'
      ? `rgb(${30 + Math.round(rand() * 40)},${100 + Math.round(rand() * 80)},${15 + Math.round(rand() * 30)})`
      : groundTreatment.type === 'stone'
        ? `rgb(${120 + Math.round(rand() * 60)},${115 + Math.round(rand() * 60)},${110 + Math.round(rand() * 60)})`
        : `rgb(${160 + Math.round(rand() * 50)},${150 + Math.round(rand() * 50)},${130 + Math.round(rand() * 50)})`;
    dots.push(`<circle cx="${dx.toFixed(0)}" cy="${dy.toFixed(0)}" r="${dr.toFixed(1)}" fill="${shade}" opacity="${dOpacity.toFixed(2)}"/>`);
  }

  // Create the overlay SVG
  const overlaySvg = Buffer.from(
    `<svg width="${w}" height="${groundH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
          ${gradientStops}
        </linearGradient>
        <mask id="gm">
          <rect width="${w}" height="${groundH}" fill="white"/>
          ${treeExclusions}
        </mask>
      </defs>
      <g mask="url(#gm)">
        <rect width="${w}" height="${groundH}" fill="url(#gg)"/>
        ${dots.join('\n')}
      </g>
    </svg>`,
  );

  // Composite the overlay onto the image
  const overlayBuf = await sharp(overlaySvg).png().toBuffer();

  const resultBuf = await sharp(imgBuf)
    .composite([{
      input: overlayBuf,
      left: 0,
      top: yStart,
      blend: 'over',
    }])
    .jpeg({ quality: 90 })
    .toBuffer();

  // Save result
  const outputDir = path.join(process.cwd(), 'uploads', 'ai-generated');
  const filename = `ai-garden-ground-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(outputDir, filename), resultBuf);
  console.log(`[ouT] Ground treatment (Sharp): ${filename} (${(resultBuf.length / 1024).toFixed(0)}KB), type=${groundTreatment.type}`);

  return `/api/v1/ai/image/${filename}`;
}

/**
 * ouT 主转换函数 — 将 DesignPlan + 庭院照片转换为效果图。
 *
 * Flow:
 * 1. Composite trees onto garden photo (BiRefNet + Sharp)
 * 2. If ground treatment requested, apply Sharp overlay (instant)
 */
export async function transform(input: OutInput): Promise<OutResult> {
  const t0 = Date.now();
  const { designPlan, gardenPhotoPath } = input;

  // Build composite items from DesignPlan placements
  const compositeItems = designPlan.placements
    .filter(p => p.coverImage)
    .slice(0, 5)
    .map(p => ({
      treeName: p.treeName,
      imageUrl: p.coverImage,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    }));

  if (compositeItems.length === 0) {
    throw new Error('所选树木没有产品照片，无法生成效果图');
  }

  console.log(`[ouT] Compositing ${compositeItems.length} trees onto garden...`);

  // Step 1: BiRefNet + Sharp compositing (trees)
  const tComposite = Date.now();
  const compositeResult = await compositeTreesOnGarden({
    gardenPhotoPath,
    trees: compositeItems,
  });
  console.log(`[ouT] Tree compositing took ${Date.now() - tComposite}ms`);

  let finalImageUrl = compositeResult.imageUrl;
  let groundTreated = false;
  let strategy = 'composite';

  const compositeMs = Date.now() - tComposite;

  // Step 2: Ground treatment via Sharp overlay (instant, <1s)
  const tGroundStart = Date.now();
  if (designPlan.groundTreatment) {
    try {
      console.log(`[ouT] Applying ground treatment: ${designPlan.groundTreatment.type}...`);

      const compositeFilename = compositeResult.imageUrl.replace('/api/v1/ai/image/', '');
      const compositeImagePath = path.join(process.cwd(), 'uploads', 'ai-generated', compositeFilename);

      if (!fs.existsSync(compositeImagePath)) {
        console.warn(`[ouT] Composite image not found at ${compositeImagePath}`);
      } else {
        const treePlacementsForMask = compositeItems.map(t => ({
          x: t.x, y: t.y, width: t.width, height: t.height,
        }));

        finalImageUrl = await applyGroundTreatmentSharp(
          compositeImagePath,
          designPlan.groundTreatment,
          treePlacementsForMask,
        );
        groundTreated = true;
        strategy = 'composite+ground';
        console.log(`[ouT] Ground treatment complete`);
      }
    } catch (err: any) {
      console.warn(`[ouT] Ground treatment failed (non-fatal): ${err.message}`);
    }
  }
  const groundMs = Date.now() - tGroundStart;

  const processingMs = Date.now() - t0;
  console.log(`[ouT] ${strategy} complete in ${processingMs}ms (composite=${compositeMs}ms, ground=${groundMs}ms)`);

  return {
    imageUrl: finalImageUrl,
    strategy,
    treeCount: compositeItems.length,
    processingMs,
    groundTreated,
    _outTiming: { compositeMs, groundMs, totalMs: processingMs },
  };
}
