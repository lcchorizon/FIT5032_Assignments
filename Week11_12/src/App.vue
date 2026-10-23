<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BHeader from './components/BHeader.vue'
const route = useRoute()
const showHeader = computed(() => !route.meta.hideHeader)
</script>

<template>
  <div class="app-shell">
    <BHeader v-if="showHeader" />
    <main class="py-4">
      <RouterView />
    </main>
  </div>
</template>
