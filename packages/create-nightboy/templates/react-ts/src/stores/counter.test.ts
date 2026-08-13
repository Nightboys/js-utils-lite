import { beforeEach, describe, expect, it } from 'vitest';

import { useCounterStore } from './counter';

describe('counter store', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 });
  });

  it('increments shared state through its action', () => {
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().count).toBe(1);
  });
});
