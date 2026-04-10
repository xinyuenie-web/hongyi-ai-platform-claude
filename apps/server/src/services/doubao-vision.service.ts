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

请严格按照以下JSON格式回复（不要包含markdown代码块标记）：
{
  "designSummary": "整体设计概述（2-3句话描述设计理念）",
  "spaceAnalysis": "对照片中庭院空间的分析（建筑风格、空间大小、光照等）",
  "treePlacement": [
    {
      "treeName": "树木名称",
      "position": "建议摆放位置（如：大门左侧3米处）",
      "reason": "选择此位置的原因"
    }
  ],
  "styleAdvice": "结合所选风格的设计建议",
  "fengshuiTip": "风水方面的建议",
  "budgetEstimate": "预算估算说明"
}`;

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
              url: options.gardenPhotoBase64,
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
  console.log(`[Doubao Vision] Analyzing garden with ${options.treeInfos.length} trees, style: ${options.styleName}`);

  const res = await fetch(DOUBAO_VISION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000), // 60s timeout
  });

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

  console.log(`[Doubao Vision] Got response (${content.length} chars)`);

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
