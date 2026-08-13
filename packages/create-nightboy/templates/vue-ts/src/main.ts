import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import './styles/main.css';

// 应用入口只注册全局基础设施，业务逻辑分别归属路由、状态和服务模块。
createApp(App).use(createPinia()).use(router).mount('#app');
