/**
 * inT（输入转换工具）— 核心竞争力模块
 * 将客户输入（庭院照片 + 自选树木 + 文字需求）转换为标准化 DesignPlan。
 * 所有 AI 视觉模型共享同一份专有提示词和解析逻辑。
 */
import type { VisionInput, VisionOutput, TreeInfo } from './adapters/base-adapter.js';
import { routeVisionRequest, getModelHealthStatus } from './model-router.js';

// ─── 专有系统提示词（庭院设计专家，两天迭代打磨的领域知识）──────────
export const GARDEN_DESIGN_SYSTEM_PROMPT = `你是一位拥有20年经验的资深园林景观设计师，擅长私家庭院造型树木布局设计。
你的任务是根据用户上传的庭院照片和选择的树木，给出专业的园林设计建议。

重要原则：
1. 仔细分析庭院照片中的建筑风格、空间大小、光照方向
2. 【最关键】首先识别照片中所有已有的树木、植物、盆栽的位置，新树木必须避开这些位置！
3. 新树只能放在完全空旷的地面（水泥地、泥地、草地），绝不能与已有植物重叠
4. 考虑新树之间的间距、与建筑的距离、与已有植物的距离
5. 结合风水学原理给出建议
6. 给出合理的预算范围（基于树木规格）

【极其重要 — 已有植物避让规则】
- 你必须先观察照片中已经存在的树木、花草、盆栽的位置
- 新增树木的坐标必须与所有已有植物保持至少0.10的x距离
- 如果庭院已经很满（已有多棵树），只在明显空地处放1-2棵即可，不要强行摆满
- 绝不能让新树遮挡或覆盖已有的树木和植物

【极其重要】你必须为每棵树指定精确的摆放区域坐标！

坐标规则（必须严格遵守）：
- 使用0到1的比例坐标系，(0,0)是照片左上角，(1,1)是照片右下角
- x 是树木中心的横向位置（0=最左边，1=最右边）
- y 是树木底部/地面位置（重要：y是树脚落地的位置，不是树顶！）
- width,height 是树木占照片的比例大小
- 只在照片中可见的空地/草地/泥地上放树，绝对不能覆盖房屋、建筑、围墙、道路、已有植物、天空、车辆
- 仔细识别照片中地面的y坐标位置（通常在0.7-0.9之间），树的y值必须在地面线上

尺寸规则（非常关键，直接影响生成质量）：
- 远景树（照片远处）：width 0.06-0.10，height 0.10-0.20
- 中景树（照片中部）：width 0.08-0.14，height 0.15-0.30
- 近景树（照片前方）：width 0.10-0.18，height 0.25-0.40
- 树木区域越小越精确，生成效果越好！宁可偏小不要偏大
- 多棵树之间要有明显间距（至少0.05），绝对不能重叠

位置规则：
- 树木底部应该在地面线附近，不要悬空
- 远处的树y值较小（靠近地平线），近处的树y值较大
- 如果选了超过5棵树，只输出最重要的5棵树的坐标（选择最佳观赏位置）

地面处理规则：
- 如果用户提到地面处理需求（铺草皮、铺石板、铺鹅卵石、绿化空地等），必须返回groundTreatment字段
- groundTreatment.type: "grass"（草皮）、"stone"（石板）、"gravel"（鹅卵石）
- groundTreatment.prompt: 用英文描述地面效果，如 "lush green grass lawn covering all open ground"
- groundTreatment.groundRegion: 地面区域的y范围（通常 yStart: 0.60, yEnd: 0.95）
- 仅当用户明确提到地面需求时才返回此字段，否则不要返回

请严格按照以下JSON格式回复（不要包含markdown代码块标记）：
{
  "designSummary": "整体设计概述（2-3句话描述设计理念）",
  "spaceAnalysis": "对照片中庭院空间的分析（建筑风格、空间大小、光照、已有植物位置等）",
  "existingPlants": "描述照片中已有的树木和植物位置（如：左侧x=0.2处有一棵大树，右侧x=0.7处有盆栽）",
  "treePlacement": [
    {
      "treeName": "树木名称",
      "position": "建议摆放位置的文字描述（如：大门左侧3米处）",
      "reason": "选择此位置的原因",
      "x": 0.25,
      "y": 0.80,
      "width": 0.14,
      "height": 0.35
    }
  ],
  "styleAdvice": "结合所选风格的设计建议",
  "fengshuiTip": "风水方面的建议",
  "budgetEstimate": "预算估算说明",
  "groundTreatment": {
    "type": "grass",
    "prompt": "lush green grass lawn covering all open ground",
    "groundRegion": { "yStart": 0.60, "yEnd": 0.95 }
  }
}`;

