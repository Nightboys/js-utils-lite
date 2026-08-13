import { create } from 'zustand';

interface CounterState {
  count: number;
  increment: () => void;
}

// 示例状态展示最小 Zustand 用法，所有写操作通过明确 action 暴露给视图。
export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
