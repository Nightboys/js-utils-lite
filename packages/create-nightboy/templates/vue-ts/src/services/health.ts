import { http } from './http';

export interface HealthResponse {
  status: string;
}

/** 请求后端健康检查，返回由统一响应拦截器解包后的业务数据。 */
export function getHealth(): Promise<HealthResponse> {
  return http.get('/health');
}
