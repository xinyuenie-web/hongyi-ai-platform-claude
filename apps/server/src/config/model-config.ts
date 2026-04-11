/**
 * Model configuration — priorities, timeouts, and feature flags.
 * Environment variables override defaults.
 */

export interface ModelConfig {
  id: string;
  priority: number;          // lower = preferred
  enabled: boolean;
  requiresProxy: boolean;
  maxTimeoutMs: number;
  healthCheckIntervalMs: number;
}

/** Vision model priority list (for inT) */
export function getVisionModelConfigs(): ModelConfig[] {
  const priorityStr = process.env.INT_MODEL_PRIORITY || 'qwen-vl-max,doubao-seed-2.0-pro';
  const priorityList = priorityStr.split(',').map(s => s.trim());

  const allModels: ModelConfig[] = [
    {
      id: 'qwen-vl-max',
      priority: 99,
      enabled: !!process.env.DASHSCOPE_API_KEY,
      requiresProxy: false,
      maxTimeoutMs: 30000,
      healthCheckIntervalMs: 60000,
    },
    {
      id: 'doubao-seed-2.0-pro',
      priority: 99,
      enabled: !!(process.env.DOUBAO_VISION_API_KEY || process.env.DOUBAO_API_KEY),
      requiresProxy: false,
      maxTimeoutMs: 45000,
      healthCheckIntervalMs: 60000,
    },
    {
      id: 'gpt-4o',
      priority: 99,
      enabled: !!process.env.OPENAI_API_KEY,
      requiresProxy: true,
      maxTimeoutMs: 30000,
      healthCheckIntervalMs: 120000,
    },
  ];

  // Assign priorities based on INT_MODEL_PRIORITY env var
  for (const model of allModels) {
    const idx = priorityList.indexOf(model.id);
    if (idx >= 0) {
      model.priority = idx + 1;
    }
  }

  return allModels.sort((a, b) => a.priority - b.priority);
}
