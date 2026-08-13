# {{projectName}}

基于 Express 和 TypeScript 的 Node.js API 基础模板，内置健康检查、分层结构、统一错误处理和测试。

```bash
npm install
cp .env.example .env
npm run dev
```

## 可用命令

- `npm run dev`：监听源码并启动开发服务。
- `npm run build`：编译生产代码。
- `npm start`：运行编译后的服务。
- `npm test`：运行接口测试。
- `npm run format:check`：检查代码格式。
- `npm run format`：格式化源码。

健康检查地址为 `GET /api/health`。
