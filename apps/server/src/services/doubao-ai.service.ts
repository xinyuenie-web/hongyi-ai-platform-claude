import fs from 'fs';
import path from 'path';

const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const DOUBAO_MODEL = process.env.DOUBAO_SEEDREAM_MODEL || 'doubao-seedream-5-0-lite-260128';

const STYLE_DESCRIPTIONS: Record<string, string> = {
  modern: '现代简约',
  chinese: '新中式',
  european: '欧式古典',
  japanese: '日式禅意',
  tuscan: '田园托斯卡纳',
};

interface TreeInfo {
  name: string;
  species: string;
  height: number;
  crown: number;
}

/**
 * Build a detailed prompt for Seedream image generation.
 * The prompt focuses on the user's garden with their selected trees —
 * style only influences wording, NOT visual references.
 */
function buildPrompt(styleType: string, trees: TreeInfo[], userMessage: string): string {
  const styleDesc = STYLE_DESCRIPTIONS[styleType] || '中式';

  const treeList = trees
    .map((t) => `一棵高${(t.height / 100).toFixed(1)}米冠幅${(t.crown / 100).toFixed(1)}米的${t.species}造型树`)
    .join('、');

  let layoutDesc = '树木自然错落分布于庭院中';
  if (trees.length === 1) {
    layoutDesc = '作为庭院主景树居中种植';
  } else if (trees.length === 2) {
    layoutDesc = '两棵树对称种植于庭院入口两侧';
  } else if (trees.length <= 5) {
    layoutDesc = '树木错落有致地分布在庭院前方，形成层次分明的景观带';
  } else {
    layoutDesc = '多棵造型树木群植于庭院各处，营造丰富的立体景观层次';
  }

  // 用户自定义描述优先
  const userDesc = userMessage?.trim() ? `，${userMessage.trim()}` : '';

  return `基于用户上传的庭院照片，保留庭院原始建筑和空间布局不变，在庭院空地上精心种植了${treeList}，${layoutDesc}。整体呈现${styleDesc}园林风格${userDesc}。阳光洒在树木上光影自然柔和，树木与庭院环境完美融合。专业园林景观设计效果图，高品质建筑摄影风格，超高清，写实风格。`;
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
  // Detect mime type from extension
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

export interface GenerateImageOptions {
  gardenPhotoPath: string;          // local file path of uploaded garden photo
  treeImageUrls: string[];          // cover image URLs of selected trees (unused in new API)
  treeInfos: TreeInfo[];            // tree metadata for prompt
  styleType: string;                // garden style type key
  userMessage: string;              // user's description
}

export interface GenerateImageResult {
  imageUrl: string;
  prompt: string;
}

/**
 * Call Doubao Seedream 5.0 lite to generate a garden design image.
 *
 * Strategy:
 * - Garden photo is the PRIMARY reference (high weight to preserve original appearance)
 * - Style reference images are NOT used (only text prompt mentions style)
 * - Tree details are described in the text prompt
 */
export async function generateGardenImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('DOUBAO_API_KEY not configured');
  }

  const prompt = buildPrompt(options.styleType, options.treeInfos, options.userMessage);

  // Read garden photo as base64 data URI for image reference
  let gardenPhotoDataUri: string;
  try {
    gardenPhotoDataUri = fileToBase64DataUri(options.gardenPhotoPath);
  } catch (err) {
    console.error('Failed to read garden photo:', err);
    throw new Error('无法读取庭院照片');
  }

  const requestBody: Record<string, any> = {
    model: DOUBAO_MODEL,
    prompt,
    response_format: 'url',
    size: '2K',
    watermark: false,
    // Use garden photo as reference image to preserve original garden appearance
    image_reference: [
      {
        image_data: [{ image: gardenPhotoDataUri }],
        reference_type: 'use_as_reference',
        reference_strength: 0.85,
      },
    ],
  };

  console.log(`[Doubao Seedream] Model: ${DOUBAO_MODEL}`);
  console.log(`[Doubao Seedream] Prompt: ${prompt.slice(0, 120)}...`);

  const res = await fetch(DOUBAO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000), // 120s timeout for image generation
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'unknown');
    console.error(`[Doubao Seedream] API error ${res.status}:`, errorBody);
    throw new Error(`豆包Seedream API错误: ${res.status}`);
  }

  const data: any = await res.json();

  if (!data.data || !data.data[0] || !data.data[0].url) {
    console.error('[Doubao Seedream] Unexpected response:', JSON.stringify(data).slice(0, 500));
    throw new Error('豆包Seedream API返回格式异常');
  }

  const imageUrl: string = data.data[0].url;
  console.log(`[Doubao Seedream] Image generated successfully: ${imageUrl.slice(0, 80)}...`);

  return { imageUrl, prompt };
}
