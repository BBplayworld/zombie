// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  
  app: {
    head: {
      title: 'Zombie MMORPG - Open World',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Canvas-based Quarter-view Zombie MMORPG' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  modules: [],

  ssr: false, // 게임은 클라이언트 사이드만 필요
})
