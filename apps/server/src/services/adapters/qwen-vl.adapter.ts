/**
 * Qwen-VL-Max Adapter (通义千问VL-Max)
 * Alibaba DashScope API — OpenAI-compatible format, China-native (no proxy needed).
 */
import type { ModelAdapter, VisionInput, VisionOutput } from './base-adapter.js';
import { GARDEN_DESIGN_SYSTEM_PROMPT, buildUserPrompt, parseVisionResponse } from '../int-transformer.service.js';

const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export class QwenVLAdapter implements ModelAdapter {
  readonly id = 'qwen-vl-max';
  readonly displayName = '通义千问 VL-Max';
  readonly requiresProxy = false;
  readonly estimatedLatencyMs = 12000;

  private get apiKey(): string | undefined {
    return process.env.DASHSCOPE_API_KEY;
  }

  async healthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }

  async analyze(input: VisionInput): Promise<VisionOutput> {
    const apiKey = this.apiKey;
    if (!apiKey) throw new Error('DASHSCOPE_API_KEY not configured');

    const userPrompt = buildUserPrompt(input);

    const requestBody = {
      model: 'qwen-vl-max',
      messages: [
        { role: 'system', content: GARDEN_DESIGN_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: input.gardenPhotoBase64 } },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    };

    const timeout = Number(process.env.INT_MAX_TIMEOUT_MS) || 20000;
    console.log(`[Qwen-VL] Calling qwen-vl-max with ${input.trees.length} trees...`);
    const t0 = Date.now();

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeout),
    });

    const elapsed = Date.now() - t0;
    console.log(`[Qwen-VL] Response in ${elapsed}ms, status: ${res.status}`);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Qwen-VL API ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Qwen-VL returned empty content');

    return parseVisionResponse(content);
  }
}
