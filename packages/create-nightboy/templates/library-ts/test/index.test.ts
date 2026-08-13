import { describe, expect, it } from 'vitest';

import { clamp } from '../src/index';

describe('clamp', () => {
  it('keeps values inside the configured range', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('rejects inverted ranges', () => {
    expect(() => clamp(1, 5, 0)).toThrow(RangeError);
  });
});
