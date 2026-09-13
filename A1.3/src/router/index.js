import { createRouter, createWebHistory } from 'vue-router'
import { authReady, currentUser, userHasRole } from '../auth'
import AccessDeniedView from '../views/AccessDeniedView.vue'
import HomeView from '../views/HomeView.vue'
import RecordsView from '../views/RecordsView.vue'

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
      component: RecordsView,
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
  await authReady

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

export default router
