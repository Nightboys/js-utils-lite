import express from 'express';

import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import apiRouter from './routes/index.js';

/** 创建不监听端口的 Express 应用，便于测试和不同部署环境复用。 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
