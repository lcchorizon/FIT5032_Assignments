<script setup>
import { ref } from 'vue'
import { currentUser } from './auth'

const menuOpen = ref(false)

const closeMenu = () => {
  menuOpen.value = false
}
</script>

<template>
  <div class="app-shell">
    <nav class="main-navigation" aria-label="Main navigation">
      <div class="container navigation-inner">
        <RouterLink class="brand" :to="{ name: 'home', hash: '#home' }" @click="closeMenu">
          <span class="brand-mark">G</span>
          <span>GreenConnect</span>
        </RouterLink>

        <button
          type="button"
          class="menu-button"
          :aria-expanded="menuOpen"
          aria-controls="navigationLinks"
          @click="menuOpen = !menuOpen"
        >
          Menu
        </button>

        <div id="navigationLinks" class="navigation-links" :class="{ open: menuOpen }">
          <RouterLink :to="{ name: 'home', hash: '#home' }" @click="closeMenu">Home</RouterLink>
          <RouterLink :to="{ name: 'home', hash: '#events' }" @click="closeMenu">
            Events
          </RouterLink>
          <RouterLink :to="{ name: 'home', hash: '#account' }" @click="closeMenu">
            {{ currentUser ? currentUser.fullName : 'Account' }}
          </RouterLink>
          <RouterLink :to="{ name: 'home', hash: '#registration' }" @click="closeMenu">
            Get involved
          </RouterLink>
          <RouterLink :to="{ name: 'records' }" @click="closeMenu">Records</RouterLink>
          <RouterLink
            class="navigation-action"
            :to="{ name: 'home', hash: '#events' }"
            @click="closeMenu"
          >
            Find an event
          </RouterLink>
        </div>
      </div>
    </nav>

    <RouterView />

    <footer class="site-footer">
      <div class="container footer-layout">
        <div>
          <p class="footer-brand mb-1">GreenConnect</p>
          <p class="mb-0">Community environmental activities across Melbourne.</p>
        </div>
        <div class="footer-links">
          <RouterLink :to="{ name: 'home', hash: '#events' }">Events</RouterLink>
          <RouterLink :to="{ name: 'home', hash: '#registration' }">Register</RouterLink>
          <RouterLink :to="{ name: 'records' }">Records</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>