// ─── 构建用户 Prompt ──────────────────────────────────────────────
export function buildUserPrompt(input: VisionInput): string {
  const treeDesc = input.trees
    .map(t => `${t.name}（${t.species}，高${(t.heightCm / 100).toFixed(1)}米，冠幅${(t.crownCm / 100).toFixed(1)}米）`)
    .join('\n');

  return `请分析这张庭院照片，并为以下选中的树木规划最佳种植位置：

选中的树木：
${treeDesc}

选择的庭院风格：${input.styleName}
${input.userMessage ? `用户需求说明：${input.userMessage}` : ''}

请仔细观察照片中的庭院空间，给出专业的设计建议。`;
}

// ─── 解析 AI 视觉模型的 JSON 响应 ────────────────────────────────
export function parseVisionResponse(content: string): VisionOutput {
  let parsed: any;
  try {
    let jsonStr = content.trim();
    // Remove markdown code block markers if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('AI分析结果格式解析失败');
      }
    } else {
      throw new Error('AI分析结果格式解析失败');
    }
  }

  return {
    designSummary: parsed.designSummary || '暂无设计概述',
    spaceAnalysis: parsed.spaceAnalysis || '暂无空间分析',
    treePlacement: Array.isArray(parsed.treePlacement) ? parsed.treePlacement : [],
    styleAdvice: parsed.styleAdvice || '暂无风格建议',
    fengshuiTip: parsed.fengshuiTip || '暂无风水建议',
    budgetEstimate: parsed.budgetEstimate || '暂无预算估算',
    groundTreatment: parsed.groundTreatment || undefined,
  };
}

// ─── 照片压缩（减少 API 传输和处理时间）──────────────────────────
export async function compressPhotoForVision(base64DataUri: string): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const base64Data = base64DataUri.split(',')[1];
    if (!base64Data) return base64DataUri;

    const buf = Buffer.from(base64Data, 'base64');
    const meta = await sharp(buf).metadata();
    const maxDim = 640; // Smaller for faster API processing

    if ((meta.width || 0) <= maxDim && (meta.height || 0) <= maxDim) {
      return base64DataUri;
    }

    const resized = await sharp(buf)
      .resize(maxDim, maxDim, { fit: 'inside' })
      .jpeg({ quality: 75 })
      .toBuffer();

    console.log(`[inT] Compressed photo: ${meta.width}x${meta.height} → ${maxDim}px max (${buf.length}b → ${resized.length}b)`);
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (err) {
    console.warn('[inT] Photo compression failed, using original:', err);
    return base64DataUri;
  }
}

// ─── inT 主入口 ────────────────────────────────────────────────────

export interface IntInput {
  gardenPhotoBase64: string;
  selectedTrees: Array<{
    treeId: string;
    name: string;
    species: string;
    coverImage: string;
    height: number;  // cm
    crown: number;   // cm
  }>;
  styleName: string;
  userMessage: string;
}

export interface DesignPlan {
  modelId: string;
  processingMs: number;
  designSummary: string;
  spaceAnalysis: string;
  placements: Array<{
    treeName: string;
    treeId: string;
    coverImage: string;
    x: number;
    y: number;
    width: number;
    height: number;
    position: string;
    reason: string;
  }>;
  groundTreatment?: {
    type: string;
    prompt: string;
    groundRegion: { yStart: number; yEnd: number };
  };
  styleAdvice: string;
  fengshuiTip: string;
  budgetEstimate: string;
}

/**
 * inT 主转换函数 — 将客户输入转换为标准化 DesignPlan。
 * 1. 压缩照片
 * 2. 通过模型路由器调用最优 AI 视觉模型
 * 3. 后处理：匹配树木、标准化坐标、应用布局偏好
 */
