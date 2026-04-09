import fs from 'fs';
import path from 'path';

const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const DOUBAO_MODEL = 'doubao-seedream-4-5-251128';

const STYLE_DESCRIPTIONS: Record<string, string> = {
  modern: '现代简约',
  chinese: '新中式',
  european: '欧式古典',
  japanese: '日式禅意',
  tuscan: '田园托斯卡纳',
};

const STYLE_ATMOSPHERE: Record<string, string> = {
  modern: '简洁大气、线条利落',
  chinese: '古韵悠然、诗情画意',
  european: '典雅华贵、浪漫庄重',
  japanese: '静谧禅意、空灵自然',
  tuscan: '自然野趣、温馨浪漫',
};

interface TreeInfo {
  name: string;
  species: string;
  height: number;
  crown: number;
}

function buildPrompt(styleType: string, trees: TreeInfo[], userMessage: string): string {
  const styleDesc = STYLE_DESCRIPTIONS[styleType] || '中式';
  const atmosphere = STYLE_ATMOSPHERE[styleType] || '优雅大气';

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

  return `一栋${styleDesc}风格别墅的庭院园林景观设计效果图。门前空地上精心种植了${treeList}，${layoutDesc}。庭院整体呈现${atmosphere}的氛围，阳光洒在树木上光影自然柔和。专业园林景观设计渲染图，高品质建筑摄影风格，8K超高清，写实风格。`;
}

/**
 * Read a local file (uploaded image) and convert to base64.
 * Handles both absolute paths and relative paths from uploads dir.
 */
function fileToBase64(filePath: string): string {
  let absPath = filePath;
  if (!path.isAbsolute(filePath)) {
    absPath = path.join(process.cwd(), filePath);
  }
  const buf = fs.readFileSync(absPath);
  return buf.toString('base64');
}

/**
 * Download an image from URL and return base64 string.
 * Used for tree cover images that may be URLs.
 */
async function urlToBase64(url: string): Promise<string> {
  // If it's a local path (starts with /uploads or /images), read from disk
  if (url.startsWith('/uploads') || url.startsWith('/images')) {
    return fileToBase64(path.join(process.cwd(), url));
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf).toString('base64');
}

export interface GenerateImageOptions {
  gardenPhotoPath: string;          // local file path of uploaded garden photo
  treeImageUrls: string[];          // cover image URLs of selected trees
  treeInfos: TreeInfo[];            // tree metadata for prompt
  styleType: string;                // garden style type key
  userMessage: string;              // user's description
}

export interface GenerateImageResult {
  imageUrl: string;
  prompt: string;
}

/**
 * Call Doubao Seedream 4.5 to generate a garden design image.
 */
export async function generateGardenImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('DOUBAO_API_KEY not configured');
  }

  const prompt = buildPrompt(options.styleType, options.treeInfos, options.userMessage);

  // Build image references
  const imageReferences: any[] = [];

  // Garden photo as primary reference (high strength to preserve architecture)
  try {
    const gardenBase64 = fileToBase64(options.gardenPhotoPath);
    imageReferences.push({
      image_data: [{ image: gardenBase64 }],
      reference_type: 'use_as_reference',
      reference_strength: 0.8,
    });
  } catch (err) {
    console.error('Failed to read garden photo:', err);
    throw new Error('无法读取庭院照片');
  }

  // Tree images as secondary references (lower strength for style reference)
  const treeBase64List: string[] = [];
  for (const url of options.treeImageUrls.slice(0, 5)) {
    try {
      const b64 = await urlToBase64(url);
      treeBase64List.push(b64);
    } catch (err) {
      console.warn(`Failed to load tree image ${url}:`, err);
    }
  }

  if (treeBase64List.length > 0) {
    imageReferences.push({
      image_data: treeBase64List.map((b64) => ({ image: b64 })),
      reference_type: 'use_as_reference',
      reference_strength: 0.5,
    });
  }

  const requestBody: any = {
    model: DOUBAO_MODEL,
    prompt,
    response_format: 'url',
    size: '1024x1024',
    seed: -1,
    guidance_scale: 3.5,
  };

  if (imageReferences.length > 0) {
    requestBody.image_reference = imageReferences;
  }

  console.log(`[Doubao] Calling API with prompt: ${prompt.slice(0, 100)}...`);

  const res = await fetch(DOUBAO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(90000), // 90s timeout for image generation
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'unknown');
    console.error(`[Doubao] API error ${res.status}:`, errorBody);
    throw new Error(`豆包API错误: ${res.status}`);
  }

  const data: any = await res.json();

  if (!data.data || !data.data[0] || !data.data[0].url) {
    console.error('[Doubao] Unexpected response:', JSON.stringify(data).slice(0, 500));
    throw new Error('豆包API返回格式异常');
  }

  const imageUrl: string = data.data[0].url;
  console.log(`[Doubao] Image generated successfully: ${imageUrl.slice(0, 80)}...`);

  return { imageUrl, prompt };
}
