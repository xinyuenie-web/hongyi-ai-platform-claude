/** 格式化价格 (元) */
export function formatPrice(price: number): string {
  if (price >= 10000) {
    const wan = price / 10000;
    return wan % 1 === 0 ? `${wan}万` : `${wan.toFixed(1)}万`;
  }
  return `${price.toLocaleString('zh-CN')}`;
}

/** 格式化树木规格 */
export function formatSpecs(height: number, crown: number): string {
  return `高${height / 100}m × 冠幅${crown / 100}m`;
}

/** 格式化树木编号 */
export function formatTreeId(num: number): string {
  return `HY${String(num).padStart(4, '0')}`;
}
