import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: 'Discover — Short Dramas', keepAlive: true },
    },
    {
      path: '/series/:source/:id',
      name: 'series-detail',
      component: () => import('../views/SeriesDetailView.vue'),
      meta: { title: 'Series — Short Dramas' },
    },
    {
      path: '/drama/:videoId',
      redirect: (to) => ({
        name: 'series-detail',
        params: { source: 'drama', id: to.params.videoId },
      }),
    },
    {
      path: '/vip',
      name: 'vip',
      component: () => import('../views/VipView.vue'),
      meta: { title: 'Membership' },
    },
    {
      path: '/legal/subscription',
      name: 'legal-subscription',
      component: () => import('../views/SubscriptionTermsView.vue'),
      meta: { title: 'Subscription Terms — TeamShort' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.name === 'home') return false;
    if (to.name === 'series-detail' || to.name === 'vip') return { top: 0 };
    return { top: 0 };
  },
});

router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title;
  }
  document.body.classList.toggle('plain-page', to.name === 'series-detail');
});

export default router;
