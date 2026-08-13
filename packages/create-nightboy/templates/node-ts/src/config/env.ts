import 'dotenv/config';

const DEFAULT_PORT = 3000;

/** 将端口环境变量转换为安全数字，无效输入回退到默认端口。 */
function resolvePort(rawPort: string | undefined): number {
  const parsedPort = Number(rawPort);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: resolvePort(process.env.PORT),
};
