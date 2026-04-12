/**
 * Model Router — selects the best available AI model with health checks and automatic fallback.
 * PARALLEL RACING: Qwen + Doubao race simultaneously, first response wins.
 * Core of the inT tool's competitive advantage: multi-model routing with China-specific optimization.
 */
import type { ModelAdapter, VisionInput, VisionOutput } from './adapters/base-adapter.js';
import { DoubaoVisionAdapter } from './adapters/doubao-vision.adapter.js';
import { QwenVLAdapter } from './adapters/qwen-vl.adapter.js';
import { OpenAIVisionAdapter } from './adapters/openai-vision.adapter.js';
import { getVisionModelConfigs } from '../config/model-config.js';

// Adapter registry
const ADAPTER_MAP: Record<string, () => ModelAdapter> = {
  'qwen-vl-max': () => new QwenVLAdapter(),
  'doubao-seed-2.0-pro': () => new DoubaoVisionAdapter(),
  'gpt-4o': () => new OpenAIVisionAdapter(),
};

// Health status cache
interface HealthStatus {
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
}

const healthCache = new Map<string, HealthStatus>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function getHealthStatus(id: string): HealthStatus {
  return healthCache.get(id) || { healthy: true, lastCheck: 0, consecutiveFailures: 0 };
}

function markHealthy(id: string) {
  healthCache.set(id, { healthy: true, lastCheck: Date.now(), consecutiveFailures: 0 });
}

function markUnhealthy(id: string, error: string) {
  const prev = getHealthStatus(id);
  const failures = prev.consecutiveFailures + 1;
  healthCache.set(id, {
    healthy: failures < CIRCUIT_BREAKER_THRESHOLD,
    lastCheck: Date.now(),
    consecutiveFailures: failures,
    lastError: error,
  });
  if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[ModelRouter] Circuit breaker OPEN for ${id}: ${failures} consecutive failures`);
  }
}

function isCircuitOpen(id: string): boolean {
  const status = getHealthStatus(id);
  if (status.consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) return false;
  if (Date.now() - status.lastCheck > CIRCUIT_BREAKER_COOLDOWN_MS) {
    console.log(`[ModelRouter] Circuit breaker HALF-OPEN for ${id} (cooldown expired)`);
    return false;
  }
  return true;
}

// Overall timeout for the entire routing process
const TOTAL_ROUTING_TIMEOUT_MS = Number(process.env.INT_TOTAL_BUDGET_MS) || 40000; // 40s max

type RoutingResult = VisionOutput & { modelId: string; processingMs: number };

/**
 * Race all available models in parallel — first successful response wins.
 * This eliminates cascading timeouts (e.g., Qwen 35s + Doubao 40s = 75s sequential).
 * With parallel racing, worst case = max(individual timeout) ≈ 35-40s.
 */
export async function routeVisionRequest(input: VisionInput): Promise<RoutingResult> {
  const configs = getVisionModelConfigs();
  const enabledModels = configs.filter(c => c.enabled);

  if (enabledModels.length === 0) {
    throw new Error('No vision models configured. Set DASHSCOPE_API_KEY or DOUBAO_VISION_API_KEY.');
  }

  const routingStart = Date.now();

  // Build list of candidate models that can be tried
  const candidates: Array<{ config: typeof enabledModels[0]; adapter: ModelAdapter }> = [];
  for (const config of enabledModels) {
    if (isCircuitOpen(config.id)) {
      console.log(`[ModelRouter] Skipping ${config.id} (circuit breaker open)`);
      continue;
    }
    if (config.requiresProxy && !process.env.FAL_PROXY_URL) {
      console.log(`[ModelRouter] Skipping ${config.id} (requires proxy, none configured)`);
      continue;
    }
    const factory = ADAPTER_MAP[config.id];
    if (!factory) continue;
    const adapter = factory();
    candidates.push({ config, adapter });
  }

  if (candidates.length === 0) {
    throw new Error('No available vision models (all circuit breakers open or misconfigured)');
  }

  console.log(`[ModelRouter] Racing ${candidates.length} models in parallel: ${candidates.map(c => c.config.id).join(', ')}`);

  // Race all candidates in parallel
  const racePromises = candidates.map(async ({ config, adapter }): Promise<RoutingResult> => {
    const t0 = Date.now();
    try {
      const healthy = await adapter.healthCheck();
      if (!healthy) throw new Error('health check failed');

      console.log(`[ModelRouter] ${adapter.displayName} starting analysis...`);
      const result = await adapter.analyze(input);
      const processingMs = Date.now() - t0;

      markHealthy(config.id);
      console.log(`[ModelRouter] ${adapter.displayName} SUCCEEDED in ${processingMs}ms`);
      return { ...result, modelId: config.id, processingMs };
    } catch (err: any) {
      const processingMs = Date.now() - t0;
      const errMsg = err.message || String(err);
      console.warn(`[ModelRouter] ${config.id} FAILED in ${processingMs}ms: ${errMsg}`);
      markUnhealthy(config.id, errMsg);
      throw err; // re-throw so Promise.any skips this
    }
  });

  // Add overall timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`routing timeout (${TOTAL_ROUTING_TIMEOUT_MS}ms)`)), TOTAL_ROUTING_TIMEOUT_MS)
  );

  try {
    // Promise.any resolves with the FIRST successful result, ignoring failures
    const result = await Promise.race([
      Promise.any(racePromises),
      timeoutPromise,
    ]);
    const totalMs = Date.now() - routingStart;
    console.log(`[ModelRouter] Parallel racing completed in ${totalMs}ms, winner: ${result.modelId}`);
    return result;
  } catch (err: any) {
    const totalMs = Date.now() - routingStart;
    // If Promise.any rejects, ALL models failed
    if (err instanceof AggregateError) {
      const errors = err.errors.map((e: any, i: number) => `${candidates[i]?.config.id || '?'}: ${e.message}`).join('; ');
      throw new Error(`All ${candidates.length} models failed in ${totalMs}ms: ${errors}`);
    }
    throw new Error(`Model routing failed in ${totalMs}ms: ${err.message}`);
  }
}

/** Get health status of all configured models (for diagnostics endpoint) */
export function getModelHealthStatus(): Array<{ id: string; enabled: boolean; healthy: boolean; lastError?: string }> {
  const configs = getVisionModelConfigs();
  return configs.map(c => {
    const status = getHealthStatus(c.id);
    return {
      id: c.id,
      enabled: c.enabled,
      healthy: status.healthy,
      lastError: status.lastError,
    };
  });
}
