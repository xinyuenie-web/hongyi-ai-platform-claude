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
 * Build an EDITING prompt for Seedream 5.0.
 *
 * Critical: This must be an editing INSTRUCTION ("在这张照片中添加X"),
 * NOT a scene description ("一栋别墅前有X").
 * Seedream 5.0 has built-in CoT reasoning and precise image editing.
 */
function buildPrompt(trees: TreeInfo[], userMessage: string): string {
  const treeList = trees
    .map((t) => `一棵${t.species}造型树`)
    .join('、');

  const userDesc = userMessage?.trim() ? `。额外要求：${userMessage.trim()}` : '';

  return `请在这张照片中的庭院空地上添加${treeList}。严格要求：原有的房屋、建筑、围墙、道路、地面、天空必须完全保持不变，只在空地区域种上树木。树木要自然融入场景，光影和透视与原照片一致${userDesc}`;
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
 * Call Doubao Seedream 5.0 lite to EDIT a garden photo by adding trees.
 *
 * KEY FIX: Use the `image` parameter (Seedream 5.0 image editing format),
 * NOT `image_reference` (which was the Seedream 4.x reference format).
 *
 * With `image`, Seedream 5.0 enters image-to-image editing mode:
 * it preserves the original photo and applies the prompt as an edit instruction.
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

  // Seedream 5.0 image editing format:
  // - `image`: pass original photo directly (triggers image-to-image editing mode)
  // - `prompt`: editing instruction (NOT scene description)
  const requestBody: Record<string, any> = {
    model: DOUBAO_MODEL,
    prompt,
    image: gardenPhotoDataUri,
    size: '2K',
    response_format: 'url',
    watermark: false,
  };

  console.log(`[Doubao Seedream] Model: ${DOUBAO_MODEL}`);
  console.log(`[Doubao Seedream] Mode: image-to-image editing (using 'image' param)`);
  console.log(`[Doubao Seedream] Prompt: ${prompt.slice(0, 150)}...`);

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
