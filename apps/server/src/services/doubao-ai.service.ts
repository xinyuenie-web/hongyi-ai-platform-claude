import fs from 'fs';
import path from 'path';

const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const DOUBAO_MODEL = process.env.DOUBAO_SEEDREAM_MODEL || 'doubao-seedream-5-0-lite-260128';

interface TreeInfo {
  name: string;
  species: string;
  height: number;
  crown: number;
}

/**
 * Build prompt that instructs Seedream to ADD trees to the existing garden photo.
 *
 * Key principle: The user's original garden photo is sacred — house, architecture,
 * walls, driveways, sky must remain EXACTLY as-is. Only ADD trees to empty spaces.
 */
function buildPrompt(trees: TreeInfo[], userMessage: string): string {
  const treeList = trees
    .map((t) => `${t.species}造型树（高${(t.height / 100).toFixed(1)}米、冠幅${(t.crown / 100).toFixed(1)}米）`)
    .join('、');

  let layoutDesc = '自然摆放在庭院空地上';
  if (trees.length === 1) {
    layoutDesc = '种植在庭院空地中央作为主景树';
  } else if (trees.length === 2) {
    layoutDesc = '分别种植在庭院空地两侧，对称布局';
  } else if (trees.length <= 5) {
    layoutDesc = '错落有致地种植在庭院空地上，形成层次感';
  }

  const userDesc = userMessage?.trim() ? `。额外要求：${userMessage.trim()}` : '';

  return `在这张庭院照片的基础上，严格保持原有房屋建筑、围墙、地面、天空等所有原始元素完全不变，仅在庭院空地区域添加${treeList}，${layoutDesc}。树木必须真实自然地融入原有场景中，光影与原照片一致，透视比例正确。写实摄影风格，超高清画质${userDesc}`;
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

export interface GenerateImageOptions {
  gardenPhotoPath: string;
  treeImageUrls: string[];
  treeInfos: TreeInfo[];
  styleType: string;
  userMessage: string;
}

export interface GenerateImageResult {
  imageUrl: string;
  prompt: string;
}

/**
 * Call Doubao Seedream 5.0 lite to generate a garden design image.
 *
 * Strategy:
 * - Use "remake" reference type to preserve the original photo as much as possible
 * - reference_strength set to 0.95 (maximum preservation of original)
 * - Prompt explicitly instructs: keep everything, ONLY add trees
 */
export async function generateGardenImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('DOUBAO_API_KEY not configured');
  }

  const prompt = buildPrompt(options.treeInfos, options.userMessage);

  // Read garden photo as base64 data URI
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
    // "remake" type: regenerate based on original image, preserving its content
    // High strength (0.95) = maximum preservation of original photo
    image_reference: [
      {
        image_data: [{ image: gardenPhotoDataUri }],
        reference_type: 'remake',
        reference_strength: 0.95,
      },
    ],
  };

  console.log(`[Doubao Seedream] Model: ${DOUBAO_MODEL}`);
  console.log(`[Doubao Seedream] Prompt: ${prompt.slice(0, 150)}...`);
  console.log(`[Doubao Seedream] Reference type: remake, strength: 0.95`);

  const res = await fetch(DOUBAO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120000),
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
