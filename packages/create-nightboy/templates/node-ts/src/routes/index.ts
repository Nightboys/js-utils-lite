import { Router } from 'express';

import { getHealth } from '../controllers/health.controller.js';

const apiRouter = Router();

// 公共 API 路由集中注册，便于后续按业务域拆分子路由。
apiRouter.get('/health', getHealth);

export default apiRouter;
