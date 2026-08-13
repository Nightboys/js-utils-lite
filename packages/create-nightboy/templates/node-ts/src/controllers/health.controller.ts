import type { Request, Response } from 'express';

import { getHealthStatus } from '../services/health.service.js';

/** 处理健康检查请求并返回稳定的 JSON 响应。 */
export function getHealth(_request: Request, response: Response): void {
  response.status(200).json(getHealthStatus());
}
