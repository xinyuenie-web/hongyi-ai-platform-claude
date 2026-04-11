/**
 * GPT-4o Vision Adapter (OpenAI)
 * OpenAI Chat Completions API — strongest structured output, requires proxy from China.
 */
import type { ModelAdapter, VisionInput, VisionOutput } from './base-adapter.js';
import { GARDEN_DESIGN_SYSTEM_PROMPT, buildUserPrompt, parseVisionResponse } from '../int-transformer.service.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIVisionAdapter implements ModelAdapter {
  readonly id = 'gpt-4o';
  readonly displayName = 'GPT-4o';
  readonly requiresProxy = true;
  readonly estimatedLatencyMs = 15000;

  private get apiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  }

  async healthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }

  async analyze(input: VisionInput): Promise<VisionOutput> {
    const apiKey = this.apiKey;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const userPrompt = buildUserPrompt(input);

    const requestBody = {
      model: 'gpt-4o',
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

    const timeout = Number(process.env.INT_MAX_TIMEOUT_MS) || 30000;
    console.log(`[GPT-4o] Calling gpt-4o with ${input.trees.length} trees...`);
    const t0 = Date.now();

    // Try endpoints: direct first, then HK proxy (China may block OpenAI)
    const proxyUrl = process.env.FAL_PROXY_URL;
    const endpoints: Array<{ name: string; url: string }> = [
      { name: 'direct', url: API_URL },
    ];
    if (proxyUrl) {
      endpoints.push({ name: 'proxy', url: `${proxyUrl}/openai/v1/chat/completions` });
    }

    let content: string | null = null;
    for (const ep of endpoints) {
      try {
        console.log(`[GPT-4o] Trying ${ep.name}: ${ep.url.slice(0, 60)}...`);
        const res = await fetch(ep.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeout),
        });

        const elapsed = Date.now() - t0;
        console.log(`[GPT-4o] ${ep.name} response in ${elapsed}ms, status: ${res.status}`);

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.warn(`[GPT-4o] ${ep.name} error: ${res.status} ${errBody.slice(0, 200)}`);
          continue;
        }

        const data: any = await res.json();
        content = data.choices?.[0]?.message?.content;
        if (content) break;
        console.warn(`[GPT-4o] ${ep.name}: empty content in response`);
      } catch (err: any) {
        console.warn(`[GPT-4o] ${ep.name} failed: ${err.message}`);
      }
    }

    if (!content) throw new Error('GPT-4o: all endpoints failed');

    return parseVisionResponse(content);
  }
}
