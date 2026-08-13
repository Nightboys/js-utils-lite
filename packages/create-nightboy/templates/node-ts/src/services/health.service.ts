export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

/** 构造无副作用的服务健康状态，便于控制器和测试复用。 */
export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}
