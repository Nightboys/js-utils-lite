/**
 * 将数值限制在指定闭区间内。
 *
 * @param value - 原始数值。
 * @param min - 区间最小值。
 * @param max - 区间最大值。
 * @returns 限制后的数值。
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('min must be less than or equal to max.');
  }

  return Math.min(Math.max(value, min), max);
}