export async function transform(input: IntInput): Promise<DesignPlan> {
  console.log(`[inT] Starting transform: ${input.selectedTrees.length} trees, style: ${input.styleName}`);

  // 1. Compress photo
  const compressedPhoto = await compressPhotoForVision(input.gardenPhotoBase64);

  // 2. Build VisionInput for model router
  const visionInput: VisionInput = {
    gardenPhotoBase64: compressedPhoto,
    trees: input.selectedTrees.map(t => ({
      treeId: t.treeId,
      name: t.name,
      species: t.species,
      coverImage: t.coverImage,
      heightCm: t.height,
      crownCm: t.crown,
    })),
    styleName: input.styleName,
    userMessage: input.userMessage,
  };

  // 3. Route to best available model
  const result = await routeVisionRequest(visionInput);
  console.log(`[inT] Model ${result.modelId} returned ${result.treePlacement.length} placements in ${result.processingMs}ms`);

  // 4. Post-process: match AI tree names to our selected trees, enrich with metadata
  const placements = matchAndEnrichPlacements(result.treePlacement, input.selectedTrees);

  // 5. Apply layout preferences from user message
  const finalPlacements = applyLayoutPreferences(placements, input.userMessage);

  return {
    modelId: result.modelId,
    processingMs: result.processingMs,
    designSummary: result.designSummary,
    spaceAnalysis: result.spaceAnalysis,
    placements: finalPlacements,
    groundTreatment: result.groundTreatment,
    styleAdvice: result.styleAdvice,
    fengshuiTip: result.fengshuiTip,
    budgetEstimate: result.budgetEstimate,
  };
}

// ─── 树木匹配与坐标标准化 ─────────────────────────────────────────

function matchAndEnrichPlacements(
  aiPlacements: VisionOutput['treePlacement'],
  selectedTrees: IntInput['selectedTrees'],
): DesignPlan['placements'] {
  const placements: DesignPlan['placements'] = [];
  const usedTreeIds = new Set<string>();

  // Match AI placements to selected trees
  for (const tp of aiPlacements) {
    if (typeof tp.x !== 'number' || typeof tp.y !== 'number' ||
        typeof tp.width !== 'number' || typeof tp.height !== 'number') continue;

    const tree = findTreeByName(tp.treeName, selectedTrees);
    const treeId = tree?.treeId || '';
    if (treeId && usedTreeIds.has(treeId)) continue;
    if (treeId) usedTreeIds.add(treeId);

    // Clamp coordinates to safe ranges
    // AI returns: x=center of tree, y=ground level (bottom of tree)
    // per our system prompt instructions — do NOT add offset
    const clampedW = Math.max(0.08, Math.min(0.25, tp.width));
    const clampedH = Math.max(0.15, Math.min(0.40, tp.height));
    const centerX = Math.max(0.08, Math.min(0.92, tp.x));
    const groundY = Math.max(0.55, Math.min(0.92, tp.y));

    console.log(`[inT] AI coords for ${tp.treeName}: x=${tp.x}, y=${tp.y}, w=${tp.width}, h=${tp.height} → clamped: x=${centerX.toFixed(2)}, y=${groundY.toFixed(2)}, w=${clampedW.toFixed(2)}, h=${clampedH.toFixed(2)}`);

    placements.push({
      treeName: tree?.name || tp.treeName,
      treeId,
      coverImage: tree?.coverImage || '',
      x: centerX,
      y: groundY,
      width: clampedW,
      height: clampedH,
      position: tp.position,
      reason: tp.reason,
    });
  }

  // Add remaining trees with auto-generated coordinates
  for (const t of selectedTrees) {
    if (usedTreeIds.has(t.treeId)) continue;
    if (placements.length >= 5) break;
    usedTreeIds.add(t.treeId);
    const idx = placements.length;
    placements.push({
      treeName: t.name,
      treeId: t.treeId,
      coverImage: t.coverImage,
      x: 0.15 + (0.7 / (placements.length + 2)) * (idx + 1),
      y: 0.82,
      width: 0.14,
      height: 0.28,
      position: '自动分配位置',
      reason: 'AI未指定位置，按均匀分布放置',
    });
  }

  return placements.slice(0, 5);
}

function findTreeByName(aiName: string, trees: IntInput['selectedTrees']) {
  let tree = trees.find(t => t.name === aiName);
  if (tree) return tree;
  tree = trees.find(t => t.name.includes(aiName) || aiName.includes(t.name));
  if (tree) return tree;
  tree = trees.find(t => t.species === aiName || aiName.includes(t.species));
  return tree || null;
}

