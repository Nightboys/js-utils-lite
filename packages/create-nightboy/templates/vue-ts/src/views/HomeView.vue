<script setup lang="ts">
import { Activity, CheckCircle2, Minus, Plus } from '@lucide/vue';
import { ref } from 'vue';

import { getHealth } from '@/services/health';
import { useCounterStore } from '@/stores/counter';

type HealthTone = 'idle' | 'success' | 'error';

const counterStore = useCounterStore();
const healthStatus = ref('Not checked');
const healthTone = ref<HealthTone>('idle');
const isCheckingHealth = ref(false);

/** 执行健康检查并转换为用户可读状态，网络错误不会打断当前页面。 */
async function checkHealth() {
  if (isCheckingHealth.value) {
    return;
  }

  isCheckingHealth.value = true;
  healthStatus.value = 'Checking';
  healthTone.value = 'idle';

  try {
    await getHealth();
    healthStatus.value = 'Available';
    healthTone.value = 'success';
  } catch {
    healthStatus.value = 'Unavailable';
    healthTone.value = 'error';
  } finally {
    isCheckingHealth.value = false;
  }
}
</script>

<template>
  <section class="page-heading">
    <p class="eyebrow">Workspace overview</p>
    <h1>Business application baseline</h1>
    <p>Routing, state, API access, tests, and code quality are ready for product work.</p>
  </section>

  <!-- 状态和接口示例保持独立，方便业务开发时分别替换。 -->
  <section class="dashboard-grid" aria-label="Application examples">
    <article class="panel">
      <div class="panel-heading">
        <span class="icon-box"><Plus :size="18" /></span>
        <div>
          <h2>Shared state</h2>
          <p>Pinia action example</p>
        </div>
      </div>
      <div class="metric">{{ counterStore.count }}</div>
      <div class="button-row">
        <button class="icon-button" type="button" title="Decrease" disabled>
          <Minus :size="18" />
        </button>
        <button class="primary-button" type="button" @click="counterStore.increment">
          <Plus :size="18" /> Increment
        </button>
      </div>
    </article>

    <article class="panel">
      <div class="panel-heading">
        <span class="icon-box accent"><Activity :size="18" /></span>
        <div>
          <h2>API health</h2>
          <p>Axios service example</p>
        </div>
      </div>
      <div class="status-line" :data-tone="healthTone">
        <CheckCircle2 :size="18" />
        <span>{{ healthStatus }}</span>
      </div>
      <button
        class="secondary-button"
        type="button"
        :disabled="isCheckingHealth"
        @click="checkHealth"
      >
        {{ isCheckingHealth ? 'Checking...' : 'Check endpoint' }}
      </button>
    </article>
  </section>
</template>
