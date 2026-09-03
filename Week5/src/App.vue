<script setup>
import BHeader from './components/BHeader.vue'
</script>

<template>
  <div class="app-shell">
    <BHeader />
    <main class="py-4">
      <RouterView />
    </main>
  </div>
</template>
