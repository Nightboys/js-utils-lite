import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

// 监听行为与应用创建分离，避免测试导入模块时意外占用端口。
app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});
