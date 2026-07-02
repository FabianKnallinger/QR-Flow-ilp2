import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the built app works from any sub-path - e.g. GitHub
  // Pages project sites (https://user.github.io/repo-name/) - without
  // extra configuration.
  base: './',
})
