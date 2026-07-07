import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://course.courze.ai',
  trailingSlash: 'always',
  integrations: [sitemap()],
})
