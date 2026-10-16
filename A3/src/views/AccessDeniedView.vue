<script setup>
import { currentUser } from '../auth'
</script>

<template>
  <main id="main-content" class="route-page" tabindex="-1">
    <section class="container access-denied-layout">
      <div class="content-panel access-denied-card">
        <span class="access-denied-code">403</span>
        <p class="section-label mb-2">Access denied</p>
        <h1>You do not have permission to view this page.</h1>
        <p>
          The Records page contains participant information and can only be opened by an admin.
          <span v-if="currentUser">You are logged in as {{ currentUser.fullName }} with the
          <strong>{{ currentUser.role }}</strong> role.</span>
          <span v-else>Please log in with an authorised account to continue.</span>
        </p>
        <RouterLink class="btn btn-success" :to="{ name: 'home' }">Return to home</RouterLink>
      </div>
    </section>
  </main>
</template>
