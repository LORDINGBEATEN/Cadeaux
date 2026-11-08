import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Numéro affiché sous le nom de l'appli : majeur.mineur à la main, build incrémenté par `npm run bump`.
const v = JSON.parse(readFileSync(new URL('./version.json', import.meta.url), 'utf8')) as { major: number; minor: number; build: number }
const APP_VERSION = `${v.major}.${v.minor}.${v.build}`

// En local, sert /api/preview avec la même fonction que sur Vercel.
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use('/api/preview', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/preview.ts')
          await mod.default(req, res)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), apiDev()], define: { __APP_VERSION__: JSON.stringify(APP_VERSION) } }
})
