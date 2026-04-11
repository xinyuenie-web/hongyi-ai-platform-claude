/**
 * ouT（输出转换工具）— 将 DesignPlan 转换为最终效果图。
 *
 * 策略：
 * 1. 树木合成策略（BiRefNet + Sharp）— 树木 = 产品照片100%匹配
 * 2. 地面处理策略（Flux Fill）— 阶段2，暂不启用
 * 3. 混合策略 — 先合成树，再处理地面
 *
 * 当前仅实现策略1（树木合成），地面处理待阶段2。
 */
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
}

/**
 * ouT 主转换函数 — 将 DesignPlan + 庭院照片转换为效果图。
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

  // Strategy 1: BiRefNet + Sharp compositing
  const result = await compositeTreesOnGarden({
    gardenPhotoPath,
    trees: compositeItems,
  });

  const processingMs = Date.now() - t0;
  console.log(`[ouT] Composite complete in ${processingMs}ms`);

  // TODO Phase 2: Ground treatment via Flux Fill
  // if (designPlan.groundTreatment) { ... }

  return {
    imageUrl: result.imageUrl,
    strategy: 'composite',
    treeCount: compositeItems.length,
    processingMs,
  };
}
