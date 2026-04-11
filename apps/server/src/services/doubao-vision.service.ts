import fs from 'fs';
import path from 'path';

const DOUBAO_VISION_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_VISION_MODEL = process.env.DOUBAO_VISION_MODEL || 'doubao-seed-2-0-pro-260215';

interface TreeInfo {
  name: string;
  species: string;
  height: number;
  crown: number;
}

export interface AIDesignAdvice {
  designSummary: string;
  spaceAnalysis: string;
  treePlacement: Array<{
    treeName: string;
    position: string;
    reason: string;
    x: number;      // center x of tree (0-1 ratio, 0=left edge, 1=right edge)
    y: number;      // ground level / bottom of tree (0-1 ratio, 0=top edge, 1=bottom edge)
    width: number;  // width of tree area (0-1 ratio)
    height: number; // height of tree area (0-1 ratio)
  }>;
  styleAdvice: string;
  fengshuiTip: string;
  budgetEstimate: string;
}

/**
 * Read a local file and convert to base64 data URI.
 */
function fileToBase64DataUri(filePath: string): string {
  let absPath = filePath;
  if (!path.isAbsolute(filePath)) {
    absPath = path.join(process.cwd(), filePath);
  }
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const SYSTEM_PROMPT = `你是一位拥有20年经验的资深园林景观设计师，擅长私家庭院造型树木布局设计。
你的任务是根据用户上传的庭院照片和选择的树木，给出专业的园林设计建议。

重要原则：
1. 仔细分析庭院照片中的建筑风格、空间大小、光照方向、现有植物
2. 根据实际庭院空间，合理规划每棵树的摆放位置
3. 考虑树木之间的间距、与建筑的距离、视觉层次
4. 结合风水学原理给出建议
5. 给出合理的预算范围（基于树木规格）

【极其重要】你必须为每棵树指定精确的摆放区域坐标！

坐标规则（必须严格遵守）：
- 使用0到1的比例坐标系，(0,0)是照片左上角，(1,1)是照片右下角
- x 是树木中心的横向位置（0=最左边，1=最右边）
- y 是树木底部/地面位置（重要：y是树脚落地的位置，不是树顶！）
- width,height 是树木占照片的比例大小
- 只在照片中可见的空地/草地/泥地上放树，绝对不能覆盖房屋、建筑、围墙、道路、已有植物、天空
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

请严格按照以下JSON格式回复（不要包含markdown代码块标记）：
{
  "designSummary": "整体设计概述（2-3句话描述设计理念）",
  "spaceAnalysis": "对照片中庭院空间的分析（建筑风格、空间大小、光照等）",
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
  "budgetEstimate": "预算估算说明"
}`;

/**
 * Compress garden photo to max 768px for vision API — reduces base64 size
 * dramatically and speeds up API response.
 */
async function compressPhotoForVision(base64DataUri: string): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const base64Data = base64DataUri.split(',')[1];
    if (!base64Data) return base64DataUri;

    const buf = Buffer.from(base64Data, 'base64');
    const meta = await sharp(buf).metadata();
    const maxDim = 768;

    if ((meta.width || 0) <= maxDim && (meta.height || 0) <= maxDim) {
      return base64DataUri; // already small enough
    }

    const resized = await sharp(buf)
      .resize(maxDim, maxDim, { fit: 'inside' })
      .jpeg({ quality: 75 })
      .toBuffer();

    console.log(`[Doubao Vision] Compressed photo: ${meta.width}x${meta.height} → ${maxDim}px max (${buf.length}b → ${resized.length}b)`);
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (err) {
    console.warn('[Doubao Vision] Photo compression failed, using original:', err);
    return base64DataUri;
  }
}

/**
 * Use Seed-2.0-pro multimodal model to analyze garden photo and provide design advice.
 * Falls back gracefully if the API is unavailable.
 */
export async function analyzeGardenWithAI(options: {
  gardenPhotoBase64: string;   // base64 data URI of garden photo
  treeInfos: TreeInfo[];       // selected tree info
  styleName: string;           // chosen style name
  userMessage: string;         // user's description
}): Promise<AIDesignAdvice> {
  const apiKey = process.env.DOUBAO_VISION_API_KEY || process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('DOUBAO_VISION_API_KEY not configured');
  }

  // Compress photo to reduce API latency (large base64 = slow upload + slow processing)
  const compressedPhoto = await compressPhotoForVision(options.gardenPhotoBase64);

  const treeDesc = options.treeInfos
    .map((t) => `${t.name}（${t.species}，高${(t.height / 100).toFixed(1)}米，冠幅${(t.crown / 100).toFixed(1)}米）`)
    .join('\n');

  const userPrompt = `请分析这张庭院照片，并为以下选中的树木规划最佳种植位置：

选中的树木：
${treeDesc}

选择的庭院风格：${options.styleName}
${options.userMessage ? `用户需求说明：${options.userMessage}` : ''}

请仔细观察照片中的庭院空间，给出专业的设计建议。`;

  const requestBody = {
    model: DOUBAO_VISION_MODEL,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: compressedPhoto,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  };

  console.log(`[Doubao Vision] Model: ${DOUBAO_VISION_MODEL}`);
  console.log(`[Doubao Vision] Photo base64 length: ${compressedPhoto.length} chars`);
  console.log(`[Doubao Vision] Analyzing garden with ${options.treeInfos.length} trees, style: ${options.styleName}`);

  const t0 = Date.now();
  const res = await fetch(DOUBAO_VISION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(45000), // 45s timeout — vision model needs time for image analysis
  });

  const elapsed = Date.now() - t0;
  console.log(`[Doubao Vision] API responded in ${elapsed}ms, status: ${res.status}`);

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'unknown');
    console.error(`[Doubao Vision] API error ${res.status}:`, errorBody);
    throw new Error(`豆包Vision API错误: ${res.status}`);
  }

  const data: any = await res.json();

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error('[Doubao Vision] No content in response:', JSON.stringify(data).slice(0, 500));
    throw new Error('豆包Vision API返回内容为空');
  }

  console.log(`[Doubao Vision] Got response (${content.length} chars, ${elapsed}ms)`);

  // Parse JSON from response, handling potential markdown code blocks
  let parsed: AIDesignAdvice;
  try {
    let jsonStr = content.trim();
    // Remove markdown code block markers if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('[Doubao Vision] Failed to parse JSON response:', content.slice(0, 300));
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

  // Validate required fields with defaults
  return {
    designSummary: parsed.designSummary || '暂无设计概述',
    spaceAnalysis: parsed.spaceAnalysis || '暂无空间分析',
    treePlacement: Array.isArray(parsed.treePlacement) ? parsed.treePlacement : [],
    styleAdvice: parsed.styleAdvice || '暂无风格建议',
    fengshuiTip: parsed.fengshuiTip || '暂无风水建议',
    budgetEstimate: parsed.budgetEstimate || '暂无预算估算',
  };
}

/**
 * Helper: convert a local file path to base64 data URI for vision API.
 */
export function gardenPhotoToBase64(filePath: string): string {
  return fileToBase64DataUri(filePath);
}
