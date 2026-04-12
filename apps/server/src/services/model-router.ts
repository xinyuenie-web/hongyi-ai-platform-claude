/**
 * Model Router — selects the best available AI model with health checks and automatic fallback.
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
  // Check cooldown
  if (Date.now() - status.lastCheck > CIRCUIT_BREAKER_COOLDOWN_MS) {
    console.log(`[ModelRouter] Circuit breaker HALF-OPEN for ${id} (cooldown expired)`);
    return false; // allow retry
  }
  return true;
}

// Global time budget for the entire routing process — prevents cascading timeouts
const TOTAL_ROUTING_BUDGET_MS = Number(process.env.INT_TOTAL_BUDGET_MS) || 35000; // 35s max across all models

/**
 * Select and call the best available vision model.
 * Tries models in priority order, with automatic fallback on failure.
 * Enforces a TOTAL time budget to prevent cascading timeouts (e.g., 30s + 45s = 75s).
 */
export async function routeVisionRequest(input: VisionInput): Promise<VisionOutput & { modelId: string; processingMs: number }> {
  const configs = getVisionModelConfigs();
  const enabledModels = configs.filter(c => c.enabled);

  if (enabledModels.length === 0) {
    throw new Error('No vision models configured. Set DASHSCOPE_API_KEY or DOUBAO_VISION_API_KEY.');
  }

  const errors: Array<{ modelId: string; error: string }> = [];
  const routingStart = Date.now();

  for (const config of enabledModels) {
    // Check global time budget before trying next model
    const elapsed = Date.now() - routingStart;
    const remaining = TOTAL_ROUTING_BUDGET_MS - elapsed;
    if (remaining < 3000) {
      console.warn(`[ModelRouter] Time budget exhausted (${elapsed}ms used of ${TOTAL_ROUTING_BUDGET_MS}ms), stopping`);
      errors.push({ modelId: config.id, error: `time budget exhausted (${elapsed}ms)` });
      break;
    }

    // Skip if circuit breaker is open
    if (isCircuitOpen(config.id)) {
      console.log(`[ModelRouter] Skipping ${config.id} (circuit breaker open)`);
      errors.push({ modelId: config.id, error: 'circuit breaker open' });
      continue;
    }

    // Skip proxy-requiring models if no proxy configured
    if (config.requiresProxy && !process.env.FAL_PROXY_URL) {
      console.log(`[ModelRouter] Skipping ${config.id} (requires proxy, none configured)`);
      errors.push({ modelId: config.id, error: 'requires proxy' });
      continue;
    }

    const adapterFactory = ADAPTER_MAP[config.id];
    if (!adapterFactory) {
      console.warn(`[ModelRouter] No adapter for ${config.id}`);
      continue;
    }

    const adapter = adapterFactory();
    const t0 = Date.now();

    try {
      // Quick health check
      const healthy = await adapter.healthCheck();
      if (!healthy) {
        errors.push({ modelId: config.id, error: 'health check failed' });
        continue;
      }

      console.log(`[ModelRouter] Trying ${adapter.displayName} (priority ${config.priority}, budget remaining: ${remaining}ms)...`);

      // Race the adapter against remaining time budget
      const result = await Promise.race([
        adapter.analyze(input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`routing budget exceeded (${remaining}ms)`)), remaining)
        ),
      ]);
      const processingMs = Date.now() - t0;

      markHealthy(config.id);
      console.log(`[ModelRouter] ${adapter.displayName} succeeded in ${processingMs}ms`);

      return { ...result, modelId: config.id, processingMs };
    } catch (err: any) {
      const processingMs = Date.now() - t0;
      const errMsg = err.message || String(err);
      console.error(`[ModelRouter] ${config.id} failed in ${processingMs}ms: ${errMsg}`);
      markUnhealthy(config.id, errMsg);
      errors.push({ modelId: config.id, error: errMsg });
    }
  }

  const totalMs = Date.now() - routingStart;
  const errorSummary = errors.map(e => `${e.modelId}: ${e.error}`).join('; ');
  throw new Error(`All vision models failed in ${totalMs}ms: ${errorSummary}`);
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
