import { http } from './http.js';

/** 请求后端健康检查，返回由统一响应拦截器解包后的业务数据。 */
export function getHealth() {
  return http.get('/health');
}
