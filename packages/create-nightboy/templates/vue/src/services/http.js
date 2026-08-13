import axios from 'axios';

const REQUEST_TIMEOUT_MS = 10000;

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: REQUEST_TIMEOUT_MS,
});

// 响应层仅解包接口数据；错误保留原始上下文，交由具体业务决定展示方式。
http.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error),
);
