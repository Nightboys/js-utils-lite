<script setup>
import { ArrowLeft } from '@lucide/vue';
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="empty-state">
    <p class="eyebrow">404</p>
    <h1>Page not found</h1>
    <p>The requested route does not exist.</p>
    <RouterLink class="primary-button" to="/"><ArrowLeft :size="18" /> Back home</RouterLink>
  </section>
</template>
