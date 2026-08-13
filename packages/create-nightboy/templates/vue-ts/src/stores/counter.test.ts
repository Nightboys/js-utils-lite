import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCounterStore } from './counter';

describe('counter store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('increments shared state through its action', () => {
    const counterStore = useCounterStore();
    counterStore.increment();
    expect(counterStore.count).toBe(1);
  });
});
