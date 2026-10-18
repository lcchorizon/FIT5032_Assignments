// Define page URLs and navigation checks. Backend rules still decide whether data can be read.
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
      path: '/events',
      name: 'events',
      component: () => import('../views/EventsView.vue'),
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../views/MapView.vue'),
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('../views/CalendarView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true, roles: ['admin'] },
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

// Wait for restored login state before checking access, so refreshing a private URL works correctly.
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

  // This redirects the interface. It does not replace Firestore rules or server-side ownership checks.
  if (to.meta.roles && !to.meta.roles.some((role) => userHasRole(role))) {
    return { name: 'access-denied' }
  }
})

// Leave a private page if the account logs out or loses the required role while the page is open.
watch(() => [authLoading.value, currentUser.value?.id, currentUser.value?.role], () => {
  const route = router.currentRoute.value
  if (!authLoading.value && route.meta.requiresAuth &&
      (!currentUser.value || (route.meta.roles && !route.meta.roles.some(userHasRole)))) {
    router.replace({ name: 'home', hash: '#account' })
  }
})

export default router
