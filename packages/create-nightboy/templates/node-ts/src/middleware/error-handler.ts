import type { ErrorRequestHandler, RequestHandler } from 'express';

/** 未匹配路由统一返回 JSON，避免 Express 默认 HTML 404 泄露实现细节。 */
export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: 'Not Found',
    path: request.path,
  });
};

/** 捕获未处理错误并返回稳定响应，生产环境不向客户端暴露堆栈。 */
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal Server Error' });
};
