import { defineConfig } from 'tsup';

// 构建同时输出 ESM、CommonJS 和类型声明，且不生成生产 SourceMap。
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
