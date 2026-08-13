<script setup lang="ts">
import { LayoutDashboard } from '@lucide/vue';
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="app-shell">
    <!-- 全局导航仅承载稳定入口，页面操作留在对应路由视图中。 -->
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="Nightboy workspace home">
        <span class="brand-mark"><LayoutDashboard :size="18" /></span>
        <span>Nightboy Workspace</span>
      </RouterLink>
      <nav aria-label="Primary navigation">
        <RouterLink to="/">Overview</RouterLink>
      </nav>
    </header>

    <main class="page-container">
      <RouterView />
    </main>
  </div>
</template>