// ─── 布局偏好（对称、留车位、风水东南）───────────────────────────

function applyLayoutPreferences(
  placements: DesignPlan['placements'],
  msg: string,
): DesignPlan['placements'] {
  if (!msg) return placements;

  // 对称布局 — 树木左右对称镜像放置
  if (msg.includes('对称') && placements.length >= 2) {
    const result: DesignPlan['placements'] = [];
    const pairs = Math.floor(placements.length / 2);
    for (let i = 0; i < pairs; i++) {
      const left = placements[i * 2];
      const right = placements[i * 2 + 1];
      // Symmetrical offset from center: 0.25 for first pair, 0.15 for second, etc.
      const offset = 0.25 - i * 0.07;
      const sharedY = Math.max(left.y, right.y); // same ground level
      result.push({ ...left, x: 0.5 - offset, y: sharedY });
      result.push({ ...right, x: 0.5 + offset, y: sharedY });
    }
    if (placements.length % 2 === 1) {
      result.push({ ...placements[placements.length - 1], x: 0.5 });
    }
    console.log(`[inT] 对称布局: ${result.map(p => `${p.treeName}@(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(', ')}`);
    return result;
  }

  // 留车位 — clear center area, push trees to sides
  if (msg.includes('车位') || msg.includes('停车')) {
    console.log(`[inT] 留车位: clearing center for parking`);
    return placements.map(p => {
      if (p.x > 0.3 && p.x < 0.7) {
        return { ...p, x: p.x < 0.5 ? 0.15 : 0.85 };
      }
      return p;
    });
  }

  // 门口/入口两侧 — trees flanking entrance (center-bottom)
  if ((msg.includes('门口') || msg.includes('入口') || msg.includes('大门')) && placements.length >= 2) {
    console.log(`[inT] 门口布局: flanking entrance`);
    const result: DesignPlan['placements'] = [];
    result.push({ ...placements[0], x: 0.35, y: 0.85 });
    result.push({ ...placements[1], x: 0.65, y: 0.85 });
    for (let i = 2; i < placements.length; i++) {
      result.push(placements[i]);
    }
    return result;
  }

  // 沿墙/靠边 — trees along edges
  if (msg.includes('沿墙') || msg.includes('靠边') || msg.includes('围边') || msg.includes('边上')) {
    console.log(`[inT] 沿墙布局: placing trees along edges`);
    const count = placements.length;
    return placements.map((p, i) => {
      // Distribute along left and right edges
      const side = i % 2 === 0 ? 0.12 : 0.88;
      const yStep = 0.6 + (i / count) * 0.3; // spread vertically
      return { ...p, x: side, y: Math.min(0.92, yStep) };
    });
  }

  // 风水方位
  if (msg.includes('风水')) {
    // 东南方位 — southeast (bottom-right in image)
    if (msg.includes('东南')) {
      console.log(`[inT] 风水: 东南方位`);
      return placements.map((p, i) => {
        if (i === 0) return { ...p, x: 0.70, y: 0.80 };
        return p;
      });
    }
    // 西北 — northwest (top-left in image)
    if (msg.includes('西北')) {
      console.log(`[inT] 风水: 西北方位`);
      return placements.map((p, i) => {
        if (i === 0) return { ...p, x: 0.25, y: 0.60 };
        return p;
      });
    }
    // General fengshui — place main tree in auspicious position
    console.log(`[inT] 风水: 默认吉位`);
    return placements.map((p, i) => {
      if (i === 0) return { ...p, x: 0.65, y: 0.75 };
      return p;
    });
  }

  // 分散/均匀 — even distribution across garden
  if (msg.includes('分散') || msg.includes('均匀') || msg.includes('均布')) {
    console.log(`[inT] 均匀分散布局`);
    const count = placements.length;
    if (count <= 1) return placements;
    return placements.map((p, i) => {
      const xPos = 0.15 + (i / (count - 1)) * 0.70; // 0.15 to 0.85
      return { ...p, x: xPos };
    });
  }

  return placements;
}

/** Expose model health for diagnostics endpoint */
export { getModelHealthStatus };
