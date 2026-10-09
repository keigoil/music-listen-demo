import { createRouter, createWebHistory } from 'vue-router'
import SheetMusicPlayer from '@/views/SheetMusicPlayer.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'player',
      component: SheetMusicPlayer,
    },
  ],
})

export default router
