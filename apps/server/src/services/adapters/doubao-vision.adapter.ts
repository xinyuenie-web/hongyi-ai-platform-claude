/**
 * Doubao Vision Adapter (豆包 Seed-2.0-Pro)
 * Extracted from doubao-vision.service.ts — same API, wrapped in ModelAdapter interface.
 */
import type { ModelAdapter, VisionInput, VisionOutput } from './base-adapter.js';
import { GARDEN_DESIGN_SYSTEM_PROMPT, buildUserPrompt, parseVisionResponse } from '../int-transformer.service.js';

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export class DoubaoVisionAdapter implements ModelAdapter {
  readonly id = 'doubao-seed-2.0-pro';
  readonly displayName = '豆包 Seed-2.0-Pro';
  readonly requiresProxy = false;
  readonly estimatedLatencyMs = 30000;

  private get apiKey(): string | undefined {
    return process.env.DOUBAO_VISION_API_KEY || process.env.DOUBAO_API_KEY;
  }

  private get model(): string {
    return process.env.DOUBAO_VISION_MODEL || 'doubao-seed-2-0-pro-260215';
  }

  async healthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }

  async analyze(input: VisionInput): Promise<VisionOutput> {
    const apiKey = this.apiKey;
    if (!apiKey) throw new Error('DOUBAO_VISION_API_KEY not configured');

    const userPrompt = buildUserPrompt(input);

    const requestBody = {
      model: this.model,
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

    const timeout = Number(process.env.INT_MAX_TIMEOUT_MS) || 45000;
    console.log(`[Doubao] Calling ${this.model} with ${input.trees.length} trees...`);
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
    console.log(`[Doubao] Response in ${elapsed}ms, status: ${res.status}`);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Doubao API ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Doubao returned empty content');

    return parseVisionResponse(content);
  }
}
