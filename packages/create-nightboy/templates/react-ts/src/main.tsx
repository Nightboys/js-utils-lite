import React from 'react';
import ReactDOM from 'react-dom/client';

import AppRouter from './router';
import './styles/main.css';

// 应用入口只挂载路由基础设施，业务状态和请求逻辑由各自模块管理。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
