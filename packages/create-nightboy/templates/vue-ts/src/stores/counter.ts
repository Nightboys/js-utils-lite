import { defineStore } from 'pinia';

// 示例状态展示最小 Pinia 用法，后续业务 store 可沿用 action 管理写操作。
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    /** 增加当前计数并由 Pinia 保证所有消费视图同步更新。 */
    increment() {
      this.count += 1;
    },
  },
});
