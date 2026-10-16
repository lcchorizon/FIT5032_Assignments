import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { authLoading, currentUser, userHasRole, waitForAuth } from '../auth'
import AccessDeniedView from '../views/AccessDeniedView.vue'
import HomeView from '../views/HomeView.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/records',
      name: 'records',
      component: () => import('../views/RecordsView.vue'),
      meta: { requiresAuth: true, roles: ['admin'] }
    },
    {
      path: '/access-denied',
      name: 'access-denied',
      component: AccessDeniedView
    }
  ],
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, top: 76, behavior: 'smooth' }
    }

    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  await waitForAuth()

  if (to.meta.requiresAuth && !currentUser.value) {
    return {
      name: 'home',
      hash: '#account',
      query: {
        reason: 'login-required',
        redirect: to.fullPath
      }
    }
  }

  if (to.meta.roles && !to.meta.roles.some((role) => userHasRole(role))) {
    return { name: 'access-denied' }
  }
})

watch(() => [authLoading.value, currentUser.value?.id, currentUser.value?.role], () => {
  const route = router.currentRoute.value
  if (!authLoading.value && route.meta.requiresAuth &&
      (!currentUser.value || (route.meta.roles && !route.meta.roles.some(userHasRole)))) {
    router.replace({ name: 'home', hash: '#account' })
  }
})

export default router
